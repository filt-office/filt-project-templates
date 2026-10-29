// Shared add affordance: the bold cross used below the project image grids.
(() => {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
    .filt-add-line { position: relative; display: flex; align-items: flex-start; justify-content: center; gap: 6px; padding: 8px 0; background: #fff; }
    button.filt-add { display: block; flex: none; width: 32px; height: 32px; padding: 3px; border: 0; border-radius: 0; background: transparent; color: #111; cursor: pointer; }
    button.filt-add:hover { background: transparent; color: var(--filt-key, #BD005E); }
    button.filt-add:focus-visible { outline: 2px solid var(--filt-key, #BD005E); outline-offset: 3px; }
    button.filt-add svg { display: block; width: 100%; height: 100%; pointer-events: none; }
    .filt-add-hint { padding-top: 4px; color: var(--muted, #777); font-size: 11px; font-weight: 700; line-height: 1; letter-spacing: .03em; }
    .filt-add-line:has(.filt-add-hint) { justify-content: flex-start; padding-left: max(0px, calc(50% - 16px)); }
    .filt-add-menu { position: absolute; bottom: calc(100% - 4px); left: 50%; transform: translateX(-50%); z-index: 12; min-width: 168px; padding: 4px; border: 1px solid #111; border-radius: 0; background: #fff; box-shadow: 0 4px 12px #0001; }
    .filt-add-menu[hidden] { display: none !important; }
    .filt-add-menu button { display: block; width: 100%; padding: 7px 10px; border: 0; border-radius: 0; background: #fff; color: #111; text-align: left; font: inherit; cursor: pointer; }
    .filt-add-menu button:hover, .filt-add-menu button:focus-visible { background: var(--filt-key, #BD005E); color: #fff; outline: 2px solid var(--filt-key, #BD005E); outline-offset: 2px; }
    .filt-add-row > td { height: auto !important; padding: 0 !important; background: #fff !important; }
  `;
  document.head.append(style);

  const focusLater = (target) => {
    queueMicrotask(() => {
      if (target?.isConnected !== false && typeof target?.focus === "function") target.focus({ preventScroll: true });
    });
  };
  const closeMenu = (menu, restore = true) => {
    const state = menu?._filtAddState;
    if (!state || menu.hidden) return;
    menu.hidden = true;
    state.trigger.setAttribute("aria-expanded", "false");
    if (restore) focusLater(state.trigger);
  };
  const closeOtherMenus = (except) => {
    document.querySelectorAll(".filt-add-menu:not([hidden])").forEach((menu) => {
      if (menu !== except) closeMenu(menu, false);
    });
  };

  const button = (label, onclick) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "filt-add";
    el.title = label;
    el.setAttribute("aria-label", label);
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="5"/></svg>';
    if (onclick) el.addEventListener("click", onclick);
    return el;
  };

  const line = (label, onclick, { hint = "", actions = [] } = {}) => {
    const el = document.createElement("div");
    el.className = "filt-add-line";
    const trigger = button(label, actions.length ? null : onclick);
    el.append(trigger);
    if (hint) {
      const text = document.createElement("span");
      text.className = "filt-add-hint";
      text.textContent = hint;
      el.append(text);
    }
    if (actions.length) {
      const menu = document.createElement("div");
      menu.className = "filt-add-menu";
      menu.hidden = true;
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", label);
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "menu");
      menu._filtAddState = { trigger };

      const menuItems = () => [...menu.querySelectorAll('[role="menuitem"]')];
      const focusItem = (index) => {
        const items = menuItems();
        if (!items.length) return;
        const next = (index + items.length) % items.length;
        items.forEach((item, itemIndex) => { item.tabIndex = itemIndex === next ? 0 : -1; });
        items[next].focus();
      };
      const open = () => {
        closeOtherMenus(menu);
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        focusItem(0);
      };
      actions.forEach(([text, run]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("role", "menuitem");
        item.tabIndex = -1;
        item.textContent = text;
        item.addEventListener("click", (event) => {
          if (event.defaultPrevented) return;
          event.stopPropagation();
          closeMenu(menu, true);
          run();
        });
        menu.append(item);
      });
      trigger.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        if (menu.hidden) open();
        else closeMenu(menu, true);
      });
      menu.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) return;
        const item = event.target.closest?.('[role="menuitem"]');
        if (!item || !menu.contains(item)) return;
        const items = menuItems();
        const index = items.indexOf(item);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusItem(index + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusItem(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusItem(0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusItem(items.length - 1);
        } else if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          item.click();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenu(menu, true);
        }
      });
      el.append(menu);
    }
    return el;
  };

  const closeFromOutside = (event) => {
    document.querySelectorAll(".filt-add-menu:not([hidden])").forEach((menu) => {
      if (!menu.parentElement.contains(event.target)) closeMenu(menu, true);
    });
  };
  document.addEventListener("pointerdown", closeFromOutside);
  document.addEventListener("click", closeFromOutside);

  window.FiltAdd = { button, line };
})();
