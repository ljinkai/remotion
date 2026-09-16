import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  await writeFile(jobPath(root, job.job_id), JSON.stringify(job, null, 2), "utf8");
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
  { markdown, client_ref, callback_url, options },
) => {
  const job_id = createJobId();
  const created_at = nowIso();
  const job = {
    job_id,
    client_ref: client_ref ?? null,
    callback_url,
    markdown,
    options: options || {},
    status: "queued",
    progress: 0,
    video_url: null,
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
  await writeFile(path.join(jobDir(root, job_id), "input.md"), markdown, "utf8");
  return job;
};

export const publicJobView = (job) => ({
  job_id: job.job_id,
  client_ref: job.client_ref,
  status: job.status,
  progress: job.progress ?? 0,
  video_url: job.video_url ?? null,
  script: job.script ?? null,
  error: job.error ?? null,
  callback_status: job.callback_status ?? null,
  created_at: job.created_at,
  finished_at: job.finished_at ?? null,
  updated_at: job.updated_at,
});

export const isActiveStatus = (status) => ACTIVE_STATUSES.has(status);
