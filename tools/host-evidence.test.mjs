import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { Buffer } from "node:buffer";
import os from "node:os";
import path from "node:path";
import { loadHostEvidence, withVerifiedHostEvidence } from "./host-evidence.mjs";
import { enrichBeatScenes } from "./beat-spec.mjs";
import { hostWorkflowState } from "./workbench-host.mjs";

const chart = { type: "chart", chartType: "milestones", title: "图中 MRR 阶段", unit: "USD / 月 · MRR", data: [{ label: "起步", value: 0, display: "$0" }, { label: "后续阶段", value: 150000, display: "$150k+", note: "下界" }], source: "来源：人工核对原图；非日期" };
const setup = async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "host-evidence-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "public"));
  const bytes = Buffer.from("fixed-original-image-bytes");
  await writeFile(path.join(root, "public/original.png"), bytes);
  const profile = { image: "original.png", sha256: createHash("sha256").update(bytes).digest("hex"), evidenceText: "人工核对 MRR 阶段，不是自动识图", title: "原图", focus: { x: .1, y: .2, width: .6, height: .5 }, chart, relationship: { type: "relationship", title: "聚焦渠道", nodes: ["外拓", "内容", "合作"], mode: "focus", focus: 0 } };
  const save = (profiles) => writeFile(path.join(root, "public/host-evidence.json"), JSON.stringify({ version: 1, profiles }));
  await save([profile]);
  return { root, profile, save };
};

test("reviewed evidence is bound to actual image SHA and rejects stale or invalid profiles", async (context) => {
  const { root, profile, save } = await setup(context);
  assert.equal((await loadHostEvidence(root)).profiles[0].chart.data[1].display, "$150k+");
  for (const invalid of [
    { ...profile, sha256: "0".repeat(64) },
    { ...profile, image: "../outside.png" },
    { ...profile, focus: { x: .9, y: .9, width: .5, height: .5 } },
    { ...profile, chart: { ...chart, data: [{ label: "假值", value: "999" }] } },
    { ...profile, chart: { ...chart, chartType: "proportion" } },
  ]) {
    await save([invalid]);
    assert.deepEqual(await loadHostEvidence(root), { profiles: [] });
  }
  await save([profile]);
  await writeFile(path.join(root, "public/original.png"), "changed-image");
  assert.deepEqual(await loadHostEvidence(root), { profiles: [] });
});

test("server boundary replaces client evidence and keeps ARR context separate from reviewed monthly MRR", async (context) => {
  const { root, profile } = await setup(context);
  const input = { templateId: "host", narrationAudioSrc: "original.wav", cases: [{ image: "original.png", title: "原产品" }], hostEvidence: [{ ...profile, chart: { ...chart, unit: "ARR", data: [{ label: "伪造", value: 999999 }] } }], beats: [{ say: "年收入达到400万美元", section: "case", caseIndex: 0, headline: "年收入400", elements: [] }] };
  const before = JSON.stringify(input);
  const verified = await withVerifiedHostEvidence(input, root);
  const beat = verified.beats[0];
  const actualChart = beat.elements.find((element) => element.type === "chart");
  assert.equal(actualChart.unit, "USD / 月 · MRR");
  assert.equal(actualChart.data[1].display, "$150k+");
  assert.equal(actualChart.data.some((point) => point.value === 4000000 || point.value === 999999), false);
  assert.equal(beat.headline, "年收入400万美元");
  assert.equal(beat.elements.find((element) => element.type === "image").src, "original.png");
  assert.deepEqual(beat.elements.find((element) => element.type === "image").focus, profile.focus);
  assert.equal(JSON.stringify(input), before);
  assert.equal(verified.narrationAudioSrc, "original.wav");
});

test("legacy cached beats gain reviewed charts and continuous channel relationships without cache mutation", async (context) => {
  const { root } = await setup(context);
  const hostEvidence = (await loadHostEvidence(root)).profiles;
  const beats = [
    { say: "年收入400万美元", caseIndex: 0, elements: [] },
    { say: "不是所有渠道一起做", caseIndex: 0, elements: [] },
    { say: "先打透一个渠道", caseIndex: 0, elements: [] },
  ];
  const before = JSON.stringify(beats);
  const result = hostWorkflowState({ hostEvidence, cases: [{ image: "original.png" }] }, beats, {});
  assert.deepEqual(result.previewProps.beats.map((beat) => beat.scene), ["metric", "relationship", "relationship"]);
  assert.deepEqual(result.previewProps.beats[1].elements[0].nodes, result.previewProps.beats[2].elements[0].nodes);
  assert.equal(result.previewProps.beats.every((beat) => beat.elements.some((element) => element.src === "original.png")), true);
  assert.equal(JSON.stringify(beats), before);
});

test("channel overview becomes focused on the next beat and generic source flow retains the same real nodes", () => {
  const profile = { image: "original.png", relationship: { type: "relationship", title: "聚焦渠道", nodes: ["外拓", "内容"], mode: "focus", focus: 0 } };
  const result = enrichBeatScenes([
    { say: "核心策略不是全渠道铺开", caseIndex: 0, elements: [] },
    { say: "而是先打透一个渠道", caseIndex: 0, elements: [] },
    { say: "真正有价值的流量会进入交易", caseIndex: 1, elements: [] },
    { say: "而不是只停留在曝光层面", caseIndex: 1, elements: [] },
  ], { cases: [{ image: "original.png" }, { image: "clip.png" }], hostEvidence: [profile] });
  assert.equal(result[0].elements[0].focus, undefined);
  assert.equal(result[1].elements[0].focus, 0);
  assert.deepEqual(result[2].elements[0].nodes, result[3].elements[0].nodes);
  assert.deepEqual(result[2].elements[0].nodes, ["流量", "交易"]);
});

test("model charts need actual labelled source facts and reject invented timelines or missing denominators", () => {
  const base = { say: "甲组月收入100美元，乙组月收入200美元，分别进行对比", caseIndex: 0, elements: [{ type: "chart", chartType: "comparison", title: "收入对比", unit: "美元", data: [{ label: "甲组", value: 100, display: "100美元" }, { label: "乙组", value: 200, display: "200美元" }] }] };
  assert.equal(enrichBeatScenes([base], { cases: [] })[0].elements.find((element) => element.type === "chart").chartType, "comparison");
  for (const invalid of [
    { ...base.elements[0], data: [{ label: "甲组", value: 999, display: "999美元" }] },
    { ...base.elements[0], chartType: "milestones" },
    { ...base.elements[0], chartType: "proportion" },
    { ...base.elements[0], unit: "ARR" },
  ]) {
    const result = enrichBeatScenes([{ ...base, elements: [invalid] }], { cases: [] })[0];
    assert.equal(result.elements.some((element) => element.type === "chart" && element.chartType !== "single"), false);
  }
  const [flow] = enrichBeatScenes([{ say: "有价值的流量会进入交易", caseIndex: 0, elements: [] }], { cases: [{ image: "clip.png" }] });
  assert.equal(flow.scene, "relationship");
  assert.deepEqual(flow.elements[0].nodes, ["流量", "交易"]);
  assert.equal(flow.elements.some((element) => element.src === "clip.png"), true);
});

test("comparison charts reject mixed currencies and per-point accounting periods", () => {
  const compare = (say, unit, first, second) => enrichBeatScenes([{ say, caseIndex: 0, elements: [{ type: "chart", chartType: "comparison", title: "原文对比", unit, data: [{ label: "甲组", value: 100, display: first }, { label: "乙组", value: 200, display: second }] }] }], { cases: [] })[0];
  for (const beat of [
    compare("甲组月收入100美元，乙组月收入200元，分别对比", "美元", "100美元", "200元"),
    compare("甲组每月100用户，乙组每年200用户，分别对比用户/月和用户/年", "用户/月", "100用户", "200用户"),
    compare("甲组100用户/月，乙组200用户/年，分别对比", "用户/月", "100用户/月", "200用户/年"),
    compare("甲组每月100用户，乙组每年200用户，分别对比", "用户", "100用户", "200用户"),
    compare("甲组每月100用户，乙组200用户，分别对比", "用户", "100用户", "200用户"),
  ]) assert.equal(beat.elements.some((element) => element.type === "chart" && element.chartType === "comparison"), false);
  const currency = compare("甲组月收入100美元，乙组月收入200美元，分别对比", "美元", "100美元", "200美元");
  assert.equal(currency.elements.find((element) => element.type === "chart").chartType, "comparison");
  const users = compare("甲组100用户/月，乙组200用户/月，分别对比", "用户/月", "100用户/月", "200用户/月");
  assert.equal(users.elements.find((element) => element.type === "chart").chartType, "comparison");
});

test("relationship arrows require an explicit source direction rather than merely two mentioned entities", () => {
  const relationship = (say, nodes) => enrichBeatScenes([{ say, caseIndex: 0, elements: [{ type: "relationship", title: "模型猜测的因果关系", nodes, mode: "flow" }] }], { cases: [] })[0].elements[0];
  assert.equal(relationship("收入和成本分别需要核对", ["收入", "成本"]).mode, "focus");
  assert.equal(relationship("曝光不代表交易", ["曝光", "交易"]).mode, "focus");
  assert.equal(relationship("有价值的流量会进入交易", ["流量", "交易"]).mode, "flow");
  assert.equal(relationship("交易带来流量", ["流量", "交易"]).mode, "focus");
  assert.equal(relationship("流量转化为交易", ["流量", "交易"]).title, "流量与交易");
});
