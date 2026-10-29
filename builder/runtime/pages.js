// HOME, OFFICE and NEWS pages, ported from the hand-written Imweb widgets (filtehwa/filt_website).
// Content lives in pages/<page>.json; this file only draws it.
//   <script src=".../loader.js" data-template="office"></script>
// The mount is optional: <div data-filt-page></div> marks where to draw, otherwise it goes after the script.
(() => {
  const script = document.currentScript;
  if (!script) throw new Error("Pages script element is unavailable.");

  const PAGES = ["home", "office", "news"];
  const page = PAGES.includes(script.dataset.page) ? script.dataset.page : null;
  if (!page) {
    console.error(`FILT pages: unknown data-page "${script.dataset.page}".`);
    return;
  }

  let mount = document.querySelector("[data-filt-page]");
  if (!mount) {
    mount = document.createElement("div");
    mount.dataset.filtPage = "";
    script.after(mount);
  }

  const templateBase = new URL(".", script.src);
  // Uploaded images are stored as relative paths (assets/pages/PC/x.jpg) and served from the images repo.
  const imagesBase = "https://filt-office.github.io/filt-website-images/";
  const resolveAsset = (src) => (src ? new URL(src, /^assets\//.test(src) ? imagesBase : templateBase).href : "");
  const worksUrl = script.dataset.worksUrl || "/works_list";

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
  const stylesReady = addLink("pages", new URL(`pages.css${new URL(script.src).search}`, templateBase).href);
  addLink("suit-font", "https://cdn.jsdelivr.net/npm/suit-font@1.0.0/dist/suit.min.css").catch(() => {});
  addLink("pretendard-font", "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css").catch(() => {});

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener("load", resolve, { once: true });
      return;
    }
    const element = document.createElement("script");
    element.src = src;
    element.async = false;
    element.addEventListener("load", () => { element.dataset.loaded = "1"; resolve(); }, { once: true });
    element.addEventListener("error", reject, { once: true });
    document.body.append(element);
  });
  // Same URLs as common-menu-v2.js, so the libraries load once.
  const GSAP = "https://unpkg.com/gsap@3/dist/gsap.min.js";
  const MORPH = "https://assets.codepen.io/16327/MorphSVGPlugin3.min.js";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const go = (href) => { if (href) location.href = href; };
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  // Mirrors the common menu's open state onto <body> so the left column can slide (as on Works).
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

  const loadMenu = ({ homeButton = true } = {}) => {
    loadScript(new URL("common-menu-v2.js", templateBase).href).catch(() => {});
    if (homeButton) loadScript(new URL("home-button.js", templateBase).href).catch(() => {});
  };

  // ---------- shared PC frame for OFFICE / NEWS: section column (75%) + right panel (25%) ----------
  const section = (title) => {
    const sec = el("section", "sec");
    const inner = el("div", "sec__inner");
    const header = el("header", "sec__header");
    header.append(el("h3", "sec__title", title), el("div", "sec__divider"));
    inner.append(header);
    sec.append(inner);
    return { sec, inner };
  };

  const desktopFrame = (sections, right) => {
    const app = el("div", "info-desktop");
    const left = el("div", "left");
    left.append(el("section", "sec empty"), ...sections);
    app.append(left, right || el("div", "right"));
    return app;
  };

  // ---------- shared mobile frame: header bar + category filter + page ----------
  const mobileFrame = (categories, onFilter, content) => {
    const wrapper = el("div", "info-mobile");
    const header = el("header", "mobile-header");
    header.setAttribute("aria-hidden", "true");
    const filter = el("nav", "category-filter");
    categories.forEach(({ id, label }, index) => {
      const button = el("button", `filter-btn${index === 0 ? " active" : ""}`, label);
      button.type = "button";
      button.addEventListener("click", () => {
        filter.querySelectorAll(".filter-btn").forEach((other) => other.classList.toggle("active", other === button));
        onFilter(id);
      });
      filter.append(button);
    });
    const main = el("main", "mobile-page");
    main.append(...content);
    wrapper.append(header, filter, main);
    return wrapper;
  };

  // ---------- HOME ----------
  const LOADING_FROM = "M237,0v1613.63 M419.5,1568.63h195 M-240,1706.13H347 M214.5,1768.63h270 M457,1898.63h137.5 M814.5,1756.13H1300 M564.5,2038.63H843 M457,1831.13v377.5 M1039.5,1756.13v197.5 M843,2038.63H1400 M334.5,1553.63v152.5 M739.51,2556v-382.38";
  const LOADING_TO = "M494.5,1163v230 M482,1175.5h82.5 M452,1265.5h25 M512,1265.5h40 M552,1265.5h40 M627,1265.5h40 M677,1163v85 M609.5,1163v230 M677,1283v110 M667,1265.5h60 M552,1283v110 M659.5,1380.5h-62.5";
  const lines = (d) => d.match(/[Mm][^Mm]*/g).map((line) => line.trim());

  const renderHome = (data) => {
    const target = data.worksLink || worksUrl;
    window.FILT_MENU_MODE = "home"; // common menu: panel pinned open, no mobile menu

    // PC: full-screen vertical slideshow under the open menu panel.
    const gallery = el("main", "home-slides");
    const stack = el("section", "slides");
    const slides = (data.slides || []).map((slide, index) => {
      const img = el("img");
      img.src = resolveAsset(slide.src);
      img.alt = slide.alt || "";
      img.style.objectPosition = slide.position || "center center";
      if (index) img.loading = "lazy";
      img.classList.toggle("is-current", index === 0);
      stack.append(img);
      return img;
    });
    const prevZone = el("div", "click-zone prev");
    const nextZone = el("div", "click-zone next");
    gallery.append(stack, prevZone, nextZone);

    let current = 0;
    let busy = false;
    let timer = null;
    const EASE = "cubic-bezier(0.45, 0, 0.55, 1)"; // GSAP power2.inOut
    const goTo = (next, direction) => {
      if (busy || next === current || !slides[next]) return;
      busy = true;
      const cur = slides[current];
      const nxt = slides[next];
      nxt.classList.add("is-incoming");
      const timing = { duration: 1250, easing: EASE, fill: "forwards" };
      cur.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-direction * 100}%)` }], timing);
      nxt.animate([{ transform: `translateY(${direction * 100}%)` }, { transform: "translateY(0)" }], timing).finished.then(() => {
        cur.classList.remove("is-current");
        nxt.classList.replace("is-incoming", "is-current");
        cur.getAnimations().forEach((animation) => animation.cancel());
        nxt.getAnimations().forEach((animation) => animation.cancel());
        current = next;
        busy = false;
      });
    };
    const startAuto = () => {
      clearInterval(timer);
      timer = setInterval(() => goTo((current + 1) % slides.length, 1), 10000);
    };
    // Right edge: top half = previous (slides down), bottom half = next (slides up).
    nextZone.addEventListener("click", (event) => { event.stopPropagation(); goTo((current + 1) % slides.length, 1); startAuto(); });
    prevZone.addEventListener("click", (event) => { event.stopPropagation(); goTo((current - 1 + slides.length) % slides.length, -1); startAuto(); });
    // Between the menu panel and the right 20%, the photo opens WORKS.
    const isWorksArea = (event) => {
      const panel = document.querySelector("#filt-common-menu-v2 .side-panel");
      const menuRight = panel ? panel.getBoundingClientRect().right : 240;
      return !event.target.closest(".click-zone") && event.clientX >= menuRight && event.clientX < document.documentElement.clientWidth * 0.8;
    };
    gallery.addEventListener("mousemove", (event) => { gallery.style.cursor = isWorksArea(event) ? "pointer" : "default"; });
    gallery.addEventListener("click", (event) => { if (isWorksArea(event)) go(target); });
    if (slides.length > 1) startAuto();

    // Mobile: the FILT logo unfolds, then WORKS opens.
    const loading = el("div", "home-loading");
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 1200 2600");
    const paths = lines(LOADING_FROM).map((d) => {
      const path = document.createElementNS(svgNs, "path");
      path.setAttribute("d", d);
      svg.append(path);
      return path;
    });
    loading.append(svg);

    let left = false;
    const goNext = () => {
      if (!isMobile() || left) return;
      left = true;
      loading.classList.add("fade-out");
      setTimeout(() => go(target), 500);
    };
    svg.addEventListener("click", goNext);
    const playLoading = async () => {
      try {
        await loadScript(GSAP);
        await loadScript(MORPH);
        window.gsap.registerPlugin(window.MorphSVGPlugin);
      } catch (error) {
        svg.style.opacity = "1";
        setTimeout(goNext, 1500);
        return;
      }
      const { gsap } = window;
      gsap.to(svg, { opacity: 1, duration: 0.3, ease: "power2.out" });
      setTimeout(() => {
        const timeline = gsap.timeline({ defaults: { duration: 1.8, ease: "power2.inOut" }, onComplete: goNext });
        const ends = lines(LOADING_TO);
        paths.forEach((path, index) => timeline.to(path, { morphSVG: { shape: ends[index], shapeIndex: 0 } }, 0));
      }, 300);
    };
    if (isMobile()) playLoading();

    mount.replaceChildren(gallery, loading);
    loadMenu({ homeButton: false });
  };

  // ---------- OFFICE ----------
  const spacedName = (name) => [...(name || "").replace(/\s+/g, "")].join(" ");

  const renderOffice = (data) => {
    const contact = data.contact || [];
    const people = data.people || [];

    // PC
    const office = section("OFFICE");
    contact.forEach((entry) => {
      const item = el("div", "item");
      if (entry.link && entry.link.startsWith("mailto:")) {
        const anchor = el("a", "", entry.text);
        anchor.href = entry.link;
        item.append(anchor);
      } else {
        item.append(el("p", "", entry.text));
        if (entry.link) item.addEventListener("click", () => go(entry.link));
      }
      office.inner.append(item);
    });
    office.sec.append(el("div", "sec__divider"));

    const personItem = (person) => {
      const item = el("div", `item person${person.principal ? " principal" : ""}`);
      const row = (name, role, email) => {
        const main = el("div", "main");
        main.append(el("span", "name", name), el("span", "role", role), el("span", "email", email));
        return main;
      };
      const info = el("div", `info${person.principal ? " open" : ""}`);
      (person.career || []).forEach((step) => {
        if (step.gap) { info.append(el("div", "spacer")); return; }
        const line = el("div", step.current ? "is-bold" : "");
        line.append(el("span", "", step.years), el("span", "", step.org), el("span", "", step.title || ""));
        info.append(line);
      });
      item.append(row(spacedName(person.nameKo), person.roleKo, ""), row(person.nameEn, person.roleEn, person.email), info);
      if (!person.principal) {
        item.addEventListener("mouseenter", () => info.classList.add("open"));
        item.addEventListener("mouseleave", () => info.classList.remove("open"));
        item.addEventListener("click", () => info.classList.toggle("open"));
      }
      return item;
    };
    const principals = people.filter((person) => person.principal);
    const others = people.filter((person) => !person.principal);

    // PC: the principal's photo on the right; hovering a person shows theirs (an empty frame when none).
    const right = el("div", "right");
    const portrait = el("div", "thumbnail portrait");
    const photo = el("img", "thumb");
    photo.alt = "";
    portrait.append(photo);
    right.append(portrait);
    const showPhoto = (person) => {
      const src = resolveAsset(person && person.image);
      portrait.classList.toggle("is-empty", !src);
      if (!src) { photo.removeAttribute("src"); photo.classList.remove("show"); return; }
      if (photo.getAttribute("src") === src) return;
      photo.classList.remove("show");
      photo.onload = () => photo.classList.add("show");
      photo.src = src;
      if (photo.complete) photo.classList.add("show");
    };
    const defaultPerson = principals[0] || people[0];
    if (people.length) showPhoto(defaultPerson);
    else right.replaceChildren();
    let photoTimeout = null;
    const withPhoto = (person, item) => {
      item.addEventListener("mouseenter", () => { clearTimeout(photoTimeout); showPhoto(person); });
      item.addEventListener("mouseleave", () => { photoTimeout = setTimeout(() => showPhoto(defaultPerson), 200); });
      return item;
    };

    const peopleSec = section("PEOPLE");
    peopleSec.sec.classList.add("people");
    peopleSec.inner.append(...principals.map((person) => withPhoto(person, personItem(person))));
    const teamSec = el("section", "sec people");
    const teamInner = el("div", "sec__inner");
    teamInner.append(...others.map((person) => withPhoto(person, personItem(person))));
    teamSec.append(el("div", "sec__divider"), teamInner, el("div", "sec__divider"));
    const desktop = desktopFrame([office.sec, peopleSec.sec, teamSec], right);
    desktop.dataset.page = "office";

    // Mobile
    const officeContent = el("div", "office-content");
    const officeSection = el("div", "office-section");
    contact.forEach((entry) => {
      const line = el("p", "", entry.mobileText || entry.text);
      if (entry.link) line.addEventListener("click", () => go(entry.link));
      officeSection.append(line);
    });
    officeContent.append(officeSection);

    const peopleContent = el("div", "people-content");
    peopleContent.hidden = true;
    const mobileRow = (cells, bold) => {
      const row = el("div", "people-row");
      cells.forEach((cell) => row.append(el("div", `col${bold ? " bold" : ""}`, cell || "")));
      return row;
    };
    const mobileBlock = (person) => {
      const block = el("div", `people-block${person.principal ? " always-open" : " designer-block"}`);
      const timeline = el("div", `timeline${person.principal ? " open" : ""}`);
      timeline.append(el("div", "gap-5"));
      (person.career || []).filter((step) => !step.gap).forEach((step) => {
        timeline.append(mobileRow([step.years, step.mobileOrg ?? step.org, step.mobileTitle ?? step.title]));
      });
      block.append(
        mobileRow([person.nameKo, person.roleKo], true),
        mobileRow([person.nameEn, person.roleEn, person.email], true),
        timeline,
      );
      if (!person.principal) {
        block.addEventListener("click", () => {
          const open = block.classList.toggle("open");
          timeline.style.maxHeight = open ? `${timeline.scrollHeight}px` : "0";
        });
      }
      return block;
    };
    principals.forEach((person) => peopleContent.append(mobileBlock(person), el("div", "divider-hr"), el("div", "gap-15")));
    others.forEach((person, index) => {
      if (index) peopleContent.append(el("div", "gap-10"));
      peopleContent.append(mobileBlock(person));
    });

    const mobile = mobileFrame(
      [{ id: "office", label: "Office" }, { id: "people", label: "People" }],
      (id) => { officeContent.hidden = id !== "office"; peopleContent.hidden = id !== "people"; },
      [officeContent, peopleContent],
    );
    mobile.dataset.page = "office";

    mount.replaceChildren(desktop, mobile);
    syncCommonMenuState();
    loadMenu();
  };

  // ---------- NEWS ----------
  const renderNews = (data) => {
    const news = data.news || [];
    const recruit = data.recruit || [];
    const empty = data.recruitEmpty || "진행중인 채용 공고가 없습니다.";

    // PC: rows with a hover preview on the right.
    const right = el("div", "right");
    const thumbnail = el("div", "thumbnail");
    const thumb = el("img", "thumb");
    thumb.alt = "preview";
    thumbnail.append(thumb);
    right.append(thumbnail);
    let hideTimeout = null;
    const desktopRow = (entry) => {
      const item = el("div", "item");
      item.append(el("span", "", entry.title), el("span", "", entry.date), el("span", "", entry.type), el("span", "", entry.author));
      item.addEventListener("mouseenter", () => {
        if (!entry.image) return;
        clearTimeout(hideTimeout);
        thumb.src = resolveAsset(entry.image);
        if (thumb.complete) thumb.classList.add("show");
        else thumb.onload = () => thumb.classList.add("show");
      });
      item.addEventListener("mouseleave", () => {
        hideTimeout = setTimeout(() => thumb.classList.remove("show"), 200);
      });
      if (entry.link) item.addEventListener("click", () => go(entry.link));
      return item;
    };
    const newsSec = section("NEWS");
    newsSec.inner.append(...news.map(desktopRow));
    const recruitSec = section("RECRUIT");
    recruitSec.inner.append(...(recruit.length ? recruit.map(desktopRow) : [el("div", "item", empty)]));
    const desktop = desktopFrame([newsSec.sec, recruitSec.sec], right);
    desktop.dataset.page = "news";

    // Mobile: accordion rows (one open at a time) with the picture and text.
    const pairs = [];
    const mobileRow = (entry, category) => {
      const row = el("div", "news-row");
      row.append(
        el("div", "list-title", entry.mobileTitle || entry.title),
        el("div", "list-date", entry.date || "-"),
        el("div", "list-extra", entry.author || "-"),
      );
      const timeline = el("div", "timeline");
      const body = el("div", "news-body");
      if (entry.image) {
        const img = el("img");
        img.src = resolveAsset(entry.image);
        img.alt = "";
        img.loading = "lazy";
        body.append(img);
      }
      body.append(document.createTextNode(entry.text ? `- ${entry.text}` : "-"));
      timeline.append(el("div", "gap-6"), body, el("div", "gap-10"));
      const pair = { row, timeline, category };
      row.addEventListener("click", () => {
        const open = row.classList.contains("open");
        pairs.forEach((other) => { other.row.classList.remove("open"); other.timeline.style.maxHeight = "0px"; });
        if (!open) {
          row.classList.add("open");
          timeline.style.maxHeight = `${timeline.scrollHeight}px`;
        }
      });
      pairs.push(pair);
      return [row, timeline];
    };
    const grid = el("div", "news-grid");
    news.forEach((entry) => grid.append(...mobileRow(entry, "News")));
    (recruit.length ? recruit : [{ title: empty }]).forEach((entry) => grid.append(...mobileRow(entry, "Recruit")));

    const mobile = mobileFrame(
      [{ id: "all", label: "All" }, { id: "News", label: "News" }, { id: "Recruit", label: "Recruit" }],
      (id) => pairs.forEach((pair) => {
        const show = id === "all" || pair.category === id;
        pair.row.hidden = !show;
        pair.timeline.hidden = !show;
        if (!show) { pair.row.classList.remove("open"); pair.timeline.style.maxHeight = "0px"; }
      }),
      [grid],
    );
    mobile.dataset.page = "news";

    mount.replaceChildren(desktop, mobile);
    syncCommonMenuState();
    loadMenu();
  };

  const RENDER = { home: renderHome, office: renderOffice, news: renderNews };

  Promise.all([
    stylesReady,
    // data-page-src lets the builder preview unsaved data; production uses pages/<page>.json.
    fetch(script.dataset.pageSrc || new URL(`pages/${page}.json`, templateBase)).then((response) => {
      if (!response.ok) throw new Error(`Page data request failed (${response.status}).`);
      return response.json();
    }),
  ])
    .then(([, data]) => {
      mount.classList.add("filt-page");
      mount.dataset.page = page;
      RENDER[page](data);
    })
    .catch((error) => {
      console.error("Page template could not render.", error);
      const message = document.createElement("p");
      message.textContent = `페이지를 불러오지 못했습니다: ${error.message}`;
      mount.replaceChildren(message);
    });
})();
