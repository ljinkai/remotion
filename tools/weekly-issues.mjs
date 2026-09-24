/**
 * List / load published weekly Markdown for the Remotion workbench.
 *
 * Sources (merged by issue number, local preferred when reading):
 * - Local content dirs (ezindie / soloez)
 * - GitHub Contents API + raw (optional freshness when local lags)
 */
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LIMIT = 8;

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

const mergeIssues = (localItems, githubItems, limit) => {
  const byIssue = new Map();
  for (const item of githubItems) {
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
  const [localItems, githubItems] = await Promise.all([
    listLocalIssues(localDir, source),
    listGithubIssues(source),
  ]);
  const issues = mergeIssues(localItems, githubItems, limit);
  return {
    locale,
    catalog: source.id,
    localDir,
    issues,
  };
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
    markdown = await readGithubMarkdown(source, issue);
    from = "github";
  }
  if (!markdown) {
    throw new Error(
      `未找到 ${locale === "en" ? "soloez" : "ezindie"} 第 ${issue} 期 Markdown`,
    );
  }
  const prepared = ensureLocaleFrontmatter(markdown, locale, issue);
  return {
    locale,
    issue,
    source: from,
    catalog: source.id,
    title: parseTitleFromMarkdown(prepared),
    description: parseDescriptionFromMarkdown(prepared),
    markdown: prepared,
  };
};
