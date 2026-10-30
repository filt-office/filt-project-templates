(() => {
  const script = document.currentScript;
  if (!script) throw new Error("Works script element is unavailable.");

  let view = script.dataset.view === "gallery" ? "gallery" : "list";
  const mount = document.querySelector("[data-filt-works]");
  if (!mount) {
    console.error("Works template requires a data-filt-works mount.");
    return;
  }

  const templateBase = new URL(".", script.src);
  // Relative thumbnails are uploaded assets (assets/works/PC/...) served from the images repo;
  // mobile uses the MOB copy.
  const imagesBase = "https://filt-office.github.io/filt-website-images/";
  const resolveAsset = (src, device = "PC") => {
    if (!src) return "";
    const path = device === "MOB" ? src.replace(/^assets\/([^/]+)\/PC\//, "assets/$1/MOB/") : src;
    return new URL(path, /^assets\//.test(path) ? imagesBase : templateBase).href;
  };
  const listUrl = script.dataset.listUrl || "/works_list";
  const galleryUrl = script.dataset.galleryUrl || "/works_gallery";
  // With data-project-page="/project", rows with a projectId open the shared detail page (/project?id=<projectId>).
  const projectPage = script.dataset.projectPage || "";

  const addLink = (key, href) => {
    if (document.querySelector(`link[data-filt-template="${key}"]`)) return Promise.resolve();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.filtTemplate = key;
    const loaded = new Promise((resolve, reject) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", reject, { once: true });
    });
    document.head.append(link);
    return loaded;
  };
  // The builder adds ?v=… to bust caches; pass it on to the stylesheet too.
  const stylesReady = addLink("works", new URL(`works.css${new URL(script.src).search}`, templateBase).href);
  addLink("suit-font", "https://cdn.jsdelivr.net/npm/suit-font@1.0.0/dist/suit.min.css").catch(() => {});
  addLink("pretendard-font", "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css").catch(() => {});

  const loadScript = (src) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const element = document.createElement("script");
    element.src = src;
    element.async = false;
    document.body.append(element);
  };

  // Site colours (--filt-key, --filt-<id>) from pages/design.json.
  loadScript(new URL("design.js", templateBase).href);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // With a shared detail page, only rows whose project is published (release.sh keeps their projectId) open it;
  // their old Imweb links are gone or redirect home, so the other rows are listed but not clickable.
  // Without one (older widgets), rows still follow their own link.
  const linkTo = (node, work) => {
    const href = projectPage ? (work.projectId ? `${projectPage}?id=${encodeURIComponent(work.projectId)}` : "") : work.link;
    if (!href) return;
    node.classList.add("is-linked");
    node.addEventListener("click", () => { location.href = href; });
  };

  const byGalleryOrder = (works) => works
    .map((work, index) => ({ work, index }))
    .sort((a, b) => (a.work.galleryOrder ?? Infinity) - (b.work.galleryOrder ?? Infinity) || a.index - b.index)
    .map(({ work }) => work);

  const icon = {
    gallery: '<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect x="0.5" y="0.5" width="17" height="17" fill="#fff" stroke="#000" stroke-width="2.5"/><path d="M17,13 L13,8 L9,13 L7,10 L1,17" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>',
    list: '<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><line y1="0.5" x2="18" y2="0.5" stroke="#000" stroke-width="2"/><line y1="6.17" x2="18" y2="6.17" stroke="#000" stroke-width="4"/><line y1="11.83" x2="18" y2="11.83" stroke="#000" stroke-width="2"/><line y1="17.5" x2="18" y2="17.5" stroke="#000" stroke-width="2"/></svg>',
  };

  const viewToolbar = () => {
    const toolbar = el("header", "view-toolbar");
    const buttons = el("div", "view-btns");
    [["gallery", galleryUrl, "Gallery view"], ["list", listUrl, "List view"]].forEach(([name, href, label]) => {
      const anchor = el("a", `${name}-btn`);
      anchor.href = href;
      anchor.setAttribute("aria-label", label);
      // "#" (the builder preview) switches the view in place instead of opening the other page.
      if (href === "#") {
        anchor.addEventListener("click", (event) => {
          event.preventDefault();
          if (view === name) return;
          view = name;
          render(currentData);
        });
      }
      anchor.innerHTML = icon[name];
      buttons.append(anchor);
    });
    toolbar.append(buttons);
    return toolbar;
  };

  // ---------- PC list: category sections + hover preview ----------
  const renderDesktopList = (data) => {
    const main = el("main", "works-desktop");
    const left = el("div", "left-container");
    const preview = el("div", "preview");
    const thumbnail = el("div", "thumbnail");
    const thumb = el("img");
    thumb.alt = "preview";
    thumbnail.append(thumb);
    preview.append(viewToolbar(), thumbnail);

    let hideTimeout = null;
    const showThumb = (src) => {
      clearTimeout(hideTimeout);
      if (!src) return;
      thumb.onerror = () => { thumb.classList.remove("show"); thumb.removeAttribute("src"); };
      thumb.classList.remove("show");
      thumb.src = src;
      if (thumb.complete && thumb.naturalWidth > 0) thumb.classList.add("show");
      else thumb.onload = () => thumb.classList.add("show");
    };
    const hideThumb = () => { hideTimeout = setTimeout(() => thumb.classList.remove("show"), 120); };

    data.categories.forEach((category) => {
      const works = data.works.filter((work) => work.category === category.id && work.show?.list);
      if (!works.length) return;
      const section = el("section", "sec");
      const header = el("div", "sec__header");
      header.append(el("p", "title", category.label));
      const list = el("div", "sec__list");
      works.forEach((work) => {
        const item = el("div", "item");
        [work.nameKo, work.nameEn, work.year, work.program, work.location, work.status]
          .forEach((value) => item.append(el("span", "", value || "")));
        const src = resolveAsset(work.thumb);
        item.addEventListener("mouseenter", () => showThumb(src));
        item.addEventListener("mouseleave", hideThumb);
        linkTo(item, work);
        list.append(item);
      });
      section.append(header, list);
      left.append(section);
    });

    main.append(left, preview);
    return main;
  };

  // ---------- PC gallery: 3-column cards ----------
  const renderDesktopGallery = (data) => {
    const main = el("main", "works-desktop");
    const left = el("div", "left");
    const section = el("section", "sec__gallery");
    const grid = el("div", "gallery-grid");
    byGalleryOrder(data.works.filter((work) => work.show?.gallery)).forEach((work) => {
      const item = el("div", "gallery-item");
      const img = el("img");
      img.src = resolveAsset(work.cardThumb || work.thumb);
      img.alt = work.nameEn || work.nameKo || "";
      img.loading = "lazy";
      item.append(img, el("p", "caption", `${work.nameKo || ""}|${work.nameEn || ""}`));
      linkTo(item, work);
      grid.append(item);
    });
    section.append(grid);
    left.append(section);
    const right = el("div", "right");
    right.append(viewToolbar());
    main.append(left, right);
    return main;
  };

  // ---------- Mobile: category filter + full-width cards (both views) ----------
  const renderMobile = (data) => {
    const wrapper = el("div", "works-mobile");
    const header = el("header", "mobile-header");
    header.setAttribute("aria-hidden", "true");

    const filter = el("nav", "category-filter");
    const grid = el("div", "works-grid");
    const items = byGalleryOrder(data.works.filter((work) => work.show?.mobile)).map((work) => {
      const item = el("article", "works-item");
      item.dataset.cat = work.category;
      const thumbBox = el("div", `works-thumb ${work.mobileShape || "square"}`);
      const img = el("img");
      img.src = resolveAsset(work.cardThumb || work.thumb, "MOB");
      img.alt = work.nameEn || work.nameKo || "";
      img.loading = "lazy";
      thumbBox.append(img);
      item.append(thumbBox, el("h6", "works-title", `${work.nameKo || ""}|${work.nameEn || ""}`));
      linkTo(item, work);
      grid.append(item);
      return item;
    });

    const categories = [{ id: "all", label: "All" }, ...data.categories];
    categories.forEach((category, index) => {
      const button = el("button", `filter-btn${index === 0 ? " active" : ""}`, category.label);
      button.type = "button";
      button.dataset.filter = category.id;
      button.addEventListener("click", () => {
        filter.querySelectorAll(".filter-btn").forEach((other) => other.classList.toggle("active", other === button));
        items.forEach((item) => { item.hidden = !(category.id === "all" || item.dataset.cat === category.id); });
      });
      filter.append(button);
    });

    const page = el("main", "mobile-page");
    page.append(grid);
    wrapper.append(header, filter, page);
    return wrapper;
  };

  // Mirrors the common menu's open state onto <body> so the left column can slide.
  const syncCommonMenuState = () => {
    const check = () => {
      const panel = document.getElementById("panel") || document.querySelector(".side-panel");
      document.body.classList.toggle("menu-open", Boolean(panel && panel.classList.contains("open")));
    };
    const observer = new MutationObserver(check);
    const attach = () => {
      check();
      observer.observe(document.getElementById("filt-common-menu-v2") || document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class"],
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
    else attach();
  };

  let currentData = null;
  const render = (data) => {
    if (!data || !Array.isArray(data.works) || !Array.isArray(data.categories)) {
      throw new Error("Works JSON is missing works or categories.");
    }
    currentData = data;
    mount.classList.add("filt-works");
    mount.dataset.view = view;
    mount.replaceChildren(
      view === "gallery" ? renderDesktopGallery(data) : renderDesktopList(data),
      renderMobile(data),
    );
    syncCommonMenuState();
    loadScript(new URL("common-menu-v2.js", templateBase).href);
    loadScript(new URL("home-button.js", templateBase).href);
  };

  Promise.all([
    stylesReady,
    // data-works-src lets the builder preview unsaved data; production uses works.json.
    fetch(script.dataset.worksSrc || new URL("works.json", templateBase)).then((response) => {
      if (!response.ok) throw new Error(`Works data request failed (${response.status}).`);
      return response.json();
    }),
  ])
    .then(([, data]) => render(data))
    .catch((error) => {
      console.error("Works template could not render.", error);
      const message = document.createElement("p");
      message.textContent = `작업 목록을 불러오지 못했습니다: ${error.message}`;
      mount.replaceChildren(message);
    });
})();
