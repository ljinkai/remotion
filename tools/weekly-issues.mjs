/**
 * List / load published weekly Markdown for the Remotion workbench.
 *
 * Sources (merged by issue number, local preferred when reading):
 * - Local content dirs (ezindie / soloez)
 * - Sibling git `origin/main` (when the working tree lags a private remote)
 * - GitHub Contents API + raw (optional; private repos need GITHUB_TOKEN)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const DEFAULT_LIMIT = 8;
const GIT_REMOTE_REFS = ["origin/main", "origin/master"];

const ZH_SOURCE = {
  id: "ezindie",
  locale: "zh",
  fileRe: /^issue-(\d+)\.md$/i,
  localEnv: "EZINDIE_WEEKLY_DIR",
  defaultLocalRel: ["../ezindie.com/content/weekly"],
  github: {
    ownerEnv: "EZINDIE_GITHUB_OWNER",
    repoEnv: "EZINDIE_GITHUB_REPO",
    pathEnv: "EZINDIE_GITHUB_PATH",
    defaultOwner: "ljinkai",
    defaultRepo: "ezindie.com",
    defaultPath: "content/weekly",
    fileName: (n) => `issue-${n}.md`,
  },
};

const EN_SOURCE = {
  id: "soloez",
  locale: "en",
  fileRe: /^soloez-(\d+)\.md$/i,
  localEnv: "SOLOEZ_WEEKLY_DIR",
  defaultLocalRel: ["../../soloez/content/weekly", "../soloez/content/weekly"],
  github: {
    ownerEnv: "SOLOEZ_GITHUB_OWNER",
    repoEnv: "SOLOEZ_GITHUB_REPO",
    pathEnv: "SOLOEZ_GITHUB_PATH",
    defaultOwner: "ljinkai",
    defaultRepo: "soloez",
    defaultPath: "content/weekly",
    fileName: (n) => `soloez-${n}.md`,
  },
};

const sourceForLocale = (locale) =>
  String(locale || "")
    .trim()
    .toLowerCase() === "en"
    ? EN_SOURCE
    : ZH_SOURCE;

const dirExists = async (dir) => {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
};

const resolveLocalDir = async (root, source) => {
  const fromEnv = process.env[source.localEnv]?.trim();
  if (fromEnv) {
    const abs = path.resolve(fromEnv);
    if (await dirExists(abs)) {
      return abs;
    }
  }
  for (const rel of source.defaultLocalRel) {
    const abs = path.resolve(root, rel);
    if (await dirExists(abs)) {
      return abs;
    }
  }
  return null;
};

const gitToplevel = async (cwd) => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd },
    );
    const root = stdout.trim();
    return root || null;
  } catch {
    return null;
  }
};

const listGitRefIssues = async (localDir, source) => {
  if (!localDir) {
    return [];
  }
  const gitRoot = await gitToplevel(localDir);
  if (!gitRoot) {
    return [];
  }
  const relDir = path.relative(gitRoot, localDir).replaceAll("\\", "/");
  for (const ref of GIT_REMOTE_REFS) {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["ls-tree", "-r", "--name-only", ref, "--", relDir || "."],
        { cwd: gitRoot },
      );
      const items = [];
      for (const line of stdout.split("\n")) {
        const filename = path.basename(line.trim());
        const match = filename.match(source.fileRe);
        if (!match) {
          continue;
        }
        const issue = Number(match[1]);
        if (!Number.isFinite(issue)) {
          continue;
        }
        items.push({
          issue,
          title: `${source.id} #${issue}`,
          description: "",
          source: "git",
          filename,
        });
      }
      if (items.length > 0) {
        return items;
      }
    } catch {
      // try next ref
    }
  }
  return [];
};

const readGitRefMarkdown = async (localDir, source, issue) => {
  if (!localDir) {
    return null;
  }
  const gitRoot = await gitToplevel(localDir);
  if (!gitRoot) {
    return null;
  }
  const relFile = path
    .join(path.relative(gitRoot, localDir), source.github.fileName(issue))
    .replaceAll("\\", "/");
  for (const ref of GIT_REMOTE_REFS) {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${ref}:${relFile}`],
        { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 },
      );
      if (stdout) {
        return stdout;
      }
    } catch {
      // try next ref
    }
  }
  return null;
};

const githubConfig = (source) => {
  const g = source.github;
  return {
    owner: process.env[g.ownerEnv]?.trim() || g.defaultOwner,
    repo: process.env[g.repoEnv]?.trim() || g.defaultRepo,
    dir: process.env[g.pathEnv]?.trim() || g.defaultPath,
    fileName: g.fileName,
  };
};

const githubHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "remotion-workbench",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const parseTitleFromMarkdown = (markdown) => {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1) {
    return h1[1].trim();
  }
  const title = text.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return title ? title[1].trim() : "";
};

const parseDescriptionFromMarkdown = (markdown) => {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const desc = text.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return desc ? desc[1].trim() : "";
};

const enrichGitIssueMeta = async (localDir, source, items, limit) => {
  const pending = [...items]
    .sort((a, b) => b.issue - a.issue)
    .slice(0, limit);
  await Promise.all(
    pending.map(async (item) => {
      const markdown = await readGitRefMarkdown(localDir, source, item.issue);
      if (!markdown) {
        return;
      }
      item.title = parseTitleFromMarkdown(markdown) || item.title;
      item.description =
        parseDescriptionFromMarkdown(markdown) || item.description;
    }),
  );
};

const listLocalIssues = async (dir, source) => {
  if (!dir) {
    return [];
  }
  const names = await readdir(dir);
  const items = [];
  for (const name of names) {
    const match = name.match(source.fileRe);
    if (!match) {
      continue;
    }
    const issue = Number(match[1]);
    if (!Number.isFinite(issue)) {
      continue;
    }
    let title = "";
    let description = "";
    try {
      const raw = await readFile(path.join(dir, name), "utf8");
      title = parseTitleFromMarkdown(raw);
      description = parseDescriptionFromMarkdown(raw);
    } catch {
      // ignore unreadable file
    }
    items.push({
      issue,
      title: title || `${source.id} #${issue}`,
      description,
      source: "local",
      filename: name,
    });
  }
  return items;
};

const listGithubIssues = async (source) => {
  const { owner, repo, dir } = githubConfig(source);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}`;
  try {
    const response = await fetch(url, { headers: githubHeaders() });
    if (!response.ok) {
      return [];
    }
    const entries = await response.json();
    if (!Array.isArray(entries)) {
      return [];
    }
    const items = [];
    for (const entry of entries) {
      if (!entry || entry.type !== "file" || typeof entry.name !== "string") {
        continue;
      }
      const match = entry.name.match(source.fileRe);
      if (!match) {
        continue;
      }
      const issue = Number(match[1]);
      if (!Number.isFinite(issue)) {
        continue;
      }
      items.push({
        issue,
        title: `${source.id} #${issue}`,
        description: "",
        source: "github",
        filename: entry.name,
      });
    }
    return items;
  } catch {
    return [];
  }
};

const mergeIssues = (localItems, remoteItems, limit) => {
  const byIssue = new Map();
  for (const item of remoteItems) {
    byIssue.set(item.issue, item);
  }
  for (const item of localItems) {
    const prev = byIssue.get(item.issue);
    byIssue.set(item.issue, {
      ...prev,
      ...item,
      title:
        item.title && !item.title.startsWith(`${item.source || "x"} #`)
          ? item.title
          : prev?.title && !String(prev.title).match(/^(ezindie|soloez) #\d+$/)
            ? prev.title
            : item.title,
      description: item.description || prev?.description || "",
      source: "local",
    });
  }
  return [...byIssue.values()]
    .sort((a, b) => b.issue - a.issue)
    .slice(0, limit)
    .map(({ issue, title, description, source, filename }) => ({
      issue,
      title,
      description,
      source,
      filename,
    }));
};

const ensureLocaleFrontmatter = (markdown, locale, issue) => {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    const extras = [
      `issue: ${issue}`,
      `locale: ${locale}`,
    ].join("\n");
    return `---\n${extras}\n---\n${text}`;
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return text;
  }
  let fm = text.slice(4, end);
  const rest = text.slice(end + 5);
  if (!/^issue:\s*/m.test(fm)) {
    fm = `${fm.replace(/\s+$/, "")}\nissue: ${issue}`;
  }
  if (/^locale:\s*/m.test(fm)) {
    fm = fm.replace(/^locale:\s*.*$/m, `locale: ${locale}`);
  } else {
    fm = `${fm.replace(/\s+$/, "")}\nlocale: ${locale}`;
  }
  return `---\n${fm}\n---\n${rest}`;
};

const MAX_COVER_IMAGES = 3;

const isRenderedCoverUrl = (url) =>
  /weekly-covers(?:-en)?\//i.test(url) || /\/covers?\//i.test(url);

const isTranslationCardUrl = (url) => /translation-cards?\//i.test(url);

/** Collect https image URLs from a section body (markdown + HTML img). */
const collectSectionImageUrls = (body) => {
  const text = String(body || "");
  const urls = [];
  const seen = new Set();
  const push = (raw) => {
    const url = String(raw || "").trim();
    if (!url.startsWith("https://") || seen.has(url) || isRenderedCoverUrl(url)) {
      return;
    }
    seen.add(url);
    urls.push(url);
  };
  for (const match of text.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    push(match[1]);
  }
  for (const match of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    push(match[1]);
  }
  return urls;
};

/**
 * Pick 1–3 magazine backdrop URLs from published weekly MD (same spirit as
 * VidFlow cover collage): one primary image per ## section.
 * ZH prefers translation cards; EN skips them.
 */
export const extractCoverImagesFromMarkdown = (markdown, locale = "zh") => {
  const isEn = String(locale || "zh").toLowerCase().startsWith("en");
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const bodyStart = text.startsWith("---\n")
    ? (() => {
        const end = text.indexOf("\n---\n", 4);
        return end === -1 ? 0 : end + 5;
      })()
    : 0;
  const body = text.slice(bodyStart);
  const sections = body.split(/\n(?=##\s+)/);
  const out = [];
  const seen = new Set();

  for (const section of sections) {
    if (!/^##\s+/m.test(section)) {
      continue;
    }
    // Skip closing / toc-like headings
    const heading = (section.match(/^##\s+(.+)$/m) || [])[1] || "";
    if (/目录|contents|takeaway|一句话总结|总结|closing/i.test(heading)) {
      continue;
    }
    const urls = collectSectionImageUrls(section);
    if (urls.length === 0) {
      continue;
    }
    let pick = "";
    if (isEn) {
      pick =
        urls.find((u) => !isTranslationCardUrl(u)) ||
        urls[0];
    } else {
      pick =
        urls.find((u) => isTranslationCardUrl(u)) ||
        urls[0];
    }
    if (!pick || seen.has(pick)) {
      continue;
    }
    seen.add(pick);
    out.push(pick);
    if (out.length >= MAX_COVER_IMAGES) {
      break;
    }
  }
  return out;
};

/** Insert or replace cover_images in YAML frontmatter. */
export const injectCoverImagesFrontmatter = (markdown, coverUrls) => {
  const urls = (coverUrls || [])
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith("https://"))
    .slice(0, MAX_COVER_IMAGES);
  if (urls.length === 0) {
    return String(markdown || "");
  }
  const line = `cover_images: ${urls.join(" ")}`;
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    return `---\n${line}\n---\n${text}`;
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return text;
  }
  let fm = text.slice(4, end);
  const rest = text.slice(end + 5);
  if (/^cover_images:\s*/m.test(fm)) {
    fm = fm.replace(/^cover_images:\s*.*$/m, line);
  } else {
    fm = `${fm.replace(/\s+$/, "")}\n${line}`;
  }
  // Prefer description as theme when theme missing (scheme-1 hook)
  if (!/^theme:\s*\S/m.test(fm)) {
    const rawDesc = (fm.match(/^description:\s*(.+)$/m) || [])[1] || "";
    let theme = rawDesc.trim();
    if (
      (theme.startsWith('"') && theme.endsWith('"')) ||
      (theme.startsWith("'") && theme.endsWith("'"))
    ) {
      theme = theme.slice(1, -1).trim();
    }
    if (theme) {
      fm = `${fm.replace(/\s+$/, "")}\ntheme: ${theme}`;
    }
  }
  return `---\n${fm}\n---\n${rest}`;
};

const readLocalMarkdown = async (dir, source, issue) => {
  if (!dir) {
    return null;
  }
  const filename = source.github.fileName(issue);
  try {
    return await readFile(path.join(dir, filename), "utf8");
  } catch {
    return null;
  }
};

const readGithubMarkdown = async (source, issue) => {
  const { owner, repo, dir, fileName } = githubConfig(source);
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${dir}/${fileName(issue)}`;
  try {
    const response = await fetch(rawUrl, {
      headers: { "User-Agent": "remotion-workbench" },
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
};

export const listRecentWeeklyIssues = async (root, options = {}) => {
  const locale =
    String(options.locale || "zh")
      .trim()
      .toLowerCase() === "en"
      ? "en"
      : "zh";
  const limit = Math.min(
    30,
    Math.max(1, Number(options.limit) || DEFAULT_LIMIT),
  );
  const source = sourceForLocale(locale);
  const localDir = await resolveLocalDir(root, source);
  const [localItems, githubItems, gitItems] = await Promise.all([
    listLocalIssues(localDir, source),
    listGithubIssues(source),
    listGitRefIssues(localDir, source),
  ]);
  await enrichGitIssueMeta(localDir, source, gitItems, limit);
  const issues = mergeIssues(localItems, [...githubItems, ...gitItems], limit);
  return {
    locale,
    catalog: source.id,
    localDir,
    issues,
  };
};

/**
 * Prefer editor-selected collage URLs from VidFlow when available.
 * Requires VIDFLOW_API_BASE (e.g. https://vidflow.zeabur.app).
 * Optional VIDFLOW_API_KEY / EXTENSION_API_KEY → X-API-Key (if endpoint is auth-gated).
 */
export const fetchVidflowCoverBgUrls = async (issueNumber, locale = "zh") => {
  const base = String(process.env.VIDFLOW_API_BASE || "")
    .trim()
    .replace(/\/$/, "");
  if (!base) {
    return { urls: [], source: "unset" };
  }
  const loc =
    String(locale || "zh")
      .trim()
      .toLowerCase() === "en"
      ? "en"
      : "zh";
  const n = Number(issueNumber);
  if (!Number.isFinite(n) || n <= 0) {
    return { urls: [], source: "invalid" };
  }
  const apiKey = String(
    process.env.VIDFLOW_API_KEY || process.env.EXTENSION_API_KEY || "",
  ).trim();
  try {
    const headers = { "User-Agent": "remotion-workbench" };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }
    const response = await fetch(
      `${base}/api/weekly/by-number/${n}/cover-bg?locale=${loc}`,
      { headers },
    );
    if (!response.ok) {
      return { urls: [], source: `http_${response.status}` };
    }
    const body = await response.json();
    const urls = Array.isArray(body.cover_bg_urls)
      ? body.cover_bg_urls
          .map((u) => String(u || "").trim())
          .filter((u) => u.startsWith("https://"))
          .slice(0, MAX_COVER_IMAGES)
      : [];
    return {
      urls,
      source: urls.length > 0 ? body.source || "vidflow" : "vidflow_empty",
    };
  } catch {
    return { urls: [], source: "error" };
  }
};

export const loadWeeklyIssueMarkdown = async (root, issueNumber, options = {}) => {
  const locale =
    String(options.locale || "zh")
      .trim()
      .toLowerCase() === "en"
      ? "en"
      : "zh";
  const issue = Number(issueNumber);
  if (!Number.isFinite(issue) || issue <= 0) {
    throw new Error("无效期号");
  }
  const source = sourceForLocale(locale);
  const localDir = await resolveLocalDir(root, source);
  let markdown = await readLocalMarkdown(localDir, source, issue);
  let from = "local";
  if (!markdown) {
    markdown = await readGitRefMarkdown(localDir, source, issue);
    from = "git";
  }
  if (!markdown) {
    markdown = await readGithubMarkdown(source, issue);
    from = "github";
  }
  if (!markdown) {
    throw new Error(
      `未找到 ${locale === "en" ? "soloez" : "ezindie"} 第 ${issue} 期 Markdown`,
    );
  }
  let prepared = ensureLocaleFrontmatter(markdown, locale, issue);

  const fromVidflow = await fetchVidflowCoverBgUrls(issue, locale);
  let coverImages = fromVidflow.urls;
  let coverSource = fromVidflow.source;
  // Only fall back to MD body images when VidFlow is unreachable — never when
  // the editor simply has no saved 拼贴背景 (that would show the wrong cover).
  const vidflowReachable =
    coverSource !== "unset" &&
    coverSource !== "error" &&
    coverSource !== "invalid" &&
    !String(coverSource).startsWith("http_");
  if (coverImages.length === 0 && !vidflowReachable) {
    coverImages = extractCoverImagesFromMarkdown(prepared, locale);
    coverSource = coverImages.length > 0 ? "markdown" : "empty";
  }
  prepared = injectCoverImagesFrontmatter(prepared, coverImages);
  return {
    locale,
    issue,
    source: from,
    catalog: source.id,
    title: parseTitleFromMarkdown(prepared),
    description: parseDescriptionFromMarkdown(prepared),
    coverImages,
    coverSource,
    markdown: prepared,
  };
};
