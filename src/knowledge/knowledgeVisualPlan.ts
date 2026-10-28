export type KnowledgeVisualPlan = {
  kind:
    | "acquisition"
    | "hub"
    | "timelines"
    | "collaboration"
    | "workbench"
    | "practice";
  title: string;
  labels: string[];
  qualifier: string;
  operator?: string;
};
/** Select only from this chapter's actual narration. Illustrations never assert measured outcomes. */
export const knowledgeVisualPlan = (
  text: string,
  locale: "zh" | "en" = "zh",
): KnowledgeVisualPlan | null => {
  const en = locale === "en";
  const has = (pattern: RegExp) => pattern.test(text);
  const aiSupported =
    has(/\bAI\b|人工智能|Claude/i) &&
    !has(
      /(?:没有|不使用|不采用|不引入|不让|未接入|不需要|无需)[^。.!?\n]{0,12}(?:AI|人工智能|Claude)|(?:AI|人工智能|Claude)\s*(?:不参与|未参与|没有参与)|no\s+AI|without\s+AI|AI\s+(?:does not|is not|never)/i,
    );
  const acquisitionUncertain = has(
    /(?:不|未|不会|不打算|无意|没有|并非|否认|拟|计划|考虑|可能|假如|如果|若|一旦|尚未)[^。.!?\n]{0,20}收购|未证实|传闻|\b(?:if|would|could|might|may|seeking|seek|plans?|considering|denies|deny|proposed|rumou?r|not|never)\b[^.!?\n]{0,100}\b(?:acquir\w*|acquisition)\b|\b(?:acquir\w*|acquisition)\b[^.!?\n]{0,30}\b(?:unconfirmed|rumou?r|denied)\b/i,
  );
  const make = (
    kind: KnowledgeVisualPlan["kind"],
    title: string,
    labels: string[],
    qualifier = en ? "Conceptual illustration" : "理解示意",
  ) => ({ kind, title, labels, qualifier });
  if (
    !has(/反复出现|repeatable|recurring/i) &&
    has(/收购|acqui(?:re|red|sition)/i) &&
    !acquisitionUncertain
  ) {
    const direct = text.match(
      /\b([A-Z][\w-]*(?: [A-Z][\w-]*)?)\s+(?:acquired|acquires)\s+([A-Z][\w-]*(?: [A-Z][\w-]*)?)/,
    );
    const buyer =
      direct?.[1] ||
      (has(/\bAnthropic\b/) ? "Anthropic" : en ? "Acquirer" : "收购方");
    const target =
      direct?.[2] ||
      (has(/\bMithril Medicine\b/)
        ? "Mithril Medicine"
        : en
          ? "Acquired company"
          : "被收购公司");
    const labels = [buyer, target];
    const operator = has(/Cody Tranbarger/)
      ? "Cody Tranbarger"
      : has(/创始人|核心操作者|一名全职|single operator|founder/i)
        ? en
          ? "Core operator"
          : "核心操作者"
        : undefined;
    if (has(/Cody Tranbarger/)) labels.push("Cody Tranbarger");
    if (has(/Claude/)) labels.push("Claude");
    if (has(/顾问|consultant/i)) labels.push(en ? "Consultants" : "专业顾问");
    return {
      ...make(
        "acquisition",
        en ? "Acquisition & collaboration" : "收购与协作网络",
        labels,
        en
          ? "Relationships described in the narration"
          : "按讲稿呈现关系 · 非组织架构实录",
      ),
      operator,
    };
  }
  if (
    has(/加速|acceleration/i) &&
    has(/编排|orchestration/i) &&
    has(/并行|parallel/i)
  )
    return make(
      "timelines",
      en ? "Three different changes" : "三种不同的改变",
      en
        ? ["Acceleration", "Orchestration", "Parallel work"]
        : ["加速", "编排", "并行"],
      en
        ? "Illustration only · no measured time scale"
        : "机制示意 · 无真实时间刻度，不代表效率数据",
    );
  if (
    has(/反复出现|repeatable|recurring/i) &&
    has(/先选|从一|start with|begin with/i) &&
    has(/资料|inputs?/i) &&
    has(/输出|outputs?/i) &&
    has(/确认|approv/i) &&
    has(/检查|check/i)
  )
    return make(
      "practice",
      en ? "Build one checkable workflow" : "先搭一条可检查的流程",
      en
        ? [
            "Choose recurring work",
            "Define inputs",
            "Specify output",
            "Human approval",
            "Check results",
          ]
        : ["选重复工作", "明确资料", "约定输出", "人工确认", "检查结果"],
      en
        ? "Suggested practice · validate in your own work"
        : "实践建议示意 · 需在自己的业务中验证",
    );
  if (
    aiSupported &&
    has(/版本开发|version development|product development/i) &&
    has(/用户反馈|user feedback/i) &&
    has(/推广|promotion|marketing/i)
  )
    return make(
      "workbench",
      en ? "A workspace for decisions" : "工作台：看状态，再做决定",
      en
        ? ["Development", "User feedback", "Promotion"]
        : ["版本开发", "用户反馈", "内容推广"],
      en
        ? "Application analogy · illustrative task states"
        : "应用类比 · 下方任务状态仅为示意",
    );
  if (
    aiSupported &&
    has(/持续协作|ongoing collaboration|continuous collaboration/i) &&
    has(/待办|tasks?|to-do/i) &&
    has(/工具|执行|tools?|execut/i) &&
    has(/检查|确认|review|check|approv/i) &&
    has(/资料|materials|information/i) &&
    has(/结果|results/i)
  )
    return make(
      "collaboration",
      en ? "An ongoing collaboration loop" : "持续协作，而非一次聊天",
      en
        ? ["Materials", "Tasks", "Tools & execution", "Results", "Human review"]
        : ["必要资料", "提取待办", "工具执行", "交回结果", "人工检查"],
      en
        ? "Possible workflow · not a deployed product claim"
        : "应用流程示意 · 非已部署产品能力",
    );
  if (
    aiSupported &&
    has(/等.*结果|等待|waiting/i) &&
    has(/资料|materials/i) &&
    has(/决定|判断|decision|judgment/i) &&
    has(/调度中心|项目看板|scheduling hub|project board/i) &&
    has(/项目|projects/i)
  )
    return make(
      "hub",
      en ? "One operator, multiple projects" : "一个核心操作者，协调多个项目",
      en
        ? [
            "Waiting for results",
            "Organizing materials",
            "Decision needed",
            "AI collaboration",
          ]
        : ["等待结果", "整理资料", "需要判断", "AI 协作"],
      en
        ? "Illustrative project states · not an internal system"
        : "项目状态示意 · 非内部系统实录",
    );
  return null;
};
export const knowledgeChapterWindow = (
  beats: { caseIndex: number | null; startMs: number; endMs: number }[],
  index: number,
  frame: number,
  fps: number,
) => {
  const members = beats.filter((beat) => (beat.caseIndex ?? 0) === index);
  const start = Math.min(...members.map((beat) => beat.startMs));
  const end = Math.max(...members.map((beat) => beat.endMs));
  return {
    frame: Math.max(0, frame - Math.round((start * fps) / 1000)),
    duration: Math.max(1, Math.round(((end - start) * fps) / 1000)),
  };
};

/** Narration emphasis changes focus without restarting the chapter animation. */
export const knowledgeVisualFocus = (
  plan: KnowledgeVisualPlan,
  narration: string,
  progress: number,
) => {
  const matched = plan.labels.flatMap((label, index) =>
    narration.toLocaleLowerCase().includes(label.toLocaleLowerCase())
      ? [index]
      : [],
  );
  return matched.length
    ? matched
    : [
        Math.min(
          plan.labels.length - 1,
          Math.max(0, Math.floor(progress * plan.labels.length)),
        ),
      ];
};
