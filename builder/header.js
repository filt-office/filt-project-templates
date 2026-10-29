// Shared builder header: logo cell, an action row (account / draft / save / deploy) and page tabs.
// Usage: <header class="fb-header" data-active="works-list"><div class="fb-actions">…</div></header>
// followed by <script src="header.js"></script>. Items with class "fb-act" get "/" between them.
(() => {
  "use strict";

  // Pages without an editor yet are shown but not linked.
  const TABS = [
    { id: "home", href: "home.html" },
    { id: "office", href: "office.html" },
    { id: "news", href: "news.html" },
    { id: "works-list", href: "./" },
    { id: "works-gallery", href: "works-gallery.html" },
  ];

  // The FILT mark from runtime/common-menu-v2.js, cropped to its own bounds.
  const LOGO = `<svg viewBox="15 262 72 60" aria-hidden="true">
    <path d="M28.2,265.02v54.66M25.78,267.47h19.22M18,289.07h6M32.4,289.07h9.6M42,289.07h9.6M60,289.07h24M55.8,289.07v30.6M55.8,264.47v24.6M72,293.27v26.4M72,264.47v20.4M42,293.27v26.4M67.81,317.17h-14.46"/>
  </svg>`;

  let css = `
    .fb-header {
      display: grid;
      grid-template-columns: 200px 1fr;
      grid-template-rows: 36px 42px;
      border-bottom: 1.5px solid #111;
      background: #fff;
      color: #111;
      font: 15px/1 "IBM Plex Mono", ui-monospace, Consolas, monospace;
    }
    .fb-logo {
      grid-row: 1 / 3;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 14px;
      border-right: 1.5px solid #111;
      color: #111;
      text-decoration: none;
    }
    .fb-logo svg { flex: none; width: 58px; height: 48px; fill: none; stroke: #444; stroke-width: var(--filt-logo-stroke, 5); } /* same stroke as the site (design.html) */
    .fb-logo span { font-size: 14px; }
    .fb-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0;
      padding: 0 18px;
      border-bottom: 1.5px solid #111;
      color: #9a9a9a;
      white-space: nowrap;
    }
    .fb-act { padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
    .fb-act ~ .fb-act::before { content: "/"; margin: 0 14px; color: #9a9a9a; }
    .fb-act:hover, .fb-act:focus-visible { background: none; color: #111; outline: none; }
    .fb-act:disabled { opacity: .4; pointer-events: none; }
    span.fb-act { cursor: default; }
    a.fb-act { text-decoration: none; }
    a.fb-act.version { font-size: 13px; }
    span.fb-act:hover { color: inherit; }
    .fb-act.deploy { color: var(--filt-key, #BD005E); } /* the site's key colour (design.html) */
    .fb-act.deploy:hover, .fb-act.deploy:focus-visible { color: color-mix(in srgb, var(--filt-key, #BD005E) 75%, #000); }
    .fb-actions .dirty { margin-right: 8px; font-size: 11px; }
    .fb-tabs {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 24px;
      overflow-x: auto;
      padding: 0 18px;
      scrollbar-width: none;
    }
    .fb-tabs a, .fb-tabs span {
      display: flex;
      align-items: center;
      border-bottom: 3px solid transparent;
      color: #111;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .fb-tabs span { color: #c4c4c4; cursor: default; }
    .fb-tabs a:hover { color: #555; }
    .fb-tabs .active { border-bottom-color: #111; }
    @media (max-width: 760px) {
      .fb-header { grid-template-columns: 1fr; grid-template-rows: auto 36px 42px; }
      .fb-logo { grid-row: auto; border-right: 0; border-bottom: 1.5px solid #111; }
      .fb-tabs { justify-content: flex-start; }
    }
  `;

  css += `
    .fb-modal { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(0,0,0,.35); }
    .fb-modal-card { width: min(420px, calc(100vw - 32px)); border: 1.5px solid #111; background: #fff; color: #111; font: 13px/1.5 "SUIT", system-ui, sans-serif; }
    .fb-modal-card h2 { margin: 0; padding: 12px 16px; border-bottom: 1.5px solid #111; font: 700 14px/1.2 "IBM Plex Mono", ui-monospace, monospace; }
    .fb-modal-card p { margin: 0; padding: 14px 16px; }
    .fb-modal-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 1.5px solid #111; }
    .fb-modal-actions button { padding: 10px 6px; border: 0; border-right: 1px solid #111; background: #fff; color: #111; font: inherit; cursor: pointer; }
    .fb-modal-actions button:last-child { border-right: 0; }
    .fb-modal-actions button:hover, .fb-modal-actions button:focus-visible { background: #111; color: #fff; outline: none; }
    .fb-modal-actions button.primary { background: #111; color: #fff; }
    .fb-modal-actions button.primary:hover { background: var(--filt-key, #BD005E); }
    .fb-modal-actions button.danger:hover { background: #c62828; }
    /* Editor-only interaction theme; follows the key colour from DESIGN. */
    ::selection { background: var(--filt-key, #BD005E); color: #fff; }
    button, input, select, textarea, .thumb, .fb-modal-card, .pe-picker-card, .filt-add-menu { border-radius: 0 !important; }
    input[type="color"]::-webkit-color-swatch, input[type="color"]::-webkit-color-swatch-wrapper { border-radius: 0; }
    input[type="color"]::-moz-color-swatch { border-radius: 0; }
    /* The same square key-colour focus cue is used for named and unnamed editor controls. */
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible,
    a:focus-visible, [role="button"]:focus-visible, [tabindex]:focus-visible {
      outline: 2px solid var(--filt-key, #BD005E) !important;
      outline-offset: 2px !important;
      border-radius: 0 !important;
    }
    body input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      display: inline-grid;
      place-content: center;
      flex: none;
      width: 14px;
      height: 14px;
      padding: 0 !important;
      border: 1px solid #111 !important;
      background: #fff !important;
      vertical-align: middle;
      cursor: pointer;
      accent-color: var(--filt-key, #BD005E);
    }
    body input[type="checkbox"]::before {
      content: "";
      width: 7px;
      height: 4px;
      margin-top: -2px;
      border-left: 2px solid #fff;
      border-bottom: 2px solid #fff;
      transform: rotate(-45deg);
      visibility: hidden;
    }
    body input[type="checkbox"]:checked {
      border-color: var(--filt-key, #BD005E) !important;
      background: var(--filt-key, #BD005E) !important;
    }
    body input[type="checkbox"]:checked::before { visibility: visible; }
    body input[type="checkbox"]:hover { border-color: var(--filt-key, #BD005E) !important; }
    body input[type="checkbox"]:focus-visible { outline: 2px solid var(--filt-key, #BD005E) !important; outline-offset: 2px !important; }
    body input[type="checkbox"]:disabled { opacity: .35; cursor: default; }
    button.hide-toggle.on {
      border-color: var(--filt-key, #BD005E) !important;
      background-color: var(--filt-key, #BD005E) !important;
    }
    button.show-toggle.on { border-color: #111 !important; background-color: #111 !important; box-shadow: none !important; }
    .dragging { opacity: 1 !important; background-color: var(--filt-key, #BD005E) !important; color: #fff !important; }
    tr.dragging > td, .dragging .slide-body, .dragging .card-name,
    .dragging input:not([type="checkbox"]), .dragging select, .dragging textarea,
    .dragging .block-text, .dragging .text-tools {
      background-color: var(--filt-key, #BD005E) !important;
      color: #fff !important;
    }
    tr.drop-before > td { box-shadow: inset 0 2px 0 var(--filt-key, #BD005E) !important; }
    tr.drop-after > td { box-shadow: inset 0 -2px 0 var(--filt-key, #BD005E) !important; }
    .slide.drop-before, .card.drop-before, .color.drop-before { box-shadow: -5px 0 0 var(--filt-key, #BD005E) !important; }
    .slide.drop-after, .card.drop-after, .color.drop-after { box-shadow: 5px 0 0 var(--filt-key, #BD005E) !important; }
    tr.drop-before > td, tr.drop-after > td, .slide.drop-before .slide-body,
    .slide.drop-after .slide-body, .card.drop-before .card-name, .card.drop-after .card-name,
    .thumb.drop, .file-over, .card-media.over, .gallery-group.over {
      background-color: color-mix(in srgb, var(--filt-key, #BD005E) 12%, #fff) !important;
    }
    .thumb.drop, .file-over { box-shadow: inset 0 0 0 3px var(--filt-key, #BD005E) !important; }
    .slide-media.file-over::before, .card-media.file-over::before, .card-media.over::before, .thumb.drop::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      background: color-mix(in srgb, var(--filt-key, #BD005E) 18%, transparent);
      pointer-events: none;
    }
    /* Preview collapse keeps the existing iframe in place and expands the editor grid. */
    .fb-preview-collapsed { grid-template-columns: minmax(0, 1fr) !important; }
    [hidden] { display: none !important; }
    /* Same first control below the tabs as WORKS-LIST; never part of save/deploy actions. */
    .fb-preview-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--line, #d9d9d9); background: #fff; }
    body.fb-has-preview-tools { grid-template-rows: auto auto minmax(0, 1fr); }
    button.fb-preview-toggle { flex: none; align-self: center; margin: 0 0 0 auto; padding: 4px 2px; border: 0; border-radius: 0; background: none; color: #111; font: 700 12px/1.4 "SUIT", system-ui, sans-serif; white-space: nowrap; cursor: pointer; }
    button.fb-preview-toggle:hover, button.fb-preview-toggle[aria-expanded="true"] { background: none; color: var(--filt-key, #BD005E); }
  `;

  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap";
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(font, style);

  const header = document.querySelector(".fb-header");
  const logo = document.createElement("a");
  logo.className = "fb-logo";
  logo.href = "design.html";
  logo.title = "FILT. BUILDER · 디자인 시스템";
  logo.innerHTML = `${LOGO}<span>.builder</span>`;

  const nav = document.createElement("nav");
  nav.className = "fb-tabs";
  for (const tab of TABS) {
    const item = document.createElement(tab.href ? "a" : "span");
    item.textContent = `{${tab.id}:}`;
    item.dataset.tab = tab.id;
    if (tab.href) item.href = tab.href;
    else item.title = "준비 중";
    nav.append(item);
  }

  const setActive = (id) => {
    nav.querySelectorAll("[data-tab]").forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === id);
      if (item.dataset.tab === id) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  };
  setActive(header.dataset.active);

  header.prepend(logo);
  header.append(nav);

  // A page opts in only when it has an existing preview pane. The iframe is never removed.
  const previewToggleState = new WeakMap();
  const mountPreviewToggle = ({ layout, pane, onChange } = {}) => {
    if (!layout || !pane) return null;
    let tools = document.querySelector(".filters, .bar, .fb-preview-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "fb-preview-tools";
      header.after(tools);
      document.body.classList.add("fb-has-preview-tools");
    }
    if (!pane.id) pane.id = "fb-preview-pane";

    let toggle = tools.querySelector("[data-fb-preview-toggle]");
    let state = toggle && previewToggleState.get(toggle);
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "fb-preview-toggle";
      toggle.setAttribute("data-fb-preview-toggle", "");
      toggle.setAttribute("aria-controls", pane.id || "");
      tools.append(toggle); // always the last control, at the right end of the bar
      state = { layout, pane, onChange, expanded: !pane.hidden };
      previewToggleState.set(toggle, state);
      toggle.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        state.expanded = !state.expanded;
        state.apply(true);
      });
    } else {
      state = state || { expanded: toggle.getAttribute("aria-expanded") !== "false" };
      state.layout = layout;
      state.pane = pane;
      state.onChange = onChange;
      previewToggleState.set(toggle, state);
      toggle.setAttribute("aria-controls", pane.id || "");
    }

    state.apply = (notify) => {
      state.layout.classList.toggle("fb-preview-collapsed", !state.expanded);
      state.pane.hidden = !state.expanded;
      toggle.setAttribute("aria-expanded", String(state.expanded));
      toggle.textContent = "미리보기";
      toggle.setAttribute("aria-label", "미리보기");
      toggle.title = state.expanded ? "미리보기 접기" : "미리보기 펼치기";
      if (notify) state.onChange?.(state.expanded);
    };
    state.apply(false);
    return toggle;
  };

  // ---------- unsaved changes ----------
  // A page registers guard({ isDirty, save, discard, saveLabel }). Leaving through a builder link,
  // or a page's own FiltHeader.leave(), then asks: save and go / go without saving / stay.
  // Closing the tab still gets the browser's own warning (beforeunload), which cannot be styled.
  let guard = null;
  const leave = () => new Promise((resolve) => {
    if (!guard?.isDirty()) { resolve(true); return; }
    const button = (text, className, action) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = className;
      el.textContent = text;
      el.addEventListener("click", action);
      return el;
    };
    const modal = document.createElement("div");
    modal.className = "fb-modal";
    modal.innerHTML = '<div class="fb-modal-card" role="alertdialog" aria-modal="true"><h2>저장하지 않은 변경 사항</h2><p>이대로 넘어가면 수정한 내용이 사라집니다.</p><div class="fb-modal-actions"></div></div>';
    const done = (value) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(value); };
    const onKey = (event) => { if (event.key === "Escape") done(false); };
    const save = button(guard.saveLabel || "저장하고 이동", "primary", async () => {
      save.disabled = true;
      save.textContent = "저장 중…";
      try {
        if ((await guard.save()) === false) { done(false); return; }
        done(true);
      } catch {
        done(false);
      }
    });
    modal.querySelector(".fb-modal-actions").append(
      save,
      button("저장 안 하고 이동", "danger", () => { guard.discard?.(); done(true); }),
      button("취소", "", () => done(false)),
    );
    modal.addEventListener("click", (event) => { if (event.target === modal) done(false); });
    document.addEventListener("keydown", onKey);
    document.body.append(modal);
    save.focus();
  });
  document.addEventListener("click", async (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link || event.defaultPrevented || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (link.origin !== location.origin || !guard?.isDirty()) return;
    event.preventDefault();
    if (await leave()) location.href = link.href;
  });

  window.FiltHeader = { setActive, tabs: nav, guard: (options) => { guard = options; }, leave, mountPreviewToggle };
})();
