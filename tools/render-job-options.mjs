/**
 * Normalize /api/v1/render-jobs options.
 * aspect defaults to landscape; only "portrait" switches to 9:16.
 */
export const normalizeRenderJobOptions = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const aspectRaw = String(source.aspect || "")
    .trim()
    .toLowerCase();
  const aspect = aspectRaw === "portrait" ? "portrait" : "landscape";

  const templateId =
    typeof source.template_id === "string"
      ? source.template_id.trim()
      : typeof source.templateId === "string"
        ? source.templateId.trim()
        : "";

  const voice =
    typeof source.voice === "string" ? source.voice.trim() : "";

  return {
    skip_ai_script: Boolean(source.skip_ai_script),
    aspect,
    ...(templateId ? { template_id: templateId, templateId } : {}),
    ...(voice ? { voice } : {}),
  };
};
