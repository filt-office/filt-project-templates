// Site colours from the builder's design page (pages/design.json: { version, colors: [{ id, name, value }] }).
// Sets --filt-key (the first colour) and --filt-<id> for each colour on :root. Styles fall back to
// var(--filt-key, #BD005E), so a missing file or a slow request leaves the original key colour.
(() => {
  const script = document.currentScript;
  const root = document.documentElement;
  if (!script || root.dataset.filtDesign) return;
  root.dataset.filtDesign = "loading";

  fetch(new URL("pages/design.json", new URL(".", script.src)))
    .then((response) => (response.ok ? response.json() : null))
    .then((design) => {
      const colors = (design && Array.isArray(design.colors) ? design.colors : [])
        .filter((color) => color && typeof color.value === "string" && CSS.supports("color", color.value));
      colors.forEach((color, index) => {
        if (index === 0) root.style.setProperty("--filt-key", color.value);
        if (/^[a-z0-9-]+$/i.test(color.id || "")) root.style.setProperty(`--filt-${color.id}`, color.value);
      });
      root.dataset.filtDesign = "ready";
    })
    .catch((error) => {
      root.dataset.filtDesign = "default";
      console.warn("FILT design colours could not be loaded; using the defaults.", error);
    });
})();
