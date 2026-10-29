// Shared editor for HOME, OFFICE and NEWS (runtime/pages/<page>.json).
// A page calls FiltPageEditor({ page, render }) after store.js and header.js; render(ctx) returns the
// editor's elements and is called again on ctx.rerender(). The preview draws the unsaved data with
// the real runtime/pages.js.
(() => {
  "use strict";

  const css = `
    :root { --line: #d9d9d9; --muted: #777; --bg: #f4f4f2; --danger: #c62828; --row-h: 32px; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body { display: grid; grid-template-rows: auto 1fr; font: 12px/1.4 "SUIT", system-ui, sans-serif; color: #111; background: var(--bg); }
    button, input, select, textarea { font: inherit; color: inherit; }
    button { padding: 4px 9px; border: 1px solid #111; border-radius: 0; background: #fff; cursor: pointer; white-space: nowrap; }
    button:hover { background: #111; color: #fff; }
    button.active { background: #111; color: #fff; }
    button.small { padding: 1px 5px; font-size: 11px; border-color: var(--line); }
    button.small:hover { border-color: #111; }
    button.danger:hover { background: var(--danger); border-color: var(--danger); }
    button:disabled { opacity: .35; pointer-events: none; }
    .dirty { color: var(--danger); visibility: hidden; }
    .dirty.show { visibility: visible; }
    .spacer { flex: 1; }
    .muted { color: var(--muted); }

    .pe-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 38%); min-height: 0; }
    .pe-layout.no-preview { grid-template-columns: minmax(0, 1fr) 0; }
    .pe-layout.no-preview .pe-preview { display: none; }
    .pe-editor { overflow: auto; min-height: 0; padding: 0 0 40px; background: #fff; border-right: 1px solid #111; }
    .pe-section { padding: 14px 14px 4px; }
    .pe-section-head { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
    .pe-section-head h2 { margin: 0; font-size: 13px; letter-spacing: .04em; }
    .pe-field { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
    .pe-field > span { width: 120px; flex: none; color: var(--muted); }
    .pe-field input { flex: 1; min-width: 0; padding: 4px 6px; border: 1px solid var(--line); }
    .pe-field input:focus { outline: none; border-color: #111; }

    .pe-sheet-wrap { overflow-x: auto; border: 1px solid #111; }
    table.pe-sheet { border-collapse: separate; border-spacing: 0; min-width: 100%; background: #fff; }
    .pe-sheet th, .pe-sheet td { height: var(--row-h); padding: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); vertical-align: middle; white-space: nowrap; }
    .pe-sheet th { padding: 0 6px; background: #111; color: #fff; font-weight: 500; text-align: left; }
    .pe-sheet tbody tr:hover td { background: #fafafa; }
    .pe-sheet tr.sub td { background: #f7f7f5; }
    .pe-sheet tr.gap td { background: repeating-linear-gradient(-45deg, #fff 0 6px, #f0f0f0 6px 7px); }
    .pe-sheet td.num { width: 30px; padding: 0 6px; color: var(--muted); text-align: right; }
    .pe-sheet td.check { width: 44px; text-align: center; }
    .pe-sheet td.actions { padding: 0 4px; }
    .pe-sheet td input[type="text"], .pe-sheet td select { width: 100%; height: var(--row-h); padding: 0 6px; border: 0; background: transparent; }
    .pe-sheet td input:focus, .pe-sheet td select:focus { outline: 2px solid #111; outline-offset: -2px; background: #fff; }
    .pe-sheet td.wide input { min-width: 320px; }
    .pe-sheet td.mid input { min-width: 160px; }
    .pe-sheet td.short input { min-width: 90px; }
    /* Image cell: a faint X marks an empty placeholder; an image fills the cell (cover). */
    .thumb { position: relative; display: block; width: 100%; min-width: 56px; height: var(--row-h); background: center / cover no-repeat; cursor: pointer; }
    .thumb.empty { background-image: linear-gradient(to top right, transparent calc(50% - .6px), #d4d4d4 50%, transparent calc(50% + .6px)), linear-gradient(to bottom right, transparent calc(50% - .6px), #d4d4d4 50%, transparent calc(50% + .6px)); }
    .thumb:hover, .thumb:focus-visible, .thumb.drop { box-shadow: inset 0 0 0 2px #111; outline: none; }
    .thumb.busy { opacity: .45; pointer-events: none; }
    .thumb .x { position: absolute; top: 0; right: 0; display: none; width: 15px; height: 15px; padding: 0; border: 0; background: #111; color: #fff; font-size: 9px; line-height: 15px; }
    .thumb:hover .x { display: block; }
    .thumb .x:hover { background: var(--danger); }
    .pe-sheet td.img { width: 64px; }
    .grip { cursor: grab; user-select: none; }
    .dragging { opacity: .4; }
    tr.drop-before > td { box-shadow: inset 0 2px 0 #111; }
    tr.drop-after > td { box-shadow: inset 0 -2px 0 #111; }

    .pe-preview { display: grid; grid-template-rows: auto 1fr; min-height: 0; background: var(--bg); }
    .pe-preview-bar { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--line); background: #fff; }
    .pe-stage { position: relative; overflow: hidden; }
    .pe-stage-inner { position: absolute; top: 12px; left: 50%; transform-origin: top center; box-shadow: 0 0 0 1px #111, 0 6px 24px rgba(0,0,0,.12); background: #fff; }
    .pe-stage iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }

    .toast { position: fixed; right: 16px; bottom: 16px; z-index: 30; max-width: 460px; padding: 10px 14px; background: #111; color: #fff; opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; pointer-events: none; white-space: pre-line; }
    .toast.show { opacity: 1; transform: none; }
    .toast.error { background: var(--danger); }
  `;

  const h = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else if (key in el) el[key] = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
    return el;
  };

  const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
  // Uploaded page images go to runtime/assets/pages/PC/.
  const ASSET_FOLDER = "pages";

  window.FiltPageEditor = ({ page, render }) => {
    const store = window.FiltStore;
    const $ = (selector) => document.querySelector(selector);
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);

    document.body.append(
      h("div", { class: "pe-layout", id: "peLayout" },
        h("main", { class: "pe-editor", id: "peEditor" }, h("p", { class: "pe-section muted" }, "불러오는 중…")),
        h("section", { class: "pe-preview", "aria-label": "미리보기" },
          h("div", { class: "pe-preview-bar" },
            h("strong", {}, "미리보기"),
            h("button", { class: "active", dataset: { device: "desktop" } }, "PC"),
            h("button", { dataset: { device: "mobile" } }, "모바일"),
            h("span", { class: "muted", id: "peSize" }),
            h("span", { class: "spacer" }),
            h("span", { class: "muted" }, "저장 전 내용 기준")),
          h("div", { class: "pe-stage", id: "peStage" },
            h("div", { class: "pe-stage-inner", id: "peStageInner" }, h("iframe", { id: "peFrame", title: `${page} 미리보기` }))))),
      h("input", { type: "file", id: "pePicker", accept: "image/*", multiple: true, hidden: true }),
      h("div", { class: "toast", id: "peToast", role: "status", "aria-live": "polite" }),
    );

    let toastTimer;
    const toast = (message, isError = false) => {
      const el = $("#peToast");
      el.textContent = message;
      el.classList.toggle("error", isError);
      el.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove("show"), isError ? 6000 : 2600);
    };

    let dirty = false;
    let dragging = null;
    let previewTimer = null;
    const markDirty = () => {
      dirty = true;
      $("#dirty").classList.add("show");
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 500);
    };
    const setClean = () => { dirty = false; $("#dirty").classList.remove("show"); };

    const pickFiles = () => new Promise((resolve) => {
      const picker = $("#pePicker");
      picker.value = "";
      picker.onchange = () => resolve([...picker.files]);
      picker.click();
    });
    const upload = async (file) => (await store.upload(ASSET_FOLDER, "PC", file)).PC;
    const imageSlot = (src, { upload, clear, resolve }) => {
      const box = h("div", {
        class: `thumb ${src ? "filled" : "empty"}`,
        tabindex: 0,
        role: "button",
        title: src ? `${src}
클릭하거나 파일을 끌어다 놓으면 교체` : "클릭하거나 파일을 끌어다 놓아 업로드",
      });
      if (src) resolve(src).then((url) => { if (url) box.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`; });
      const run = async (file) => {
        if (!file) return;
        box.classList.add("busy");
        try {
          toast("업로드 중…");
          await upload(file);
          toast("업로드 완료");
        } catch (error) {
          box.classList.remove("busy");
          toast(error.message, true);
        }
      };
      const pick = () => {
        const picker = h("input", { type: "file", accept: "image/*", onchange: () => run(picker.files[0]) });
        picker.click();
      };
      box.addEventListener("click", (event) => { if (!event.target.closest(".x")) pick(); });
      box.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } });
      const isFile = (event) => event.dataTransfer?.types.includes("Files");
      box.addEventListener("dragover", (event) => { if (!isFile(event)) return; event.preventDefault(); box.classList.add("drop"); });
      box.addEventListener("dragleave", () => box.classList.remove("drop"));
      box.addEventListener("drop", (event) => {
        if (!isFile(event)) return;
        event.preventDefault();
        event.stopPropagation();
        box.classList.remove("drop");
        run(event.dataTransfer.files[0]);
      });
      if (src) box.append(h("button", { class: "x", title: "이미지 빼기", onclick: () => { if (confirm("이미지를 뺄까요?")) clear(); } }, "✕"));
      return box;
    };

    const ctx = {
      data: { version: 1 },
      h,
      toast,
      markDirty,
      rerender: () => $("#peEditor").replaceChildren(...[render(ctx)].flat()),
      pickFiles,
      upload,

      // A text input bound to obj[key]; empty strings are removed so the JSON stays as written by hand.
      input: (obj, key, props = {}) => h("input", {
        type: "text",
        size: 1, // width comes from the column's min-width, not the default 20 characters
        value: obj[key] ?? "",
        oninput: (event) => {
          if (event.target.value === "" && !props.keepEmpty) delete obj[key];
          else obj[key] = event.target.value;
          markDirty();
        },
        ...props,
      }),
      checkbox: (obj, key) => h("input", {
        type: "checkbox",
        checked: Boolean(obj[key]),
        onchange: (event) => {
          if (event.target.checked) obj[key] = true;
          else delete obj[key];
          markDirty();
        },
      }),
      // Image placeholder for obj[key]: click or drop a file to upload, ✕ to clear.
      image: (obj, key) => imageSlot(obj[key], {
        resolve: store.assetUrl,
        upload: async (file) => { obj[key] = await upload(file); ctx.rerender(); markDirty(); },
        clear: () => { delete obj[key]; ctx.rerender(); markDirty(); },
      }),
      remove: (list, index, label = "이 행") => h("button", {
        class: "small danger",
        title: "삭제",
        onclick: () => {
          if (!confirm(`${label}을(를) 삭제할까요?`)) return;
          list.splice(index, 1);
          ctx.rerender();
          markDirty();
        },
      }, "✕"),
      // Reorders list[index] by dragging el from its handle. Drops only land on items with the same
      // scope; the drop goes before or after the target depending on which half the pointer is in.
      draggable: (el, { list, index, scope = list, handle = el, axis = "y" }) => {
        handle.classList.add("grip");
        handle.title = handle.title || "끌어서 순서 변경";
        handle.addEventListener("mousedown", () => { el.draggable = true; });
        handle.addEventListener("mouseup", () => { el.draggable = false; });
        const after = (event) => {
          const box = el.getBoundingClientRect();
          return axis === "x" ? event.clientX > box.left + box.width / 2 : event.clientY > box.top + box.height / 2;
        };
        const clear = () => el.classList.remove("drop-before", "drop-after");
        el.addEventListener("dragstart", (event) => {
          if (event.target !== el) return;
          dragging = { list, index, scope };
          el.classList.add("dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", "");
        });
        el.addEventListener("dragend", () => { dragging = null; el.draggable = false; el.classList.remove("dragging"); });
        el.addEventListener("dragover", (event) => {
          if (dragging?.scope !== scope) return;
          event.preventDefault();
          const isAfter = after(event);
          el.classList.toggle("drop-after", isAfter);
          el.classList.toggle("drop-before", !isAfter);
        });
        el.addEventListener("dragleave", clear);
        el.addEventListener("drop", (event) => {
          if (dragging?.scope !== scope) return;
          event.preventDefault();
          clear();
          const from = dragging.index;
          let to = index + (after(event) ? 1 : 0);
          if (from < to) to -= 1;
          dragging = null;
          if (to === from) return;
          list.splice(to, 0, list.splice(from, 1)[0]);
          ctx.rerender();
          markDirty();
        });
        return el;
      },
      section: (title, tools, ...body) => h("section", { class: "pe-section" },
        h("div", { class: "pe-section-head" }, h("h2", {}, title), h("span", { class: "spacer" }), tools),
        body),
      sheet: (headers, rows) => h("div", { class: "pe-sheet-wrap" },
        h("table", { class: "pe-sheet" },
          h("thead", {}, h("tr", {}, headers.map((label) => h("th", {}, label)))),
          h("tbody", {}, rows))),
    };

    // ---------- preview (real runtime/pages.js with unsaved data) ----------

    let device = "desktop";
    let previewUrl = null;
    let previewToken = 0;

    const layoutStage = () => {
      const stage = $("#peStage");
      if (!stage.clientWidth) return;
      const size = VIEWPORTS[device];
      const scale = Math.min(1, (stage.clientWidth - 24) / size.width);
      const height = device === "mobile" ? Math.min(size.height, (stage.clientHeight - 24) / scale) : (stage.clientHeight - 24) / scale;
      const inner = $("#peStageInner");
      inner.style.width = `${size.width}px`;
      inner.style.height = `${height}px`;
      inner.style.transform = `translateX(-50%) scale(${scale})`;
      $("#peSize").textContent = `${size.width}px · ${Math.round(scale * 100)}%`;
    };

    // Uploaded images are paths relative to runtime/; give the preview URLs this browser can load.
    const resolveAssets = async (value) => {
      if (Array.isArray(value)) return Promise.all(value.map(resolveAssets));
      if (!value || typeof value !== "object") return value;
      const out = {};
      await Promise.all(Object.entries(value).map(async ([key, item]) => {
        out[key] = (key === "src" || key === "image") && typeof item === "string" ? await store.assetUrl(item) : await resolveAssets(item);
      }));
      return out;
    };

    const renderPreview = async () => {
      const token = ++previewToken;
      const copy = await resolveAssets(ctx.data);
      if (token !== previewToken) return;
      const nextUrl = URL.createObjectURL(new Blob([JSON.stringify(copy)], { type: "application/json" }));
      const src = store.runtimeUrl("pages.js");
      $("#peFrame").srcdoc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0}</style></head><body><div data-filt-page></div><script src="${src}" data-page="${page}" data-page-src="${nextUrl}" data-works-url="#"><\/script></body></html>`;
      if (previewUrl) setTimeout(URL.revokeObjectURL.bind(URL, previewUrl), 5000);
      previewUrl = nextUrl;
    };

    document.querySelectorAll(".pe-preview [data-device]").forEach((button) => button.addEventListener("click", () => {
      device = button.dataset.device;
      document.querySelectorAll(".pe-preview [data-device]").forEach((other) => other.classList.toggle("active", other === button));
      layoutStage();
    }));
    new ResizeObserver(layoutStage).observe($("#peStage"));

    // ---------- load / save ----------

    const save = async () => {
      try {
        const result = await store.savePage(page, ctx.data);
        setClean();
        toast(`저장했습니다: ${result.path}\n공개 페이지에는 deploy를 누르면 반영됩니다.`);
      } catch (error) {
        toast(error.message, true);
      }
    };
    $("#save").addEventListener("click", save);
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    });
    window.addEventListener("beforeunload", (event) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    });

    (async () => {
      try {
        await store.ready();
        store.mountHeader($("#account"));
        ctx.data = await store.getPage(page);
        ctx.rerender();
        layoutStage();
        renderPreview();
      } catch (error) {
        toast(error.message, true);
      }
    })();

    return ctx;
  };
})();
