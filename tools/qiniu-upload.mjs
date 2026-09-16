import crypto from "node:crypto";
import { readFile } from "node:fs/promises";

const urlsafeB64 = (data) =>
  Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const getQiniuConfig = () => {
  const accessKey = process.env.QINIU_ACCESS_KEY?.trim() || "";
  const secretKey = process.env.QINIU_SECRET_KEY?.trim() || "";
  const bucket = process.env.QINIU_BUCKET?.trim() || "";
  const cdnDomain = process.env.QINIU_CDN_DOMAIN?.trim() || "";
  const keyPrefix = (
    process.env.QINIU_KEY_PREFIX?.trim() || "weekly-video"
  ).replace(/^\/+|\/+$/g, "");
  return { accessKey, secretKey, bucket, cdnDomain, keyPrefix };
};

export const ensureQiniuConfigured = () => {
  const config = getQiniuConfig();
  if (
    !config.accessKey ||
    !config.secretKey ||
    !config.bucket ||
    !config.cdnDomain
  ) {
    throw new Error(
      "七牛未配置：需要 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET / QINIU_CDN_DOMAIN",
    );
  }
  return config;
};

const uploadToken = (config, key, expires = 3600) => {
  const deadline = Math.floor(Date.now() / 1000) + expires;
  const scope = `${config.bucket}:${key}`;
  const policy = JSON.stringify({ scope, deadline });
  const encodedPolicy = urlsafeB64(policy);
  const sign = crypto
    .createHmac("sha1", config.secretKey)
    .update(encodedPolicy)
    .digest();
  const encodedSign = urlsafeB64(sign);
  return `${config.accessKey}:${encodedSign}:${encodedPolicy}`;
};

export const publicUrlForKey = (cdnDomain, key) => {
  let domain = cdnDomain.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(domain)) {
    domain = `https://${domain}`;
  }
  return `${domain}/${key.replace(/^\//, "")}`;
};

/**
 * Upload a local file to Qiniu via form upload. Returns the public CDN URL.
 */
export const uploadFileToQiniu = async (localPath, key) => {
  const config = ensureQiniuConfigured();
  const token = uploadToken(config, key);
  const bytes = await readFile(localPath);
  const form = new FormData();
  form.append("token", token);
  form.append("key", key);
  form.append("file", new Blob([bytes], { type: "video/mp4" }), key);

  const response = await fetch("https://upload.qiniup.com", {
    method: "POST",
    body: form,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`七牛上传失败：HTTP ${response.status} ${text.slice(0, 400)}`);
  }
  return publicUrlForKey(config.cdnDomain, key);
};
