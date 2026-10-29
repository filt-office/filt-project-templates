// Site design from the builder's design page (pages/design.json, version 2):
//   { colors: [{ id, name, value }], logo: { stroke, color, duration, ease },
//     type: { family, weight, scale: [{ id, pc, mobile, weight, line }] }, motion: { panel, hover } }
// Sets the --filt-* variables on :root (builder/store.js designVars() uses the same names). Only values
// present in the file are set; every style falls back to the original value, e.g. var(--filt-key, #BD005E),
// so a missing or older file (colours only) leaves the rest of the site as it was.
// The builder preview sets data-filt-design itself, so this script leaves such a page alone.
(() => {
  const script = document.currentScript;
  const root = document.documentElement;
  if (!script || root.dataset.filtDesign) return;
  root.dataset.filtDesign = "loading";

  const set = (name, value) => root.style.setProperty(name, String(value));
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const isId = (value) => /^[a-z0-9-]+$/i.test(value || "");

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

    const type = design.type || {};
    if (typeof type.family === "string" && type.family.trim() && !/[;{}]/.test(type.family)) set("--filt-font-family", type.family);
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
  };

  fetch(new URL("pages/design.json", new URL(".", script.src)))
    .then((response) => (response.ok ? response.json() : null))
    .then((design) => {
      if (design && typeof design === "object") apply(design);
      root.dataset.filtDesign = "ready";
    })
    .catch((error) => {
      root.dataset.filtDesign = "default";
      console.warn("FILT design could not be loaded; using the defaults.", error);
    });
})();
