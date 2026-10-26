import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ACTIVE_STATUSES = new Set([
  "queued",
  "scripting",
  "synthesizing",
  "rendering",
  "uploading",
]);

export const jobsRoot = (root) => path.join(root, ".workbench", "jobs");

const jobDir = (root, jobId) => path.join(jobsRoot(root), jobId);
const jobPath = (root, jobId) => path.join(jobDir(root, jobId), "job.json");

export const createJobId = () => randomUUID();

export const nowIso = () => new Date().toISOString();

export const progressForStatus = (status) => {
  switch (status) {
    case "queued":
      return 0;
    case "scripting":
      return 10;
    case "synthesizing":
      return 35;
    case "rendering":
      return 60;
    case "uploading":
      return 85;
    case "done":
      return 100;
    default:
      return 0;
  }
};

export const readJob = async (root, jobId) => {
  try {
    const raw = await readFile(jobPath(root, jobId), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeJob = async (root, job) => {
  const dir = jobDir(root, job.job_id);
  await mkdir(dir, { recursive: true });
  const temporaryPath = path.join(dir, `job-${randomUUID()}.tmp`);
  await writeFile(temporaryPath, JSON.stringify(job, null, 2), "utf8");
  await rename(temporaryPath, jobPath(root, job.job_id));
  return job;
};

export const updateJob = async (root, jobId, patch) => {
  const current = await readJob(root, jobId);
  if (!current) {
    throw new Error(`Job not found: ${jobId}`);
  }
  const next = {
    ...current,
    ...patch,
    updated_at: nowIso(),
  };
  if (patch.status && patch.progress === undefined) {
    if (patch.status === "failed") {
      next.progress = current.progress ?? 0;
    } else {
      next.progress = progressForStatus(patch.status);
    }
  }
  return writeJob(root, next);
};

export const createQueuedJob = async (
  root,
  {
    markdown = "",
    content_mode = "weekly",
    post = null,
    client_ref,
    callback_url,
    options,
  },
) => {
  const job_id = createJobId();
  const created_at = nowIso();
  const job = {
    job_id,
    client_ref: client_ref ?? null,
    callback_url,
    markdown,
    content_mode,
    post,
    options: options || {},
    status: "queued",
    progress: 0,
    video_url: null,
    cover_url: null,
    script: null,
    error: null,
    callback_status: "pending",
    callback_attempts: 0,
    callback_last_error: null,
    created_at,
    updated_at: created_at,
    finished_at: null,
  };
  await writeJob(root, job);
  await writeFile(
    path.join(jobDir(root, job_id), "input.md"),
    markdown,
    "utf8",
  );
  return job;
};

export const publicJobView = (job) => ({
  job_id: job.job_id,
  client_ref: job.client_ref,
  status: job.status,
  progress: job.progress ?? 0,
  aspect: job.options?.aspect || "portrait",
  video_url: job.video_url ?? null,
  cover_url: job.cover_url ?? null,
  script: job.script ?? null,
  duration_seconds: job.duration_seconds ?? null,
  content_mode: job.content_mode || "weekly",
  error: job.error ?? null,
  callback_status: job.callback_status ?? null,
  created_at: job.created_at,
  finished_at: job.finished_at ?? null,
  updated_at: job.updated_at,
});

export const isActiveStatus = (status) => ACTIVE_STATUSES.has(status);

// Serialize same-process creates, then consult persisted jobs so HTTP retries and
// VidFlow restarts keep the original paid render. The service has one worker process.
const creationLocks = new Map();
export const createOrReuseQueuedJob = async (root, input) => {
  if (input.content_mode !== "single_post" || !input.client_ref) {
    return { job: await createQueuedJob(root, input), created: true };
  }
  const key = JSON.stringify([root, input.client_ref]);
  const previous = creationLocks.get(key) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      let entries = [];
      try {
        entries = await readdir(jobsRoot(root));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      for (const id of entries) {
        const existing = await readJob(root, id);
        if (
          existing?.content_mode === "single_post" &&
          existing.client_ref === input.client_ref
        ) {
          if (
            JSON.stringify(existing.post) !== JSON.stringify(input.post) ||
            JSON.stringify(existing.options) !== JSON.stringify(input.options)
          ) {
            throw new Error(
              "client_ref already exists with different content or options",
            );
          }
          return { job: existing, created: false };
        }
      }
      return { job: await createQueuedJob(root, input), created: true };
    });
  creationLocks.set(key, current);
  try {
    return await current;
  } finally {
    if (creationLocks.get(key) === current) creationLocks.delete(key);
  }
};

export const activeJobIds = async (root) => {
  let ids;
  try {
    ids = await readdir(jobsRoot(root));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const jobs = await Promise.all(ids.map((id) => readJob(root, id)));
  return jobs
    .filter((job) => job && isActiveStatus(job.status))
    .map((job) => job.job_id);
};
