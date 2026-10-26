import { getScriptLlmConfig } from "./script-llm.mjs";
import { finalizeBeats, narrationLines } from "./beat-spec.mjs";

const stripCodeFence = (text) => {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const extractJsonObject = (text) => {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("模型返回的不是合法 JSON");
  }
};

const caseContext = (props) =>
  (props?.cases || []).map((item, index) => ({
    index,
    title: item.title || "",
    metric: item.metric || "",
    image: item.image || "",
    allowedImages: [
      ...new Set(
        [item.image, ...(Array.isArray(item.images) ? item.images : [])].filter(
          Boolean,
        ),
      ),
    ],
    author: item.author || "",
    sourceBody: item.sourceBody || "",
    reviewedImageEvidence: Array.isArray(props.hostEvidence)
      ? props.hostEvidence.find((profile) => profile.image === item.image) ||
        null
      : null,
  }));

export const buildBeatPrompt = (script, props) => {
  const lines = narrationLines(script).map((line, index) => ({
    index,
    section: line.section,
    caseIndex: line.caseIndex,
    say: line.say,
  }));
  const english = props?.locale === "en";
  return `${english ? "LANGUAGE: English. All generated headlines, accents, titles, item labels, notes and captions MUST be in English, copied from the English source. Do not translate English narration or emit Chinese display text. Preserve whole words and all source units.\n\n" : ""}把逐字稿每一行变成一条叙事分镜，设计视频中间内容区。保留每行原始说法和顺序，按实际信息选择主视觉与辅助信息，不强制卡片网格。

规则：
- beats 长度必须等于行数，顺序一致。say 原样复制，禁止合并、拆分或改写行。
- 每条提供 scene：product（产品展示）、metric（真实指标）、steps（真实操作步骤）、statement（能力或结论）、relationship（真实关系或策略聚焦）。选择应来自句子的叙事作用，不能只看“自动”“应用”等单个词就画手机。
- 使用一个主要内容元素，可加辅助文字或图形，总计1到4个元素。元素可用 text、card、image、bar、phone、icon、svg、chart、relationship、explanation，不添加未定义字段。
- 同一案例的第一行，只要案例有 image，必须展示该案例给定的 image，不要求口播出现“截图”。若首句已是明确指标，保留 metric 主视觉并配 image 辅助；否则使用 product；每个有图片的案例至少一条展示图片。其他场景也可保留图片作辅助，不要丢掉原素材。
- image.src 只能使用当前 caseIndex 的 allowedImages（没有时使用 image），禁止跨案例借图、猜测网址。同一单帖可在后续分镜选择其他给定图片，第一句仍展示首张 image。intro/closing没有案例归属，不附案例图片。
- product：已有图片作为主视觉，配摘自原文的简短产品定位。保留产品图片本身，不以虚构界面代替。
- metric：仅当句子或当前案例 metric 有明确数字及单位时使用。用 xl text 完整展示原数字、币种/单位/统计口径。没有已给出的参照范围，不生成 bar.max；没有真实时间序列，不生成 card.bars。不要把单个收入数字编成增长趋势或对比数据。
- chart：{type:"chart",chartType:"single|comparison|milestones",title:"原指标标题",unit:"原单位或MRR/ARR口径",data:[{label:"原文实体或阶段",value:真实值,display:"保留倍率单位和+下界的原显示值",note:"可选原文说明"}],source:"原文来源"}。single只有一个真实值；comparison每个标签和值必须在同一原文分句，且原文明示对比；milestones须有真实阶段及对应数据，不能编日期。MRR和ARR严格分开。没有已知总量不画比例，本轮不输出proportion。
- reviewedImageEvidence 是人工核对且绑定原图片哈希的资料，不是自动OCR。可复用其 chart、focus、relationship；不能声称其他未核对的图片自动识别出了数值。若当句为年收入，图表复用MRR阶段时明确图表独立的月收入单位及原图来源，不能画成ARR增长。
- relationship：{type:"relationship",title:"原关系概括",nodes:["原文实体"],focus:0,mode:"focus|flow"}。节点必须出现在当前口播、案例sourceBody或已核对原图资料；至少两个。策略“聚焦一个渠道”用focus；真实流量进入交易可用flow，只画原文给出的实体，不加虚构点击量、人数或漏斗转化率。
- image可增加focus:{x:0到1,y:0到1,width:0到1,height:0到1,label:"区域说明"}，矩形必须在图片内，优先复用reviewedImageEvidence.focus。始终保留原图，不用裁剪取代完整来源图。
- steps：仅在本句给出至少两个真实动作步骤时使用 card.lines，按顺序摘取原句动作短语。不能把“自动发布”扩写成“打开、输入、点击、完成”。步骤不足使用 statement。phone仅在原句明确谈手机界面时使用，不作为通用步骤模板。
- statement：用主要 text 展示核心判断，可加一张简短 card 摘录支持短语，避免重复塞满多个一样的卡片。
- explanation：{type:"explanation",layout:"flow|features|contrast|spotlight",title:"本句原文短语",items:[{label:"原文连续短语",detail:"可选的原文连续说明"}]}。中间区域优先用这种内容解释版式，避免只有一条小引用。flow仅在原文有明确步骤、输入输出或方向连接时使用；features展示明确并列功能；contrast必须真实给出两侧对照且保留否定词；信息不足用spotlight，不能编造界面、功能、数据或因果。每项label/detail均原文摘取，2到4项，spotlight可1项；文字不裁成半句话。相邻同case句仅用于明确连接的对照，不把案例标题对所有句套同一图。explanation主画面使用scene:"statement"，已有原图可作为第二个元素保留，首句产品原图及真实chart继续优先。
- 所有文字和数据必须来自本句、当前案例标题或指标。数字不能编造、换算成未经说明的单位或补齐假数据。
- icon.name 只能 chart、phone、coin、user、arrow、check、wave；只作辅助。svg 不使用 script、外链、foreignObject。
- ${english ? "Headline: at most 12 English words / 72 characters, ending at a whole-word boundary; never apply the Chinese 18-character cap." : "headline不超过18字"}，accent必须是headline子串。host为point或cheer。
- 输出 JSON：{"beats":[{"say":"","headline":"","accent":"","host":"point","scene":"statement","elements":[]}]}
- text：{type:"text",text:"原文短语",size:"m|l|xl"}；card：{type:"card",title:"短标题",lines:["原文短语"]}；image：{type:"image",src:"当前案例image",caption:"短标题"}；bar：{type:"bar",label:"原指标单位",to:原数字,note:"原指标"}。

行：
${JSON.stringify(lines, null, 2)}

案例：
${JSON.stringify(caseContext(props), null, 2)}`;
};

const callPlanner = async (config, prompt) => {
  const response = await globalThis.fetch(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "你为口播视频写分镜 JSON。只输出一个 JSON 对象，不要 Markdown。不要编造数字或图片地址。",
          },
          { role: "user", content: prompt },
        ],
      }),
    },
  );
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(
      `千问接口返回非 JSON（HTTP ${response.status}）：${bodyText.slice(0, 400)}`,
    );
  }
  if (!response.ok) {
    const message =
      body?.error?.message || body?.message || bodyText.slice(0, 400);
    throw new Error(`千问接口失败（HTTP ${response.status}）：${message}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("千问接口未返回 message.content");
  }
  return content;
};

export const planBeats = async (script, props) => {
  if (!script || typeof script !== "object") {
    throw new Error("缺少逐字稿");
  }
  const lines = narrationLines(script);
  if (lines.length === 0) {
    throw new Error("逐字稿没有可生成分镜的句子");
  }
  const config = getScriptLlmConfig();
  let lastError;
  let malformedContent = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    malformedContent = false;
    try {
      const content = await callPlanner(config, buildBeatPrompt(script, props));
      try {
        return finalizeBeats(extractJsonObject(content), script, props);
      } catch (error) {
        malformedContent = true;
        throw error;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (malformedContent) return finalizeBeats([], script, props);
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "生成分镜失败"));
};
