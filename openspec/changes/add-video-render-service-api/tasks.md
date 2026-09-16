## 1. 服务骨架与鉴权

- [x] 1.1 增加 `/api/v1/health`、`POST /api/v1/render-jobs`、可选 `GET /api/v1/render-jobs/:id`
- [x] 1.2 `RENDER_API_KEY` 校验（Bearer / X-Api-Key）；服务模式强制 `callback_url`
- [x] 1.3 Job 落盘 `.workbench/jobs/{id}/job.json` + 状态机字段（含 callback 投递状态）

## 2. 流水线编排

- [x] 2.1 Worker：queued → scripting → synthesizing → rendering → uploading → done/failed
- [x] 2.2 复用千问逐字稿、Azure TTS、Remotion render；全局串行锁
- [x] 2.3 支持 `skip_ai_script` / MD 旁白齐全跳过千问
- [x] 2.4 回写 `client_ref`、可选 `script` 摘要到 job 结果

## 3. Webhook 出站

- [x] 3.1 终态 POST `callback_url`：HMAC 签名头 + JSON 载荷
- [x] 3.2 非 2xx 退避重试；记录 `callback_status`
- [x] 3.3 done/failed 均回调（失败带 error）

## 4. 七牛上传

- [x] 4.1 Node 七牛 form 上传（HMAC token），读 `QINIU_*`
- [x] 4.2 成功后写 `video_url` 再回调；上传失败标 failed 并回调

## 5. 配置与部署

- [x] 5.1 `.env.example` / README：API Key、Speech、千问、七牛、callback 示例
- [x] 5.2 Docker/Zeabur 说明：服务端口与必需环境变量
- [x] 5.3 `openspec validate add-video-render-service-api --strict`
- [ ] 5.4 人工：创建 job → Remotion 回调 mock hook → 收到 CDN URL
