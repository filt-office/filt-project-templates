// Right-click menu for list items in every builder page: 보관 / 보관 해제 and 삭제.
// An archived item stays in the builder (greyed out) with archived: true; previews leave it out,
// and publishing must drop it too.
// Usage: FiltRowMenu.attach(element, { list, item, label, onChange }).
// Pass items: [{ text, hint, danger, run }] instead to show other actions.
(() => {
  "use strict";

  const css = `
    .fb-menu { position: fixed; z-index: 60; min-width: 170px; padding: 4px 0; border: 1px solid #111; background: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.15); font: 12px/1.4 "SUIT", system-ui, sans-serif; color: #111; }
    .fb-menu .fb-menu-label { overflow: hidden; max-width: 260px; margin-bottom: 2px; padding: 4px 12px 6px; border-bottom: 1px solid #eee; color: #777; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .fb-menu button { display: block; width: 100%; padding: 6px 12px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .fb-menu button:hover, .fb-menu button:focus-visible { background: #111; color: #fff; outline: none; }
    .fb-menu button.danger:hover, .fb-menu button.danger:focus-visible { background: #c62828; }
    .fb-menu small { display: block; color: #999; font-size: 10px; }
    .fb-menu button:hover small { color: #ddd; }
    /* Archived: the whole item is covered in grey; it can still be edited. */
    .archived { position: relative; }
    tr.archived > td { background: #e2e2df !important; }
    tr.archived > td > * { opacity: .4; }
    .archived:not(tr)::after { content: ""; position: absolute; inset: 0; z-index: 3; background: rgba(205, 205, 202, .62); pointer-events: none; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  let menu = null;
  const close = () => { menu?.remove(); menu = null; };
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  window.addEventListener("blur", close);
  window.addEventListener("scroll", close, true);

  const open = (event, { list, item, label, onChange, items }) => {
    close();
    const button = (text, hint, className, action) => {
      const el = document.createElement("button");
      el.type = "button";
      if (className) el.className = className;
      el.textContent = text;
      if (hint) {
        const small = document.createElement("small");
        small.textContent = hint;
        el.append(small);
      }
      el.addEventListener("click", (clickEvent) => { clickEvent.stopPropagation(); close(); action(); });
      return el;
    };
    menu = document.createElement("div");
    menu.className = "fb-menu";
    menu.setAttribute("role", "menu");
    const title = document.createElement("div");
    title.className = "fb-menu-label";
    title.textContent = label;
    menu.append(title, ...(items
      ? items.map((entry) => button(entry.text, entry.hint, entry.danger ? "danger" : "", entry.run))
      : [item.archived
        ? button("보관 해제", "다시 게시에 나옵니다", "", () => { delete item.archived; onChange(); })
        : button("보관", "목록에는 남고 게시에서는 빠집니다", "", () => { item.archived = true; onChange(); }),
      button("삭제", "", "danger", () => {
        if (!confirm(`${label}을(를) 삭제할까요?`)) return;
        const index = list.indexOf(item);
        if (index !== -1) list.splice(index, 1);
        onChange();
      })]));
    document.body.append(menu);
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(event.clientX, innerWidth - box.width - 8)}px`;
    menu.style.top = `${Math.min(event.clientY, innerHeight - box.height - 8)}px`;
    menu.querySelector("button").focus();
  };

  const attach = (el, options) => {
    if (options.item) {
      el.classList.toggle("archived", Boolean(options.item.archived));
      if (options.item.archived) el.title = "보관됨 · 우클릭으로 보관 해제";
    }
    el.addEventListener("contextmenu", (event) => {
      // Selected text in a field keeps the browser's own menu (copy).
      const field = event.target.closest("input, textarea");
      if (field && field.selectionStart !== field.selectionEnd) return;
      event.preventDefault();
      event.stopPropagation();
      open(event, { label: "이 항목", ...options });
    });
    return el;
  };

  // Copies data without archived items (for previews and publishing).
  const withoutArchived = (value) => {
    if (Array.isArray(value)) return value.filter((item) => !item?.archived).map(withoutArchived);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutArchived(item)]));
  };

  window.FiltRowMenu = { attach, withoutArchived };
})();
