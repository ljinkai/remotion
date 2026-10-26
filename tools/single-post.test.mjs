import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { transform } from "esbuild";
import os from "node:os";
import path from "node:path";
import {
  normalizeSinglePost,
  buildSinglePostPrompt,
  generateSinglePostScript,
  singlePostProps,
} from "./single-post.mjs";
import { normalizeRenderJobOptions } from "./render-job-options.mjs";
import {
  createQueuedJob,
  createOrReuseQueuedJob,
  readJob,
  publicJobView,
  updateJob,
} from "./render-job-store.mjs";
import {
  runOneJob,
  buildCallbackPayload,
  recoverRenderJobs,
  enqueueRenderJob,
} from "./render-job-worker.mjs";
import { compositionIdForProps, finalizeBeats } from "./beat-spec.mjs";

const post = {
  title: "一个新产品",
  body: "作者推出产品，有 12 个用户。",
  source_url: "https://example.com/post/1",
  author: "Maker",
  commentary: "值得关注",
  images: ["https://example.com/image.png"],
};
const script = {
  title: "A new product",
  intro: "Here is a new product.",
  cases: [{ index: "01", narration: "The maker reports 12 users." }],
  closing: "Start with a focused audience.",
  source: "single_post",
};
const input = () => {
  const normalized = normalizeSinglePost(post);
  return {
    ...normalized,
    options: normalizeRenderJobOptions(normalized.options),
    content_mode: "single_post",
    client_ref: "content-video:123",
    callback_url: null,
  };
};
const temporary = async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "single-post-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
};

test("single post request validates English portrait host and bounded duration", () => {
  assert.equal(input().options.target_duration_seconds, 45);
  assert.equal(input().options.templateId, "host");
  for (const options of [
    { target_duration_seconds: 14 },
    { target_duration_seconds: 91 },
    { target_duration_seconds: "45" },
    { locale: "zh" },
    { template_id: "midnight" },
    { aspects: ["landscape"] },
    { skip_ai_script: true },
  ])
    assert.throws(() => normalizeSinglePost(post, options));
  assert.throws(() =>
    normalizeSinglePost({ ...post, images: ["file:///private/a"] }),
  );
  assert.throws(() => normalizeSinglePost({ ...post, body: "" }));
  assert.throws(() =>
    normalizeSinglePost({ ...post, source_url: "data:text/plain,foo" }),
  );
  assert.equal(normalizeRenderJobOptions({}).locale, "zh");
});

test("single post script preserves facts and separates editor opinion without weekly defaults", () => {
  const prompt = buildSinglePostPrompt(post, 45);
  assert.match(prompt, /ONE POST/);
  assert.match(prompt, /opinion/);
  assert.match(prompt, /12/);
  const props = singlePostProps(post, script);
  assert.equal(props.closingSubtitle, script.closing);
  assert.equal(props.cases.length, 1);
  assert.equal(props.cases[0].image, post.images[0]);
  assert.equal(props.ticker, "");
  assert.doesNotMatch(JSON.stringify(props), /next week|Indie Maker Weekly/);
});

test("script response rejects malformed, non-English and weekly narration", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRIPT_LLM_API_KEY;
  process.env.SCRIPT_LLM_API_KEY = "test-only";
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SCRIPT_LLM_API_KEY;
    else process.env.SCRIPT_LLM_API_KEY = originalKey;
  });
  for (const payload of [
    {},
    { ...script, intro: "这是一个产品" },
    { ...script, closing: "See you next week." },
  ]) {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      }),
    });
    await assert.rejects(generateSinglePostScript(post, 45));
  }
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(script) } }],
    }),
  });
  assert.equal((await generateSinglePostScript(post, 45)).cases.length, 1);
});

test("persistent client_ref deduplicates concurrent creates and retries", async (t) => {
  const root = await temporary(t);
  const [a, b] = await Promise.all([
    createOrReuseQueuedJob(root, input()),
    createOrReuseQueuedJob(root, input()),
  ]);
  assert.equal(a.job.job_id, b.job.job_id);
  assert.equal(Number(a.created) + Number(b.created), 1);
  assert.equal((await readJob(root, a.job.job_id)).post.body, post.body);
  assert.equal((await createOrReuseQueuedJob(root, input())).created, false);
  await assert.rejects(
    createOrReuseQueuedJob(root, {
      ...input(),
      post: { ...post, body: "Changed" },
    }),
    /different content/,
  );
  const weekly = await createQueuedJob(root, {
    markdown: "# Weekly",
    callback_url: null,
  });
  assert.equal(weekly.markdown, "# Weekly");
  assert.equal(weekly.content_mode, "weekly");
});

const dependencies = (rendered, seconds = 30) => ({
  generateSinglePostScript: async () => script,
  planBeats: async () => [
    {
      section: "intro",
      caseIndex: null,
      say: script.intro,
      headline: "New product",
      accent: "",
      host: "point",
      elements: [],
    },
    {
      section: "case",
      caseIndex: 0,
      say: script.cases[0].narration,
      headline: "12 users",
      accent: "12",
      host: "point",
      elements: [],
    },
    {
      section: "closing",
      caseIndex: null,
      say: script.closing,
      headline: "Stay focused",
      accent: "",
      host: "point",
      elements: [],
    },
  ],
  synthesizeVideoProps: async (props) => ({
    props: {
      ...props,
      introDurationMs: 5000,
      introCues: [{ text: script.intro, startMs: 0, endMs: 5000 }],
      cases: [
        {
          ...props.cases[0],
          durationMs: (seconds - 10) * 1000,
          cues: [
            {
              text: script.cases[0].narration,
              startMs: 0,
              endMs: (seconds - 10) * 1000,
            },
          ],
        },
      ],
      closingDurationMs: 5000,
      closingCues: [{ text: script.closing, startMs: 0, endMs: 5000 }],
    },
  }),
  getQiniuConfig: () => ({ keyPrefix: "test" }),
  embedLocalAudioAsDataUrls: async (props) => props,
  renderToPath: async (_root, props) => rendered.push(props),
  uploadFileToQiniu: async () => "https://cdn.example.com/reel.mp4",
});

test("worker selects English HostExplainer, retimes beats after TTS, returns script and duration", async (t) => {
  const root = await temporary(t);
  const job = await createQueuedJob(root, input());
  const rendered = [];
  await runOneJob(root, job.job_id, dependencies(rendered));
  const result = await readJob(root, job.job_id);
  assert.equal(result.status, "done", result.error);
  assert.equal(rendered.length, 1);
  assert.equal(compositionIdForProps(rendered[0]), "HostExplainer");
  assert.equal(rendered[0].locale, "en");
  assert.equal(rendered[0].aspect, "portrait");
  assert.equal(rendered[0].beats[0].endMs, 5000);
  assert.ok(rendered[0].beats[1].endMs > 5000);
  assert.equal(rendered[0].closingSubtitle, script.closing);
  const callback = buildCallbackPayload(result);
  assert.equal(callback.client_ref, "content-video:123");
  assert.equal(callback.script.cases[0].narration, script.cases[0].narration);
  assert.equal(callback.duration_seconds, 30);
  assert.equal(
    publicJobView(result).video_url,
    "https://cdn.example.com/reel.mp4",
  );
});

test("over-budget synthesized audio fails before rendering or upload", async (t) => {
  const root = await temporary(t);
  const job = await createQueuedJob(root, input());
  const rendered = [];
  await runOneJob(root, job.job_id, dependencies(rendered, 80));
  const result = await readJob(root, job.job_id);
  assert.equal(result.status, "failed");
  assert.match(result.error, /exceeds/);
  assert.equal(result.duration_seconds, 80);
  assert.equal(rendered.length, 0);
});

test("single post gives a second selected image a later case scene without cross-case images", () => {
  const second = "https://example.com/second.png";
  const props = singlePostProps(
    { ...post, images: [post.images[0], second] },
    script,
  );
  const multiLine = {
    ...script,
    cases: [
      {
        index: "01",
        narration:
          "The maker reports 12 users.\nThey launched a focused product.",
      },
    ],
  };
  const beats = finalizeBeats({ beats: [] }, multiLine, props);
  const caseBeats = beats.filter((beat) => beat.section === "case");
  assert.ok(
    caseBeats[0].elements.some(
      (element) => element.type === "image" && element.src === post.images[0],
    ),
  );
  assert.ok(
    caseBeats[1].elements.some(
      (element) => element.type === "image" && element.src === second,
    ),
  );
  assert.throws(() =>
    normalizeSinglePost({ ...post, images: Array(9).fill(second) }),
  );
});

test("startup recovery schedules persisted active jobs and excludes terminal jobs", async (t) => {
  const root = await temporary(t);
  const active = await createQueuedJob(root, input());
  await updateJob(root, active.job_id, { status: "rendering" });
  const completed = await createQueuedJob(root, {
    markdown: "# Weekly",
    callback_url: null,
  });
  await updateJob(root, completed.job_id, { status: "done" });
  const scheduled = [];
  assert.equal(
    await recoverRenderJobs(root, (jobRoot, id) =>
      scheduled.push([jobRoot, id]),
    ),
    1,
  );
  assert.deepEqual(scheduled, [[root, active.job_id]]);
});

test("queue suppresses duplicate recovery or HTTP enqueues while a job is pending", async () => {
  let calls = 0;
  const runner = async () => {
    calls += 1;
  };
  const first = enqueueRenderJob("test-root", "one-job", runner);
  const duplicate = enqueueRenderJob("test-root", "one-job", runner);
  await Promise.all([first, duplicate]);
  assert.equal(calls, 1);
});

test("all selected images appear even when one sentence has eight images, without splitting speech", async () => {
  const source = await readFile(new URL("../src/host-explainer/postGallery.ts", import.meta.url), "utf8");
  const { code } = await transform(source, { loader: "ts", format: "esm" });
  const { postGalleryElements } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const images = Array.from({ length: 8 }, (_, index) => `https://example.com/${index}.png`);
  const beat = {
    section: "case", caseIndex: 0, startMs: 1000, endMs: 9000,
    say: "One sentence with eight source images.",
    elements: [{ type: "image", src: images[0], focus: { x: 0, y: 0, width: 0.5, height: 0.5 } }],
  };
  const original = structuredClone(beat);
  const seen = images.map((_, index) => postGalleryElements(beat, [beat], [{ images }], 1500 + index * 1000)[0]);
  assert.deepEqual(seen.map((image) => image.src), images);
  assert.equal(seen[1].focus, undefined, "do not transfer first-image focus to a different image");
  assert.deepEqual(beat, original, "visual rotation must not change speech or subtitle timing");
  const intro = { ...beat, section: "intro", caseIndex: null, elements: [] };
  assert.deepEqual(postGalleryElements(intro, [intro, beat], [{ images }], 500), []);
  const single = [{ images: [images[0]] }];
  assert.deepEqual(postGalleryElements(beat, [beat], single, 4000), beat.elements);
});
