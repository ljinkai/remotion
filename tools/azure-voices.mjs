/**
 * Azure Speech 中文 Neural 音色（Workbench 可选列表）。
 * 优先用区域 credentials 拉取实时列表；失败时回退到这份精选清单。
 */

export const DEFAULT_AZURE_VOICE = "zh-CN-YunxiNeural";
export const DEFAULT_EN_AZURE_VOICE = "en-US-JennyNeural";

/** @typedef {{ id: string, name: string, gender: "Female"|"Male"|"Unknown", locale: string, localeName: string, styles?: string[] }} AzureVoiceOption */

/** @type {AzureVoiceOption[]} */
export const CURATED_ENGLISH_VOICES = [
  {
    id: "en-US-JennyNeural",
    name: "Jenny",
    gender: "Female",
    locale: "en-US",
    localeName: "English (US)",
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy",
    gender: "Male",
    locale: "en-US",
    localeName: "English (US)",
  },
  {
    id: "en-GB-SoniaNeural",
    name: "Sonia",
    gender: "Female",
    locale: "en-GB",
    localeName: "English (UK)",
  },
];

/** @type {AzureVoiceOption[]} */
export const CURATED_CHINESE_VOICES = [
  {
    id: "zh-CN-YunxiNeural",
    name: "云希",
    gender: "Male",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["narration-relaxed", "chat", "assistant", "newscast"],
  },
  {
    id: "zh-CN-YunyangNeural",
    name: "云扬",
    gender: "Male",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["customerservice", "narration-professional", "newscast-casual"],
  },
  {
    id: "zh-CN-YunjianNeural",
    name: "云健",
    gender: "Male",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["narration-relaxed", "sports-commentary", "angry"],
  },
  {
    id: "zh-CN-YunhaoNeural",
    name: "云皓",
    gender: "Male",
    locale: "zh-CN",
    localeName: "普通话（简体）",
  },
  {
    id: "zh-CN-YunxiaNeural",
    name: "云夏",
    gender: "Male",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["calm", "fearful", "cheerful", "angry"],
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "晓晓",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["assistant", "chat", "customerservice", "newscast", "cheerful"],
  },
  {
    id: "zh-CN-XiaoyiNeural",
    name: "晓伊",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["affectionate", "angry", "cheerful", "sad"],
  },
  {
    id: "zh-CN-XiaochenNeural",
    name: "晓辰",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["livecommercial"],
  },
  {
    id: "zh-CN-XiaohanNeural",
    name: "晓涵",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["calm", "fearful", "cheerful", "disgruntled", "serious", "angry", "sad"],
  },
  {
    id: "zh-CN-XiaomengNeural",
    name: "晓梦",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["chat"],
  },
  {
    id: "zh-CN-XiaomoNeural",
    name: "晓墨",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["embarrassed", "calm", "fearful", "cheerful", "serious"],
  },
  {
    id: "zh-CN-XiaoqiuNeural",
    name: "晓秋",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
  },
  {
    id: "zh-CN-XiaoruiNeural",
    name: "晓睿",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["calm", "fearful", "angry", "sad"],
  },
  {
    id: "zh-CN-XiaoshuangNeural",
    name: "晓双",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["chat"],
  },
  {
    id: "zh-CN-XiaoxuanNeural",
    name: "晓萱",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["calm", "fearful", "cheerful", "disgruntled", "serious", "angry", "gentle"],
  },
  {
    id: "zh-CN-XiaoyanNeural",
    name: "晓颜",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
  },
  {
    id: "zh-CN-XiaoyouNeural",
    name: "晓悠",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
  },
  {
    id: "zh-CN-XiaozhenNeural",
    name: "晓甄",
    gender: "Female",
    locale: "zh-CN",
    localeName: "普通话（简体）",
    styles: ["angry", "disgruntled", "cheerful", "fearful", "sad", "serious"],
  },
  {
    id: "zh-CN-liaoning-XiaobeiNeural",
    name: "晓北",
    gender: "Female",
    locale: "zh-CN-liaoning",
    localeName: "东北官话",
  },
  {
    id: "zh-CN-shaanxi-XiaoniNeural",
    name: "晓妮",
    gender: "Female",
    locale: "zh-CN-shaanxi",
    localeName: "陕西话",
  },
  {
    id: "zh-CN-sichuan-YunxiNeural",
    name: "云希（四川）",
    gender: "Male",
    locale: "zh-CN-sichuan",
    localeName: "四川话",
  },
  {
    id: "zh-CN-henan-YundengNeural",
    name: "云登",
    gender: "Male",
    locale: "zh-CN-henan",
    localeName: "河南话",
  },
  {
    id: "zh-CN-shandong-YunxiangNeural",
    name: "云翔",
    gender: "Male",
    locale: "zh-CN-shandong",
    localeName: "山东话",
  },
  {
    id: "zh-HK-HiuMaanNeural",
    name: "曉曼",
    gender: "Female",
    locale: "zh-HK",
    localeName: "粤语（香港）",
  },
  {
    id: "zh-HK-HiuGaaiNeural",
    name: "曉佳",
    gender: "Female",
    locale: "zh-HK",
    localeName: "粤语（香港）",
  },
  {
    id: "zh-HK-WanLungNeural",
    name: "雲龍",
    gender: "Male",
    locale: "zh-HK",
    localeName: "粤语（香港）",
  },
  {
    id: "zh-TW-HsiaoChenNeural",
    name: "曉臻",
    gender: "Female",
    locale: "zh-TW",
    localeName: "国语（台湾）",
  },
  {
    id: "zh-TW-HsiaoYuNeural",
    name: "曉雨",
    gender: "Female",
    locale: "zh-TW",
    localeName: "国语（台湾）",
  },
  {
    id: "zh-TW-YunJheNeural",
    name: "雲哲",
    gender: "Male",
    locale: "zh-TW",
    localeName: "国语（台湾）",
  },
];

const isChineseLocale = (locale) => {
  const value = String(locale || "").toLowerCase();
  return value.startsWith("zh-");
};

const isEnglishLocale = (locale) => {
  const value = String(locale || "").toLowerCase();
  return value.startsWith("en-") || value === "en";
};

const normalizeVoice = (raw, { localeFilter = "zh" } = {}) => {
  const id = String(raw.ShortName || raw.Name || "").trim();
  if (!id) {
    return null;
  }
  const locale = String(raw.Locale || "").trim() || "zh-CN";
  if (localeFilter === "en") {
    if (!isEnglishLocale(locale)) {
      return null;
    }
  } else if (!isChineseLocale(locale)) {
    return null;
  }
  const genderRaw = String(raw.Gender || "Unknown");
  const gender =
    genderRaw === "Female" || genderRaw === "Male" ? genderRaw : "Unknown";
  return {
    id,
    name: String(raw.LocalName || raw.DisplayName || id).trim(),
    gender,
    locale,
    localeName: String(raw.LocaleName || locale).trim(),
    styles: Array.isArray(raw.StyleList) ? raw.StyleList : undefined,
  };
};

const sortVoices = (voices) =>
  [...voices].sort((a, b) => {
    const localeCmp = a.locale.localeCompare(b.locale, "zh");
    if (localeCmp !== 0) {
      return localeCmp;
    }
    const genderCmp = a.gender.localeCompare(b.gender);
    if (genderCmp !== 0) {
      return genderCmp;
    }
    return a.name.localeCompare(b.name, "zh");
  });

/**
 * @param {{ key: string, region: string, locale?: string }} credentials
 * @returns {Promise<AzureVoiceOption[]>}
 */
export const fetchChineseVoicesFromAzure = async ({
  key,
  region,
  locale = "zh",
}) => {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const response = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
    },
  });
  if (!response.ok) {
    throw new Error(`Azure voices list failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Azure voices list returned unexpected payload");
  }
  const localeFilter = locale === "en" ? "en" : "zh";
  const voices = payload
    .map((raw) => normalizeVoice(raw, { localeFilter }))
    .filter(Boolean)
    .filter((item) => String(item.id).includes("Neural"));
  return sortVoices(voices);
};

/**
 * @param {{ key?: string, region?: string, locale?: string }} [credentials]
 */
export const listChineseVoices = async (credentials = {}) => {
  const key = credentials.key?.trim();
  const region = credentials.region?.trim();
  const locale = credentials.locale === "en" ? "en" : "zh";
  const curated =
    locale === "en" ? CURATED_ENGLISH_VOICES : CURATED_CHINESE_VOICES;
  if (key && region) {
    try {
      const live = await fetchChineseVoicesFromAzure({ key, region, locale });
      if (live.length > 0) {
        return { voices: live, source: "azure" };
      }
    } catch (error) {
      console.warn(
        "[azure-voices] live list failed, using curated fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { voices: sortVoices(curated), source: "curated" };
};

export const defaultVoiceForLocale = (locale) =>
  locale === "en" ? DEFAULT_EN_AZURE_VOICE : DEFAULT_AZURE_VOICE;

export const isKnownChineseVoice = (voiceId, voices = CURATED_CHINESE_VOICES) => {
  const id = String(voiceId || "").trim();
  if (!id) {
    return false;
  }
  return voices.some((item) => item.id === id);
};

export const resolveVoiceId = (voiceId, fallback = DEFAULT_AZURE_VOICE) => {
  const id = String(voiceId || "").trim();
  return id || fallback;
};

export const formatVoiceLabel = (voice) => {
  const gender =
    voice.gender === "Female" ? "女" : voice.gender === "Male" ? "男" : "";
  const bits = [voice.name, gender, voice.localeName].filter(Boolean);
  return `${bits.join(" · ")} (${voice.id})`;
};
