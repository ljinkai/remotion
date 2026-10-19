const SVG_TAGS = new Set([
  "svg",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

const SVG_ATTRS = new Set([
  "d",
  "points",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "viewbox",
]);

export const sanitizeSvg = (markup: string) => {
  const source = String(markup || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  return source
    .replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (full, tag, attrs) => {
      const name = String(tag).toLowerCase();
      if (!SVG_TAGS.has(name)) {
        return "";
      }
      if (full.startsWith("</")) {
        return `</${name}>`;
      }
      const kept: string[] = [];
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let match = attrRe.exec(String(attrs));
      while (match) {
        const key = match[1].toLowerCase();
        const value = match[3] ?? match[4] ?? "";
        if (SVG_ATTRS.has(key) && !/url\s*\(|javascript:|href/i.test(value)) {
          kept.push(`${key}="${value.replace(/"/g, "")}"`);
        }
        match = attrRe.exec(String(attrs));
      }
      if (name !== "svg" && /\/>\s*$/.test(full)) {
        return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""} />`;
      }
      return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
    })
    .trim();
};
