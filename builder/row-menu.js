// Right-click menu for list items in every builder page: 보관 / 보관 해제 and 삭제.
// An archived item stays in the builder (greyed out) with archived: true; previews leave it out,
// and publishing must drop it too.
// Usage: FiltRowMenu.attach(element, { list, item, label, onChange }).
// Pass items: [{ text, hint, danger, run }] instead to show other actions.
(() => {
  "use strict";

  const css = `
    .fb-menu { position: fixed; z-index: 60; min-width: 170px; padding: 4px 0; border: 1px solid #111; border-radius: 0; background: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.15); font: 12px/1.4 "SUIT", system-ui, sans-serif; color: #111; }
    .fb-menu .fb-menu-label { overflow: hidden; max-width: 260px; margin-bottom: 2px; padding: 4px 12px 6px; border-bottom: 1px solid #eee; color: #777; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .fb-menu button { display: block; width: 100%; padding: 6px 12px; border: 0; border-radius: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .fb-menu button:hover, .fb-menu button:focus-visible { background: var(--filt-key, #BD005E); color: #fff; outline: 2px solid var(--filt-key, #BD005E); outline-offset: 2px; }
    .fb-menu button.danger:hover, .fb-menu button.danger:focus-visible { background: var(--filt-key, #BD005E); outline-color: var(--filt-key, #BD005E); }
    .fb-menu small { display: block; color: #999; font-size: 10px; }
    .fb-menu button:hover small, .fb-menu button:focus-visible small { color: #fff; }
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
  const attached = new WeakMap();
  const restoreFocus = (target) => {
    queueMicrotask(() => {
      if (target?.isConnected !== false && typeof target?.focus === "function") target.focus({ preventScroll: true });
    });
  };
  const close = (restore = true) => {
    if (!menu) return;
    const closing = menu;
    const trigger = closing._filtMenuTrigger;
    menu = null;
    closing.remove();
    if (restore) restoreFocus(trigger);
  };
  document.addEventListener("click", (event) => {
    if (!menu || menu.contains(event.target)) return;
    close(true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.key !== "Escape" || !menu) return;
    event.preventDefault();
    close(true);
  });
  window.addEventListener("blur", () => close(true));
  window.addEventListener("scroll", () => close(true), true);

  const place = (event, currentMenu) => {
    const box = currentMenu.getBoundingClientRect();
    const maxLeft = Math.max(8, innerWidth - box.width - 8);
    const maxTop = Math.max(8, innerHeight - box.height - 8);
    currentMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
    currentMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
  };

  const open = (event, { list, item, label, onChange, items }, trigger) => {
    close(false);
    const button = (text, hint, className, action) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("role", "menuitem");
      el.tabIndex = -1;
      if (className) el.className = className;
      el.textContent = text;
      if (hint) {
        const small = document.createElement("small");
        small.textContent = hint;
        el.append(small);
      }
      el.addEventListener("click", (clickEvent) => {
        if (clickEvent.defaultPrevented) return;
        clickEvent.stopPropagation();
        close(true);
        action();
      });
      return el;
    };
    menu = document.createElement("div");
    menu.className = "fb-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${label} 메뉴`);
    menu._filtMenuTrigger = trigger;
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

    const menuItems = [...menu.querySelectorAll('[role="menuitem"]')];
    const focusItem = (index) => {
      if (!menuItems.length) return;
      const next = (index + menuItems.length) % menuItems.length;
      menuItems.forEach((entry, entryIndex) => { entry.tabIndex = entryIndex === next ? 0 : -1; });
      menuItems[next].focus();
    };
    menu.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.defaultPrevented) return;
      const active = keyEvent.target.closest?.('[role="menuitem"]');
      if (!active || !menu.contains(active)) return;
      const index = menuItems.indexOf(active);
      if (keyEvent.key === "ArrowDown") {
        keyEvent.preventDefault();
        focusItem(index + 1);
      } else if (keyEvent.key === "ArrowUp") {
        keyEvent.preventDefault();
        focusItem(index - 1);
      } else if (keyEvent.key === "Home") {
        keyEvent.preventDefault();
        focusItem(0);
      } else if (keyEvent.key === "End") {
        keyEvent.preventDefault();
        focusItem(menuItems.length - 1);
      } else if (keyEvent.key === "Enter" || keyEvent.key === " " || keyEvent.key === "Spacebar") {
        keyEvent.preventDefault();
        active.click();
      } else if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        close(true);
      }
    });
    place(event, menu);
    focusItem(0);
  };

  const triggerFor = (el) => {
    const selector = ".num, .card-head, .card-name, .slide-head, .slide-body, .gallery-head, .gallery-group-head, [data-row-handle], [data-drag-handle]";
    const candidate = el.matches?.(selector) ? el : el.querySelector?.(selector);
    if (!candidate || candidate.matches?.("input, textarea, select, button, a[href]")) return el;
    return candidate;
  };

  const attach = (el, options) => {
    if (options.item) {
      el.classList.toggle("archived", Boolean(options.item.archived));
      if (options.item.archived) el.title = "보관됨 · 우클릭으로 보관 해제";
    }

    const present = attached.get(el);
    if (present) {
      present.options = options;
      return el;
    }

    const trigger = triggerFor(el);
    trigger.tabIndex = 0;
    if (!trigger.getAttribute("aria-label")) trigger.setAttribute("aria-label", `${options.label || "이 항목"} 메뉴 · Shift+F10 또는 우클릭`);
    trigger.setAttribute("aria-haspopup", "menu");
    const state = { options, trigger };
    const show = (event) => {
      if (event.defaultPrevented) return;
      // Selected text in a field keeps the browser's own menu (copy).
      const field = event.target.closest?.("input, textarea");
      if (field && field.selectionStart !== field.selectionEnd) return;
      event.preventDefault();
      event.stopPropagation();
      open(event, { label: "이 항목", ...state.options }, state.trigger);
    };
    el.addEventListener("contextmenu", show);
    trigger.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
      event.preventDefault();
      event.stopPropagation();
      const box = trigger.getBoundingClientRect();
      open({ clientX: box.left, clientY: box.bottom }, { label: "이 항목", ...state.options }, trigger);
    });
    attached.set(el, state);
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
