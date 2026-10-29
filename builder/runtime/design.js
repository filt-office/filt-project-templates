// Site design from the builder's design page (pages/design.json, version 2):
//   { colors: [{ id, name, value }],
//     logo: { stroke, color, duration, ease, intro: { scale, appear, gather, hold, dock } },
//     type: { family, weight, font?: { src, family, format, name }, scale: [{ id, pc, mobile, weight, line }] },
//     motion: { panel, hover, slide, slideInterval, slideEase } }
// Sets the --filt-* variables on :root (builder/store.js designVars() uses the same names). Only values
// present in the file are set; every style falls back to the original value, e.g. var(--filt-key, #BD005E),
// so a missing or older file (colours only) leaves the rest of the site as it was.
(() => {
  const script = document.currentScript;
  const root = document.documentElement;
  if (!script) return;

  const FONT_EXT = new Set([".woff2", ".woff", ".ttf", ".otf"]);
  const FONT_BASE = "https://filt-office.github.io/filt-website-images/";
  const set = (name, value) => root.style.setProperty(name, String(value));
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const isId = (value) => /^[a-z0-9-]+$/i.test(value || "");
  const safeFamily = (value) => typeof value === "string" && /^[A-Za-z0-9 ._-]{1,90}$/.test(value) ? value.trim() : "";
  const extOf = (name) => (String(name || "").match(/\.[^./]+$/) || [""])[0].toLowerCase();
  const fontStack = (family) => `'${family.replace(/'/g, "\\'")}', 'Suit', 'Pretendard Variable', 'Noto Sans KR', sans-serif`;
  const storedFont = (value) => {
    if (!value || typeof value !== "object") return null;
    const src = typeof value.src === "string" ? value.src : "";
    const ext = extOf(src);
    const family = safeFamily(value.family);
    if (!FONT_EXT.has(ext) || value.format !== ext.slice(1) || !family || !new RegExp(`^assets/pages/PC/font-[a-z0-9][a-z0-9.-]*\\${ext}$`).test(src)) return null;
    return { src, family, format: ext.slice(1) };
  };
  const inlineFont = () => {
    const src = root.dataset.filtFontSrc || "";
    const family = safeFamily(root.dataset.filtFontFamily);
    const format = root.dataset.filtFontFormat || "";
    return family && FONT_EXT.has(`.${format}`) && /^(blob:|https?:|\/|assets\/)/.test(src) ? { src, family, format } : null;
  };
  const fontUrl = (src) => {
    if (/^(blob:|https?:)/.test(src)) return src;
    return /^assets\/pages\/PC\/font-[a-z0-9][a-z0-9.-]*\.(woff2|woff|ttf|otf)$/i.test(src) ? new URL(src, FONT_BASE).href : "";
  };
  const loadFont = async (font) => {
    const url = fontUrl(font.src);
    if (!url) throw new Error("Invalid uploaded font URL.");
    if (typeof FontFace !== "function") throw new Error("FontFace is unavailable.");
    const face = new FontFace(font.family, `url(${JSON.stringify(url)}) format("${font.format}")`, { style: "normal", weight: "100 900", display: "swap" });
    document.fonts?.add(await face.load());
  };

  // A builder preview already owns the CSS variables. It still needs its own document FontFace,
  // because fonts registered in the parent document are not inherited by srcdoc iframes.
  if (root.dataset.filtDesign) {
    const font = inlineFont();
    if (font) loadFont(font).catch((error) => console.warn("FILT preview font could not be loaded.", error));
    return;
  }
  root.dataset.filtDesign = "loading";

  const apply = (design) => {
    const colors = (Array.isArray(design.colors) ? design.colors : [])
      .filter((color) => color && typeof color.value === "string" && CSS.supports("color", color.value));
    colors.forEach((color, index) => {
      if (index === 0) set("--filt-key", color.value);
      if (isId(color.id)) set(`--filt-${color.id}`, color.value);
    });

    const logo = design.logo || {};
    if (isNumber(logo.stroke)) set("--filt-logo-stroke", logo.stroke);
    if (logo.color === "black") set("--filt-logo-color", "#000");
    else if (isId(logo.color)) set("--filt-logo-color", `var(--filt-${logo.color}, #000)`);
    if (isNumber(logo.duration)) set("--filt-logo-morph", `${logo.duration}s`);
    if (/^[a-z0-9.()]+$/i.test(logo.ease || "")) set("--filt-logo-ease", logo.ease);
    // HOME entrance: lines gather into a large mark, hold, then dock on the menu logo.
    const intro = logo.intro || {};
    if (isNumber(intro.scale)) set("--filt-intro-scale", intro.scale);
    ["appear", "gather", "hold", "dock"].forEach((key) => {
      if (isNumber(intro[key])) set(`--filt-intro-${key}`, `${intro[key]}s`);
    });

    const type = design.type || {};
    const font = storedFont(type.font);
    if (font) set("--filt-font-family", fontStack(font.family));
    else if (typeof type.family === "string" && type.family.trim() && !/[;{}]/.test(type.family)) set("--filt-font-family", type.family);
    if (isNumber(type.weight)) set("--filt-font-weight", type.weight);
    (Array.isArray(type.scale) ? type.scale : []).filter((size) => size && isId(size.id)).forEach((size) => {
      if (isNumber(size.pc)) set(`--filt-size-${size.id}`, `${size.pc}px`);
      if (isNumber(size.mobile)) set(`--filt-size-${size.id}-mobile`, `${size.mobile}px`);
      if (isNumber(size.weight)) set(`--filt-weight-${size.id}`, size.weight);
      if (isNumber(size.line)) set(`--filt-line-${size.id}`, size.line);
    });

    const motion = design.motion || {};
    if (isNumber(motion.panel)) set("--filt-motion-panel", `${motion.panel}s`);
    if (isNumber(motion.hover)) set("--filt-motion-hover", `${motion.hover}s`);
    if (isNumber(motion.slide)) set("--filt-motion-slide", `${motion.slide}s`);
    if (isNumber(motion.slideInterval)) set("--filt-slide-interval", `${motion.slideInterval}s`);
    if (/^[a-z0-9.,() -]+$/i.test(motion.slideEase || "")) set("--filt-motion-slide-ease", motion.slideEase);
    return font ? loadFont(font) : Promise.resolve();
  };

  fetch(new URL("pages/design.json", new URL(".", script.src)))
    .then((response) => (response.ok ? response.json() : null))
    .then((design) => (design && typeof design === "object" ? apply(design).catch((error) => console.warn("FILT uploaded font could not be loaded.", error)) : null))
    .then(() => { root.dataset.filtDesign = "ready"; })
    .catch((error) => {
      root.dataset.filtDesign = "default";
      console.warn("FILT design could not be loaded; using the defaults.", error);
    });
})();
