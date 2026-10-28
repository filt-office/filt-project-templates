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
    { id: "works-gallery", href: "./?view=gallery" },
  ];

  // The FILT mark from runtime/common-menu-v2.js, cropped to its own bounds.
  const LOGO = `<svg viewBox="15 262 72 60" aria-hidden="true">
    <path d="M28.2,265.02v54.66M25.78,267.47h19.22M18,289.07h6M32.4,289.07h9.6M42,289.07h9.6M60,289.07h24M55.8,289.07v30.6M55.8,264.47v24.6M72,293.27v26.4M72,264.47v20.4M42,293.27v26.4M67.81,317.17h-14.46"/>
  </svg>`;

  const css = `
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
    .fb-logo svg { flex: none; width: 58px; height: 48px; fill: none; stroke: #444; stroke-width: 4.2; }
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
    span.fb-act:hover { color: inherit; }
    .fb-act.deploy { color: #BD005E; } /* the site's key colour */
    .fb-act.deploy:hover, .fb-act.deploy:focus-visible { color: #8a0045; }
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

  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap";
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(font, style);

  const header = document.querySelector(".fb-header");
  const logo = document.createElement("a");
  logo.className = "fb-logo";
  logo.href = "./";
  logo.title = "FILT. BUILDER";
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
  window.FiltHeader = { setActive, tabs: nav };
})();
