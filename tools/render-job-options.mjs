/**
 * Normalize /api/v1/render-jobs options.
 * - `aspects`: preferred list, e.g. ["landscape","portrait"]
 * - `aspect`: legacy single value (default landscape)
 */
export const normalizeRenderJobOptions = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};

  const allowed = new Set(["landscape", "portrait"]);
  let aspects = [];
  if (Array.isArray(source.aspects)) {
    for (const item of source.aspects) {
      const a = String(item || "")
        .trim()
        .toLowerCase();
      if (allowed.has(a) && !aspects.includes(a)) {
        aspects.push(a);
      }
    }
  }
  if (aspects.length === 0) {
    const aspectRaw = String(source.aspect || "")
      .trim()
      .toLowerCase();
    aspects = [aspectRaw === "portrait" ? "portrait" : "landscape"];
  }

  const aspect = aspects[0];

  const templateId =
    typeof source.template_id === "string"
      ? source.template_id.trim()
      : typeof source.templateId === "string"
        ? source.templateId.trim()
        : "";

  const voice =
    typeof source.voice === "string" ? source.voice.trim() : "";

  const localeRaw = String(source.locale || "")
    .trim()
    .toLowerCase();
  const locale = localeRaw === "en" ? "en" : "zh";

  return {
    skip_ai_script: Boolean(source.skip_ai_script),
    aspect,
    aspects,
    locale,
    ...(templateId ? { template_id: templateId, templateId } : {}),
    ...(voice ? { voice } : {}),
  };
};
