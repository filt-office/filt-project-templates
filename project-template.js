(() => {
  const script = document.currentScript;
  if (!script) throw new Error("Project template script element is unavailable.");

  const projectId = script.dataset.projectId;
  const mount = projectId
    ? document.querySelector(`[data-filt-project="${CSS.escape(projectId)}"]`)
    : null;
  if (!projectId || !mount) {
    console.error("Project template requires a matching data-filt-project mount and data-project-id.");
    return;
  }

  const templateBase = new URL(".", script.src);
  const addLink = (key, href) => {
    const existing = document.querySelector(`link[data-filt-template="${key}"]`);
    if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
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

  const templateStylesReady = addLink("layout", new URL("project-template.css", templateBase).href);
  addLink("suit-font", "https://cdn.jsdelivr.net/npm/suit-font@1.0.0/dist/suit.min.css")
    .catch((error) => console.warn("SUIT font stylesheet could not be loaded.", error));
  addLink("pretendard-font", "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css")
    .catch((error) => console.warn("Pretendard font stylesheet could not be loaded.", error));

  const loadScript = (src) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const externalScript = document.createElement("script");
    externalScript.src = src;
    externalScript.async = false;
    document.body.append(externalScript);
  };

  const createFieldCell = (tagName, value, className) => {
    const cell = document.createElement(tagName);
    if (className) cell.className = className;
    String(value ?? "").split("\n").forEach((line, index) => {
      if (index) cell.append(document.createElement("br"));
      cell.append(document.createTextNode(line));
    });
    return cell;
  };

  const createOverview = (overview) => {
    const wrapper = document.createElement("div");
    wrapper.className = "fixed-table";
    const table = document.createElement("table");
    const colgroup = document.createElement("colgroup");
    for (let index = 0; index < 4; index += 1) {
      const col = document.createElement("col");
      col.style.width = "25%";
      colgroup.append(col);
    }
    table.append(colgroup);

    const fields = Array.isArray(overview.fields) ? overview.fields : [];
    const titleRow = document.createElement("tr");
    const titleCell = document.createElement("td");
    titleCell.rowSpan = 2;
    titleCell.colSpan = 2;
    titleCell.className = "project-title-cell";
    const title = document.createElement("div");
    title.className = "project-title-en";
    title.textContent = overview.titleEn || "";
    const subtitle = document.createElement("div");
    subtitle.className = "project-subtitle";
    subtitle.textContent = overview.subtitle || "";
    titleCell.append(title, subtitle);
    titleRow.append(titleCell);

    const appendField = (row, field) => {
      if (!field) return;
      row.append(createFieldCell("th", field.label));
      const valueCell = createFieldCell("td", field.value);
      if (field.areaM2 !== undefined && Number.isFinite(Number(field.areaM2))) {
        valueCell.dataset.areaM2 = String(Number(field.areaM2));
        valueCell.dataset.areaUnit = "m2";
        valueCell.addEventListener("click", toggleAreaUnits);
      }
      row.append(valueCell);
    };

    appendField(titleRow, fields[0]);
    table.append(titleRow);
    const secondTitleRow = document.createElement("tr");
    appendField(secondTitleRow, fields[1]);
    table.append(secondTitleRow);

    for (let index = 2; index < fields.length; index += 2) {
      const row = document.createElement("tr");
      appendField(row, fields[index]);
      appendField(row, fields[index + 1]);
      table.append(row);
    }

    wrapper.append(table);
    return wrapper;
  };

  function toggleAreaUnits() {
    const cells = Array.from(mount.querySelectorAll("[data-area-m2]"));
    const showSquareMeters = cells.some((cell) => cell.dataset.areaUnit === "py");
    cells.forEach((cell) => {
      const area = Number(cell.dataset.areaM2);
      cell.textContent = showSquareMeters
        ? `${area.toFixed(2)}㎡`
        : `${Math.round(area / 3.305785)}py`;
      cell.dataset.areaUnit = showSquareMeters ? "m2" : "py";
    });
  }

  const createImageSection = (images) => {
    const section = document.createElement("div");
    section.className = "img-section";
    section.setAttribute("aria-label", "Project images");
    (Array.isArray(images) ? images : []).forEach((image) => {
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || "";
      img.className = ["portrait", "landscape", "drawing"].includes(image.class) ? image.class : "landscape";
      img.dataset.fit = ["auto", "contain", "cover"].includes(image.fit) ? image.fit : "auto";
      img.dataset.rotation = [0, 90, 180, 270].includes(Number(image.rotation)) ? String(Number(image.rotation)) : "0";
      img.loading = "lazy";
      img.addEventListener("load", () => updateRotatedImageSize(section, img));
      section.append(img, document.createElement("hr"));
    });
    return section;
  };

  const createMobileDrawingSection = (drawingData) => {
    const drawings = Array.isArray(drawingData?.images)
      ? drawingData.images.filter((drawing) => drawing?.src)
      : [];
    if (!drawings.length) return null;

    const section = document.createElement("section");
    section.className = "mobile-drawing-section";
    section.setAttribute("aria-label", "Project drawings");

    const slider = document.createElement("div");
    slider.className = "mobile-drawing-slider";
    const slides = document.createElement("div");
    slides.className = "mobile-drawing-slides";
    drawings.forEach((drawing) => {
      const image = document.createElement("img");
      image.src = drawing.src;
      image.alt = drawing.alt || drawing.title || "";
      image.dataset.title = drawing.title || "";
      image.dataset.coordinate = drawing.coordinate === false ? "off" : "on";
      image.loading = "lazy";
      image.draggable = false;
      slides.append(image);
    });
    slider.append(slides);

    const addNavigationButton = (direction, label, handler) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mobile-drawing-click-zone ${direction}`;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", handler);
      slider.append(button);
    };

    const coordinateInfo = document.createElement("div");
    coordinateInfo.className = "mobile-drawing-info-coordinate";
    const coordinateImage = drawingData.coordinateSrc
      ? document.createElement("img")
      : null;
    if (coordinateImage) {
      coordinateImage.src = drawingData.coordinateSrc;
      coordinateImage.alt = "";
      coordinateImage.setAttribute("aria-hidden", "true");
      coordinateInfo.append(coordinateImage);
    }

    const scaleInfo = document.createElement("div");
    scaleInfo.className = "mobile-drawing-info-scale";
    const scaleImage = drawingData.scaleSrc
      ? document.createElement("img")
      : null;
    if (scaleImage) {
      scaleImage.src = drawingData.scaleSrc;
      scaleImage.alt = "";
      scaleImage.setAttribute("aria-hidden", "true");
      scaleInfo.append(scaleImage);
    }

    const titleInfo = document.createElement("div");
    titleInfo.className = "mobile-drawing-info-title";
    const title = document.createElement("span");
    titleInfo.append(title);

    const info = document.createElement("div");
    info.className = "mobile-drawing-info";
    info.append(coordinateInfo, scaleInfo, titleInfo);
    section.append(slider, info);

    const originalSlides = Array.from(slides.children);
    if (originalSlides.length > 1) {
      const firstClone = originalSlides[0].cloneNode(true);
      const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);
      firstClone.dataset.clone = "true";
      lastClone.dataset.clone = "true";
      slides.append(firstClone);
      slides.prepend(lastClone);
    }

    let currentSlide = originalSlides.length > 1 ? 1 : 0;
    let transitioning = false;
    let touchStartX = null;
    const originalSlideCount = originalSlides.length;

    const updateDrawingOverlays = () => {
      const index = currentSlide - (originalSlideCount > 1 ? 1 : 0);
      const normalizedIndex = (index + originalSlideCount) % originalSlideCount;
      const currentImage = originalSlides[normalizedIndex];
      title.textContent = currentImage.dataset.title;
      if (coordinateImage) {
        coordinateImage.style.display = currentImage.dataset.coordinate === "off" ? "none" : "block";
      }

      const sliderRect = slider.getBoundingClientRect();
      const naturalWidth = currentImage.naturalWidth;
      const naturalHeight = currentImage.naturalHeight;
      if (!naturalWidth || !naturalHeight || !sliderRect.width || !sliderRect.height) return;
      const scale = Math.min(sliderRect.width / naturalWidth, sliderRect.height / naturalHeight);
      [coordinateImage, scaleImage].filter(Boolean).forEach((image) => {
        image.style.width = `${naturalWidth * scale}px`;
        image.style.height = `${naturalHeight * scale}px`;
      });
    };

    originalSlides.forEach((image) => image.addEventListener("load", updateDrawingOverlays));

    const updateSlide = (animate = true) => {
      slides.style.transition = animate ? "transform 0.4s ease-out" : "none";
      slides.style.transform = `translateX(-${currentSlide * 100}%)`;
      updateDrawingOverlays();
    };
    const moveSlide = (direction) => {
      if (transitioning || originalSlideCount < 2) return;
      transitioning = true;
      currentSlide += direction;
      updateSlide();
    };

    addNavigationButton("left", "Previous drawing", () => moveSlide(-1));
    addNavigationButton("right", "Next drawing", () => moveSlide(1));
    slides.addEventListener("transitionend", () => {
      transitioning = false;
      if (currentSlide === originalSlideCount + 1) {
        currentSlide = 1;
        updateSlide(false);
      } else if (currentSlide === 0) {
        currentSlide = originalSlideCount;
        updateSlide(false);
      }
    });
    slider.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      touchStartX = event.clientX;
    });
    slider.addEventListener("pointerup", (event) => {
      if (touchStartX === null) return;
      const deltaX = touchStartX - event.clientX;
      touchStartX = null;
      if (Math.abs(deltaX) > 50) {
        event.preventDefault();
        moveSlide(deltaX > 0 ? 1 : -1);
      }
    });
    slider.addEventListener("pointercancel", () => { touchStartX = null; });
    window.addEventListener("resize", updateDrawingOverlays);
    updateSlide(false);
    return section;
  };

  const updateRotatedImageSize = (section, image) => {
    if (![90, 270].includes(Number(image.dataset.rotation))) return;
    image.style.setProperty("--rotate-width", `${section.clientHeight}px`);
    image.style.setProperty("--rotate-height", `${section.clientWidth}px`);
  };

  const initializeGallery = (section) => {
    const updateImageMode = () => {
      section.classList.toggle("portrait-mode", section.clientWidth / Math.max(section.clientHeight, 1) <= 1);
      section.querySelectorAll("img").forEach((image) => updateRotatedImageSize(section, image));
    };
    updateImageMode();
    if (window.ResizeObserver) new ResizeObserver(updateImageMode).observe(section);
    window.addEventListener("resize", updateImageMode);

    const originalImages = Array.from(section.querySelectorAll("img"));
    if (originalImages.length < 2) return;
    const firstClone = originalImages[0].cloneNode(true);
    const lastClone = originalImages[originalImages.length - 1].cloneNode(true);
    firstClone.dataset.clone = "1";
    lastClone.dataset.clone = "1";
    section.prepend(document.createElement("hr"), lastClone);
    section.append(document.createElement("hr"), firstClone);

    const images = Array.from(section.querySelectorAll("img"));
    let currentIndex = 1;
    let isJumping = false;
    let endTimer;
    const isMobileLayout = () => window.matchMedia("(max-width: 768px)").matches;
    const scrollToIndex = (index, smooth = true) => {
      const image = images[index];
      if (!image) return;
      const offset = isMobileLayout() ? image.offsetLeft : image.offsetTop;
      section.scrollTo({
        left: isMobileLayout() ? offset : section.scrollLeft,
        top: isMobileLayout() ? section.scrollTop : offset,
        behavior: smooth ? "smooth" : "auto"
      });
    };
    requestAnimationFrame(() => scrollToIndex(currentIndex, false));
    section.addEventListener("scroll", () => {
      clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        if (isJumping) return;
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        images.forEach((image, index) => {
          const offset = isMobileLayout() ? image.offsetLeft : image.offsetTop;
          const scrollPosition = isMobileLayout() ? section.scrollLeft : section.scrollTop;
          const distance = Math.abs(offset - scrollPosition);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        currentIndex = nearestIndex;
        if (currentIndex === 0 || currentIndex === images.length - 1) {
          isJumping = true;
          currentIndex = currentIndex === 0 ? images.length - 2 : 1;
          scrollToIndex(currentIndex, false);
          requestAnimationFrame(() => { isJumping = false; });
        }
      }, 90);
    }, { passive: true });
    section.addEventListener("click", (event) => {
      if (isJumping) return;
      const previousImage = isMobileLayout()
        ? (event.clientX - section.getBoundingClientRect().left) / section.clientWidth <= 0.4
        : (event.clientY - section.getBoundingClientRect().top) / section.clientHeight <= 0.4;
      currentIndex += previousImage ? -1 : 1;
      scrollToIndex(currentIndex, true);
    });
    section.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("resize", () => requestAnimationFrame(() => scrollToIndex(currentIndex, false)));
  };

  const createToolbar = () => {
    const toolbar = document.createElement("header");
    toolbar.className = "view-toolbar";
    toolbar.innerHTML = '<div class="view-btns"><a class="integrated-view-btn" href="/works_list" aria-label="Back to works list"><svg class="icon-back" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"></polyline></svg><svg class="icon-list" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><line y1="0.5" x2="18" y2="0.5" stroke="#000" stroke-width="2"/><line y1="6.17" x2="18" y2="6.17" stroke="#000" stroke-width="4"/><line y1="11.83" x2="18" y2="11.83" stroke="#000" stroke-width="2"/><line y1="17.5" x2="18" y2="17.5" stroke="#000" stroke-width="2"/></svg></a></div>';
    return toolbar;
  };

  const createSideSection = (project, includeToolbar) => {
    const sideSection = document.createElement("section");
    sideSection.className = "side-section";
    const text = document.createElement("div");
    text.className = "text-content";
    text.innerHTML = project.descriptionHtml || "";
    const overview = createOverview(project.overview);
    if (includeToolbar) sideSection.append(createToolbar());
    sideSection.append(overview, text);
    return { sideSection, overview };
  };

  const renderDesktop = (project, images) => {
    const main = document.createElement("main");
    main.className = "page-container desktop-project-layout";
    const imageSection = createImageSection(images);
    const { sideSection, overview } = createSideSection(project, true);
    main.append(imageSection, sideSection);
    return { main, imageSection, sideSection, overview };
  };

  const renderMobile = (project, images) => {
    const main = document.createElement("main");
    main.className = "page-container mobile-project-layout";
    const imageSection = createImageSection(images);
    const { sideSection, overview } = createSideSection(project, false);
    main.append(imageSection, sideSection);
    const drawings = createMobileDrawingSection(project.mobile?.drawings);
    if (drawings) main.append(drawings);
    return { main, imageSection, sideSection, overview };
  };

  const render = (project) => {
    if (!project || !Array.isArray(project.images) || !project.overview) {
      throw new Error("Project JSON is missing images or overview data.");
    }
    document.title = project.title || `${project.overview.titleEn || project.id} | PROJECT INFO`;
    mount.classList.add("filt-project-mount");
    mount.replaceChildren();

    const desktopImages = Array.isArray(project.desktop?.images)
      ? project.desktop.images
      : project.images;
    const mobileImages = Array.isArray(project.mobile?.images)
      ? project.mobile.images
      : project.images.filter((image) => image.class !== "drawing");
    const desktop = renderDesktop(project, desktopImages);
    const mobile = renderMobile(project, mobileImages);
    mount.append(desktop.main, mobile.main);

    [desktop, mobile].forEach(({ sideSection, overview }) => {
      const updateOverviewHeight = () => {
        sideSection.style.setProperty("--overview-height", `${overview.offsetHeight}px`);
      };
      updateOverviewHeight();
      if (window.ResizeObserver) new ResizeObserver(updateOverviewHeight).observe(overview);
    });
    initializeGallery(desktop.imageSection);
    initializeGallery(mobile.imageSection);

    loadScript(new URL("common-menu-v2.js", templateBase).href);
    loadScript(new URL("home-button.js", templateBase).href);
  };

  Promise.all([
    templateStylesReady,
    fetch(new URL(`projects/${encodeURIComponent(projectId)}.json`, templateBase)).then((response) => {
      if (!response.ok) throw new Error(`Project data request failed (${response.status}).`);
      return response.json();
    })
  ])
    .then(([, project]) => render(project))
    .catch((error) => {
      console.error("Project template could not render.", error);
      const message = document.createElement("p");
      message.className = "filt-template-error";
      message.textContent = `프로젝트를 불러오지 못했습니다: ${error.message}`;
      mount.replaceChildren(message);
    });
})();
