import {
  compositionIdForProps,
  assignBeatTiming,
  enrichBeatScenes,
} from "./beat-spec.mjs";
import { planBeats } from "./beat-planner.mjs";
import { withVerifiedHostEvidence } from "./host-evidence.mjs";
import {
  generateSinglePostScript,
  singlePostProps,
  synthesizedDurationSeconds,
} from "./single-post.mjs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateNarrationScript } from "./script-llm.mjs";
import { synthesizeVideoProps } from "./synthesize-props.mjs";
import { embedLocalAudioAsDataUrls } from "./embed-audio-data-urls.mjs";
import { loadMarkdownRuntime } from "./markdown-runtime.mjs";
import { uploadFileToQiniu, getQiniuConfig } from "./qiniu-upload.mjs";
import {
  activeJobIds,
  jobsRoot,
  nowIso,
  publicJobView,
  readJob,
  updateJob,
} from "./render-job-store.mjs";
import { normalizeRenderJobOptions } from "./render-job-options.mjs";

const DEFAULT_RENDER_API_KEY = "vidflow-remotion-shared-key-2026";

const CALLBACK_BACKOFF_MS = [2000, 10000, 60000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const webhookSecret = () =>
  process.env.RENDER_WEBHOOK_SECRET?.trim() ||
  process.env.RENDER_API_KEY?.trim() ||
  DEFAULT_RENDER_API_KEY;

export const signWebhookBody = (rawBody, secret = webhookSecret()) => {
  const hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${hex}`;
};

export const buildCallbackPayload = (job, extra = {}) => ({
  job_id: job.job_id,
  client_ref: job.client_ref,
  status: extra.status || job.status,
  progress: extra.progress ?? job.progress ?? (job.status === "done" ? 100 : 0),
  video_url:
    extra.video_url !== undefined
      ? extra.video_url
      : job.status === "done" ||
          extra.status === "partial" ||
          extra.status === "done"
        ? job.video_url
        : null,
  aspect: extra.aspect || job.options?.aspect || "portrait",
  error:
    (extra.status || job.status) === "failed"
      ? job.error || extra.error || null
      : null,
  script: job.script ?? null,
  duration_seconds: job.duration_seconds ?? null,
  finished_at: extra.finished_at || job.finished_at || nowIso(),
});

export const deliverCallback = async (root, jobId, extra = {}) => {
  let job = await readJob(root, jobId);
  if (!job?.callback_url) {
    return job;
  }

  const payload = buildCallbackPayload(job, extra);
  // Prefer explicit video_url for this aspect callback
  if (extra.video_url) {
    payload.video_url = extra.video_url;
  }
  const rawBody = JSON.stringify(payload);
  const signature = signWebhookBody(rawBody);
  const attempts = [...CALLBACK_BACKOFF_MS];
  let lastError = null;

  for (let i = 0; i <= attempts.length; i += 1) {
    try {
      const response = await fetch(job.callback_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Remotion-Signature": signature,
          "X-Remotion-Job-Id": job.job_id,
        },
        body: rawBody,
      });
      job = await updateJob(root, jobId, {
        callback_attempts: (job.callback_attempts || 0) + 1,
      });
      if (response.status >= 200 && response.status < 300) {
        return updateJob(root, jobId, {
          callback_status: "delivered",
          callback_last_error: null,
        });
      }
      lastError = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      job = await updateJob(root, jobId, {
        callback_attempts: (job.callback_attempts || 0) + 1,
      });
    }

    if (i < attempts.length) {
      await sleep(attempts[i]);
      job = await readJob(root, jobId);
    }
  }

  return updateJob(root, jobId, {
    callback_status: "failed",
    callback_last_error: lastError,
  });
};

const localRemotionCommand = (root) =>
  path.join(root, "node_modules", ".bin", "remotion");

const renderToPath = async (root, props, outputPath, propsPath) => {
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");
  const compositionId = compositionIdForProps(props);
  const command = localRemotionCommand(root);
  await new Promise((resolve, reject) => {
    const proc = spawn(
      command,
      [
        "render",
        compositionId,
        outputPath,
        `--props=${propsPath}`,
        "--public-dir=public",
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.slice(-2400) || `Remotion render failed with code ${code}`,
        ),
      );
    });
  });
};

const markdownHasFullNarration = async (root, markdown) => {
  const runtime = await loadMarkdownRuntime(root);
  const script = runtime.tryBuildScriptFromMarkdown(markdown);
  return Boolean(script && runtime.scriptIsComplete(script));
};

export const runOneJob = async (root, jobId, dependencies = {}) => {
  let job = await readJob(root, jobId);
  if (!job) {
    return;
  }

  const workDir = path.join(jobsRoot(root), jobId);
  await mkdir(workDir, { recursive: true });

  try {
    const generateSingle =
      dependencies.generateSinglePostScript || generateSinglePostScript;
    const synthesize =
      dependencies.synthesizeVideoProps || synthesizeVideoProps;
    const planner = dependencies.planBeats || planBeats;
    const render = dependencies.renderToPath || renderToPath;
    const upload = dependencies.uploadFileToQiniu || uploadFileToQiniu;
    const qiniuConfig = dependencies.getQiniuConfig || getQiniuConfig;
    const embedAudio =
      dependencies.embedLocalAudioAsDataUrls || embedLocalAudioAsDataUrls;
    const single = job.content_mode === "single_post";
    const optionsEarly = normalizeRenderJobOptions(job.options);
    const locale = optionsEarly.locale === "en" ? "en" : "zh";
    const runtime = single ? null : await loadMarkdownRuntime(root);
    let props = single
      ? { cases: [{}] }
      : runtime.parseMarkdownToVideo(job.markdown, { locale });
    if (!Array.isArray(props.cases) || props.cases.length === 0) {
      throw new Error("Markdown 未解析出案例段落");
    }

    const skipAi =
      !single &&
      (Boolean(job.options?.skip_ai_script) ||
        (await markdownHasFullNarration(root, job.markdown)));

    await updateJob(root, jobId, { status: "scripting" });

    let script;
    if (single) {
      script = await generateSingle(
        job.post,
        optionsEarly.target_duration_seconds || 45,
      );
    } else if (skipAi) {
      script =
        runtime.tryBuildScriptFromMarkdown(job.markdown, { locale }) ||
        runtime.buildScriptFromProps(props, "markdown", locale);
      if (!runtime.scriptIsComplete(script)) {
        throw new Error("skip_ai_script 已开启，但 Markdown 旁白不完整");
      }
    } else {
      script = await generateNarrationScript(props, {
        markdown: job.markdown,
        root,
        locale,
      });
    }
    props = single
      ? singlePostProps(job.post, script)
      : runtime.applyNarrationScript(props, script, locale);
    const options = optionsEarly;
    const aspects = options.aspects?.length
      ? options.aspects
      : [options.aspect];
    props.aspect = aspects[0];
    if (options.templateId || options.template_id) {
      props.templateId = options.templateId || options.template_id;
    }
    await updateJob(root, jobId, {
      script: {
        ...(script.title ? { title: script.title } : {}),
        intro: script.intro,
        cases: script.cases,
        closing: script.closing,
        source: script.source,
      },
      options,
    });
    await writeFile(
      path.join(workDir, "script.json"),
      JSON.stringify(script, null, 2),
      "utf8",
    );

    const { defaultVoiceForLocale, resolveVoiceId } =
      await import("./azure-voices.mjs");
    const voice = resolveVoiceId(
      options.voice?.trim(),
      defaultVoiceForLocale(locale),
    );
    await updateJob(root, jobId, { status: "synthesizing" });
    let enriched;
    const beats =
      props.templateId === "host"
        ? await planner(script, await withVerifiedHostEvidence(props, root))
        : null;
    const synth = await synthesize(props, { root, voice });
    enriched = synth.props;
    const durationSeconds = synthesizedDurationSeconds(enriched);
    await updateJob(root, jobId, { duration_seconds: durationSeconds });
    if (
      single &&
      durationSeconds > (options.target_duration_seconds || 45) * 1.25
    ) {
      throw new Error(
        `Narration duration ${durationSeconds.toFixed(1)}s exceeds the ${(options.target_duration_seconds || 45) * 1.25}s budget; shorten the source or regenerate`,
      );
    }
    if (beats)
      enriched.beats = assignBeatTiming(
        enrichBeatScenes(beats, enriched),
        enriched,
      );
    if (props.templateId) {
      enriched.templateId = props.templateId;
    }
    await writeFile(
      path.join(workDir, "props.json"),
      JSON.stringify(enriched, null, 2),
      "utf8",
    );

    const urlsByAspect = {};
    const { keyPrefix } = qiniuConfig();
    const renderPropsBase = await embedAudio(enriched, root);

    for (let i = 0; i < aspects.length; i += 1) {
      const aspect = aspects[i];
      const isLast = i === aspects.length - 1;
      await updateJob(root, jobId, {
        status: "rendering",
        progress: 50 + i * 15,
      });
      const outputPath = path.join(workDir, `out-${aspect}.mp4`);
      const propsPath = path.join(workDir, `render-props-${aspect}.json`);
      const renderProps = { ...renderPropsBase, aspect };
      await render(root, renderProps, outputPath, propsPath);

      await updateJob(root, jobId, {
        status: "uploading",
        progress: 70 + i * 15,
      });
      const objectKey = job.client_ref
        ? `${keyPrefix}/${job.client_ref}/${jobId}-${aspect}.mp4`
        : `${keyPrefix}/${jobId}-${aspect}.mp4`;
      const videoUrl = await upload(outputPath, objectKey);
      urlsByAspect[aspect] = videoUrl;

      const patch = {
        video_urls: { ...urlsByAspect },
      };
      if (aspect === "landscape") {
        patch.video_url = videoUrl;
      }
      if (aspect === "portrait") {
        patch.video_url_portrait = videoUrl;
      }
      if (i === 0 && aspect !== "landscape") {
        patch.video_url = videoUrl;
      }

      job = await updateJob(root, jobId, patch);

      const cbStatus = isLast ? "done" : "partial";
      const cbProgress = isLast
        ? 100
        : Math.round(((i + 1) / aspects.length) * 90);
      if (isLast) {
        job = await updateJob(root, jobId, {
          status: "done",
          progress: 100,
          error: null,
          finished_at: nowIso(),
        });
      }
      await deliverCallback(root, jobId, {
        status: cbStatus,
        aspect,
        video_url: videoUrl,
        progress: cbProgress,
        finished_at: nowIso(),
      });
    }

    if (job.status !== "done") {
      job = await updateJob(root, jobId, {
        status: "done",
        progress: 100,
        error: null,
        finished_at: nowIso(),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job = await updateJob(root, jobId, {
      status: "failed",
      error: message,
      finished_at: nowIso(),
    });
    await deliverCallback(root, jobId, {
      status: "failed",
      aspect: job.options?.aspect || "portrait",
      video_url: job.video_url || null,
      error: message,
      finished_at: nowIso(),
    });
    return;
  }
};

let queue = Promise.resolve();
const pendingIds = [];
const enqueuedKeys = new Set();
let running = false;

export const enqueueRenderJob = (root, jobId, runner = runOneJob) => {
  const key = JSON.stringify([root, jobId]);
  if (enqueuedKeys.has(key)) return queue;
  enqueuedKeys.add(key);
  pendingIds.push({ root, jobId, key, runner });
  queue = queue
    .then(async () => {
      running = true;
      try {
        while (pendingIds.length > 0) {
          const next = pendingIds.shift();
          if (next) {
            try {
              await next.runner(next.root, next.jobId);
            } finally {
              enqueuedKeys.delete(next.key);
            }
          }
        }
      } finally {
        running = false;
      }
    })
    .catch((error) => {
      console.error("[render-jobs] queue error", error);
    });
  return queue;
};

export const isRenderQueueBusy = () => running || pendingIds.length > 0;

export { publicJobView };

/** Requeue persisted work after restart; same-process duplicate enqueues are ignored. */
export const recoverRenderJobs = async (root, enqueue = enqueueRenderJob) => {
  const ids = await activeJobIds(root);
  for (const id of ids) enqueue(root, id);
  return ids.length;
};
