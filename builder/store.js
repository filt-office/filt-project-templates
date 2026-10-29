// FILT builder storage. Both builder pages talk to data only through window.FiltStore.
// - "local":  served by builder/server.js (npm run builder); uses its /api endpoints.
// - "github": served from GitHub Pages; reads and commits straight to the private editor repo with
//             the signed-in person's GitHub token, so every save is a commit under their name.
(() => {
  "use strict";

  const OWNER = "filt-office";
  const REPO = "filt-website-editor";
  const BRANCH = "main";
  const PUBLIC_REPO = "filt-office/filt-website";
  const TOKEN_KEY = "filt-builder-token";
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const DEVICES = ["PC", "MOB"];
  const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
  const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif" };
  const MAX_UPLOAD = 20 * 1024 * 1024; // jsDelivr serves GitHub files up to 20MB
  const FONT_EXT = new Set([".woff2", ".woff", ".ttf", ".otf"]);
  const FONT_MIME = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf" };
  const MAX_FONT_UPLOAD = 20 * 1024 * 1024;
  const FONT_FORMATS = "WOFF2 · WOFF · TTF · OTF (20MB 이하)";
  // This is a live public folder: publish-images.js copies unknown extensions byte-for-byte.
  const FONT_ASSET_FOLDER = "pages";
  const FONT_ASSET_DEVICE = "PC";
  // Pages caches files for 10 minutes; a per-load query makes previews use the template just deployed.
  const PAGE_LOAD = Date.now();
  const IMAGE_FORMATS = "JPG · PNG · WEBP · GIF · SVG · AVIF (20MB 이하)";

  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || (location.hostname.endsWith("github.io") ? "github" : "local");

  const isExternal = (src) => /^(https?:|data:|blob:)/.test(src || "");
  const extOf = (name) => (name.match(/\.[^./]+$/) || [""])[0].toLowerCase();

  // Same rules as builder/server.js so both modes produce identical file names.
  const safeAssetName = (name) => {
    const ext = extOf(name);
    const base = name.slice(0, name.length - ext.length)
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "image";
    return { base, ext };
  };

  const validateProject = (project, id) => {
    const errors = [];
    if (!project || typeof project !== "object") return ["Project must be a JSON object."];
    if (project.id !== id) errors.push(`"id" must be "${id}".`);
    if (!project.overview || !Array.isArray(project.overview.fields)) errors.push("overview.fields must be a list.");
    if (!Array.isArray(project.images)) errors.push("images must be a list.");
    else project.images.forEach((image, index) => { if (!image?.src) errors.push(`images[${index}] has no src.`); });
    return errors;
  };

  const validateWorks = (data) => {
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.works)) return ["categories and works must be lists."];
    const errors = [];
    const categoryIds = new Set(data.categories.map((category) => category.id));
    const ids = new Set();
    data.works.forEach((work, index) => {
      const label = `${index + 1}번 행`;
      if (!ID_RE.test(work?.id || "")) errors.push(`${label}: ID는 영문 소문자·숫자·하이픈만 됩니다.`);
      else if (ids.has(work.id)) errors.push(`${label}: ID "${work.id}"가 중복됩니다.`);
      else ids.add(work.id);
      if (!categoryIds.has(work?.category)) errors.push(`${label}: 분류 "${work?.category}"가 없습니다.`);
    });
    return errors;
  };

  const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

  // Other formats this browser can decode (BMP; HEIC/TIFF in Safari) are converted to JPG first.
  const prepareUpload = async (file) => {
    const ext = extOf(file.name);
    if (IMAGE_EXT.has(ext)) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("conversion failed");
      return new File([blob], `${file.name.slice(0, file.name.length - ext.length)}.jpg`, { type: "image/jpeg" });
    } catch {
      const heic = [".heic", ".heif"].includes(ext) ? "\n아이폰 사진(HEIC)은 JPG로 변환해서 올려주세요." : "";
      throw new Error(`지원하지 않는 파일 형식입니다 (${ext || "확장자 없음"}).\n올릴 수 있는 형식: ${IMAGE_FORMATS}${heic}`);
    }
  };

  const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  const uint16 = (bytes, start) => (bytes[start] << 8) | bytes[start + 1];
  const uint32 = (bytes, start) => ((bytes[start] * 0x1000000) + (bytes[start + 1] << 16) + (bytes[start + 2] << 8) + bytes[start + 3]) >>> 0;
  const sfntHeaderError = (bytes) => {
    if (bytes.length < 12) return "글꼴 헤더가 완전하지 않습니다.";
    const tables = uint16(bytes, 4);
    return !tables || tables > 4096 || 12 + tables * 16 > bytes.length ? "글꼴 테이블 헤더가 올바르지 않습니다." : "";
  };
  // The client repeats the server-side signature check before it starts an upload. It never rasterizes
  // or converts a font; FontFace below is the browser's final decoder validation.
  const fontHeaderError = (bytes, fileSize, ext) => {
    if (ext === ".woff" || ext === ".woff2") {
      const minimum = ext === ".woff" ? 44 : 48;
      const signature = ext === ".woff" ? "wOFF" : "wOF2";
      if (bytes.length < minimum) return "글꼴 헤더가 완전하지 않습니다.";
      if (ascii(bytes, 0, 4) !== signature) return `${ext.slice(1).toUpperCase()} 실제 파일이 아닙니다.`;
      if (uint32(bytes, 8) !== fileSize) return "글꼴 헤더의 파일 길이가 실제 파일과 다릅니다.";
      return uint16(bytes, 12) ? "" : "글꼴 테이블이 없습니다.";
    }
    if (bytes.length < 12) return "글꼴 헤더가 완전하지 않습니다.";
    const signature = ascii(bytes, 0, 4);
    if (ext === ".otf" && signature !== "OTTO") return "OTF 실제 파일이 아닙니다.";
    if (ext === ".ttf" && !["\u0000\u0001\u0000\u0000", "true", "typ1"].includes(signature)) return "TTF 실제 파일이 아닙니다.";
    return sfntHeaderError(bytes);
  };
  const safeFontFamily = (family) => typeof family === "string" && /^[A-Za-z0-9 ._-]{1,90}$/.test(family) ? family.trim() : "";
  const fontStack = (family) => `'${safeFontFamily(family).replace(/'/g, "\\'")}', 'Noto Sans KR', sans-serif`;
  const fontFamilyFromName = (name) => {
    const base = safeAssetName(name).base.replace(/[._-]+/g, " ").trim().slice(0, 64) || "custom";
    return `FILT Upload ${base}`.slice(0, 90);
  };
  const savedFont = (value) => {
    if (!value || typeof value !== "object") return null;
    const src = typeof value.src === "string" ? value.src : "";
    const ext = extOf(src);
    const family = safeFontFamily(value.family);
    if (!FONT_EXT.has(ext) || value.format !== ext.slice(1) || !family || !new RegExp(`^assets/${FONT_ASSET_FOLDER}/${FONT_ASSET_DEVICE}/font-[a-z0-9][a-z0-9.-]*\\${ext}$`).test(src)) return null;
    return { src, family, format: ext.slice(1), name: typeof value.name === "string" ? value.name.slice(0, 160) : "" };
  };
  const inspectFont = async (file) => {
    const ext = extOf(file?.name || "");
    if (!FONT_EXT.has(ext)) throw new Error(`지원하지 않는 글꼴 형식입니다 (${ext || "확장자 없음"}).\n올릴 수 있는 형식: ${FONT_FORMATS}`);
    if (!Number.isFinite(file.size) || !file.size) throw new Error("비어 있는 글꼴 파일입니다.");
    if (file.size > MAX_FONT_UPLOAD) throw new Error("20MB보다 큰 글꼴은 올릴 수 없습니다.");
    if (typeof file.slice !== "function") throw new Error("글꼴 파일을 읽을 수 없습니다.");
    let head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    // A normal SFNT often has more than three table records, so its complete directory extends
    // beyond the first 64 bytes. Read only that bounded directory, not the full font file.
    if ([".ttf", ".otf"].includes(ext) && head.length >= 6) {
      const directoryLength = Math.min(file.size, 12 + uint16(head, 4) * 16);
      if (directoryLength > head.length) head = new Uint8Array(await file.slice(0, directoryLength).arrayBuffer());
    }
    const error = fontHeaderError(head, file.size, ext);
    if (error) throw new Error(error);
    return { family: fontFamilyFromName(file.name), format: ext.slice(1), name: file.name.slice(0, 160) };
  };
  const fontSources = new Map();
  const fontFaces = new Map();
  const fontFaceKey = (font, url) => `${font.family}\u0000${font.format}\u0000${url}`;
  const loadFontFace = (font, url) => {
    const key = fontFaceKey(font, url);
    if (!fontFaces.has(key)) {
      fontFaces.set(key, (async () => {
        if (typeof FontFace !== "function") throw new Error("이 브라우저는 웹 글꼴 검사를 지원하지 않습니다.");
        const face = new FontFace(font.family, `url(${JSON.stringify(url)}) format("${font.format}")`, { style: "normal", weight: "100 900", display: "swap" });
        return face.load();
      })());
    }
    return fontFaces.get(key);
  };
  const useFontFace = async (font, url) => {
    const face = await loadFontFace(font, url);
    document.fonts?.add(face);
    return face;
  };

  // ---------------------------------------------------------------- local

  const localApi = async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `요청 실패 (${response.status})`);
    return body;
  };

  const local = {
    listProjects: () => localApi("/api/projects"),
    getProject: (id) => localApi(`/api/projects/${encodeURIComponent(id)}`),
    saveProject: (id, target, project) => localApi(`/api/projects/${encodeURIComponent(id)}?target=${target}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    }),
    getWorks: () => localApi("/api/works"),
    saveWorks: (data) => localApi("/api/works", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    listAssets: () => localApi("/api/assets"),
    getPage: (page) => localApi(`/api/pages/${page}`),
    savePage: (page, data) => localApi(`/api/pages/${page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    upload: async (projectId, device, file) => (await localApi(
      `/api/upload?project=${encodeURIComponent(projectId)}&device=${device}&name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file },
    )).src,
    uploadFont: async (file) => (await localApi(
      `/api/font-upload?name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file },
    )).src,
    copyAsset: async (projectId, from, to) => (await localApi(
      `/api/copy-asset?project=${encodeURIComponent(projectId)}&to=${to}&from=${encodeURIComponent(from)}`,
      { method: "POST" },
    )).src,
    assetUrl: async (src) => (!src || isExternal(src) ? src || "" : `/runtime/${src.replace(/^\.?\//, "")}`),
    runtimeUrl: (file) => new URL(`/runtime/${file}?v=${PAGE_LOAD}`, location.href).href,
  };

  // ---------------------------------------------------------------- github

  let token = "";
  try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch { /* storage blocked */ }
  let currentUser = null;

  const gh = async (path, { raw = false, accept, ...options } = {}) => {
    const response = await fetch(path.startsWith("http") ? path : `https://api.github.com${path}`, {
      cache: "no-store",
      ...options,
      headers: {
        Accept: accept || (raw ? "application/vnd.github.raw+json" : "application/vnd.github+json"),
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (response.status === 401) {
      logout(false);
      throw new Error("GitHub 로그인 키가 잘못됐거나 만료됐습니다. 다시 로그인해 주세요.");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.message || `GitHub 요청 실패 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    if (raw === "blob") return response.blob();
    if (raw) return response.text();
    return response.json();
  };
  const repoApi = `/repos/${OWNER}/${REPO}`;
  const contentsPath = (path) => `${repoApi}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${BRANCH}`;

  const readText = async (path) => {
    try {
      return await gh(contentsPath(path), { raw: true });
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };

  const listDir = async (path) => {
    try {
      const entries = await gh(contentsPath(path));
      return Array.isArray(entries) ? entries : [];
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
  };

  const toBase64 = async (content) => {
    const buffer = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(await content.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  const createBlob = async (content) => (await gh(`${repoApi}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: await toBase64(content), encoding: "base64" }),
  })).sha;

  // One commit for any number of files: [{ path, content }] or [{ path, sha }] (existing blob).
  const commitFiles = async (files, message) => {
    const entries = await Promise.all(files.map(async (file) => ({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: file.sha || await createBlob(file.content),
    })));
    for (let attempt = 1; ; attempt += 1) {
      const head = (await gh(`${repoApi}/git/ref/heads/${BRANCH}`)).object.sha;
      const baseTree = (await gh(`${repoApi}/git/commits/${head}`)).tree.sha;
      const tree = await gh(`${repoApi}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries }) });
      const commit = await gh(`${repoApi}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) });
      try {
        await gh(`${repoApi}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return commit.sha;
      } catch (error) {
        // Someone else committed in between: rebuild on the new head.
        if (attempt >= 3 || error.status !== 422) throw error;
      }
    }
  };

  const freeName = async (dirs, base, ext) => {
    const taken = new Set((await Promise.all(dirs.map(listDir))).flat().map((entry) => entry.name));
    let name = `${base}${ext}`;
    for (let n = 2; taken.has(name); n += 1) name = `${base}-${n}${ext}`;
    return name;
  };

  const assetCache = new Map();

  const github = {
    listProjects: async () => {
      const [drafts, published] = await Promise.all([listDir("drafts"), listDir("runtime/projects")]);
      const map = new Map();
      [["draft", drafts], ["runtime", published]].forEach(([status, entries]) => entries.forEach((entry) => {
        const id = entry.name.replace(/\.json$/, "");
        if (!entry.name.endsWith(".json") || !ID_RE.test(id)) return;
        const row = map.get(id) || { id, draft: false, runtime: false };
        row[status] = true;
        map.set(id, row);
      }));
      return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
    getProject: async (id) => {
      for (const [status, path] of [["draft", `drafts/${id}.json`], ["runtime", `runtime/projects/${id}.json`]]) {
        const text = await readText(path);
        if (text !== null) return { status, project: JSON.parse(text) };
      }
      throw new Error(`"${id}" 프로젝트를 찾을 수 없습니다.`);
    },
    saveProject: async (id, target, project) => {
      if (!ID_RE.test(id)) throw new Error("ID는 영문 소문자, 숫자, 하이픈만 쓸 수 있습니다.");
      const errors = validateProject(project, id);
      if (errors.length) throw new Error(errors.join(" "));
      const path = target === "runtime" ? `runtime/projects/${id}.json` : `drafts/${id}.json`;
      await commitFiles([{ path, content: toJson(project) }], `builder: ${id} ${target === "runtime" ? "게시용 저장" : "임시저장"}`);
      return { ok: true, target, path };
    },
    getWorks: async () => {
      const text = await readText("runtime/works.json");
      return text ? JSON.parse(text) : { version: 1, categories: [], works: [] };
    },
    saveWorks: async (data) => {
      const errors = validateWorks(data);
      if (errors.length) throw new Error(errors.join("\n"));
      await commitFiles([{ path: "runtime/works.json", content: toJson(data) }], "builder: WORKS 목록 저장");
      return { ok: true, path: "runtime/works.json", count: data.works.length };
    },
    // Every uploaded image (PC copy), as "assets/<folder>/PC/<file>".
    listAssets: async () => {
      const folders = (await listDir("runtime/assets")).filter((entry) => entry.type === "dir");
      const lists = await Promise.all(folders.map((folder) => listDir(`runtime/assets/${folder.name}/PC`)));
      return folders.flatMap((folder, index) => lists[index]
        .filter((entry) => entry.type === "file" && IMAGE_EXT.has(extOf(entry.name)))
        .map((entry) => `assets/${folder.name}/PC/${entry.name}`));
    },
    getPage: async (page) => {
      const text = await readText(`runtime/pages/${page}.json`);
      return text ? JSON.parse(text) : { version: 1 };
    },
    savePage: async (page, data) => {
      const path = `runtime/pages/${page}.json`;
      await commitFiles([{ path, content: toJson(data) }], `builder: ${page.toUpperCase()} 저장`);
      return { ok: true, path };
    },
    upload: async (projectId, device, file) => {
      const devices = device === "both" ? DEVICES : [device];
      const { base, ext } = safeAssetName(file.name);
      if (!IMAGE_EXT.has(ext)) throw new Error(`지원하지 않는 이미지 형식입니다 (${ext || file.name}).`);
      if (file.size > MAX_UPLOAD) throw new Error("20MB보다 큰 이미지는 올릴 수 없습니다.");
      const dirs = devices.map((name) => `runtime/assets/${projectId}/${name}`);
      const name = await freeName(dirs, base, ext);
      const sha = await createBlob(file);
      await commitFiles(dirs.map((dir) => ({ path: `${dir}/${name}`, sha })), `builder: ${projectId} 이미지 업로드 (${name})`);
      const src = {};
      devices.forEach((name2) => {
        src[name2] = `assets/${projectId}/${name2}/${name}`;
        assetCache.set(src[name2], Promise.resolve(URL.createObjectURL(file)));
      });
      return src;
    },
    // Fonts are deliberately separate from upload(): no image preparation, canvas conversion or
    // image picker listing. The public images release already copies files in pages/PC verbatim.
    uploadFont: async (file) => {
      const { base, ext } = safeAssetName(file.name);
      if (!FONT_EXT.has(ext)) throw new Error(`지원하지 않는 글꼴 형식입니다 (${ext || file.name}).`);
      if (file.size > MAX_FONT_UPLOAD) throw new Error("20MB보다 큰 글꼴은 올릴 수 없습니다.");
      const dir = `runtime/assets/${FONT_ASSET_FOLDER}/${FONT_ASSET_DEVICE}`;
      const name = await freeName([dir], `font-${base}`, ext);
      await commitFiles([{ path: `${dir}/${name}`, content: file }], `builder: 디자인 글꼴 업로드 (${name})`);
      const src = `assets/${FONT_ASSET_FOLDER}/${FONT_ASSET_DEVICE}/${name}`;
      return src;
    },
    copyAsset: async (projectId, from, to) => {
      const match = from.match(/^assets\/([a-z0-9-]+)\/(PC|MOB)\/([^/]+)$/);
      if (!match || match[1] !== projectId || !DEVICES.includes(to)) throw new Error("이 프로젝트에 업로드된 이미지만 복사할 수 있습니다.");
      if (match[2] === to) return from;
      const source = await gh(contentsPath(`runtime/${from}`), { accept: "application/vnd.github.object+json" });
      const { base, ext } = safeAssetName(match[3]);
      const dir = `runtime/assets/${projectId}/${to}`;
      const name = await freeName([dir], base, ext);
      await commitFiles([{ path: `${dir}/${name}`, sha: source.sha }], `builder: ${projectId} 이미지 복사 (${match[2]} → ${to})`);
      const src = `assets/${projectId}/${to}/${name}`;
      assetCache.set(src, github.assetUrl(from));
      return src;
    },
    // The editor repo is private, so uploaded images are fetched with the token and shown as blob: URLs.
    assetUrl: (src) => {
      if (!src || isExternal(src)) return Promise.resolve(src || "");
      if (!assetCache.has(src)) {
        assetCache.set(src, gh(contentsPath(`runtime/${src}`), { raw: "blob" })
          .then((blob) => URL.createObjectURL(new Blob([blob], { type: MIME[extOf(src)] || blob.type })))
          .catch(() => ""));
      }
      return assetCache.get(src);
    },
    // GitHub Pages serves a copy of runtime/ next to the builder (see deploy-builder workflow).
    runtimeUrl: (file) => new URL(`runtime/${file}?v=${PAGE_LOAD}`, location.href).href,
  };

  // ---------------------------------------------------------------- publish (GitHub Actions)

  const dispatch = async (inputs) => {
    const started = Date.now();
    await gh(`${repoApi}/actions/workflows/publish.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: BRANCH, inputs }) });
    // Find the run this dispatch created, then wait for it.
    for (let i = 0; i < 120; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, i < 5 ? 2000 : 4000));
      const { workflow_runs: runs } = await gh(`${repoApi}/actions/workflows/publish.yml/runs?event=workflow_dispatch&per_page=5`);
      const run = runs.find((candidate) => Date.parse(candidate.created_at) >= started - 30000 && candidate.actor?.login === currentUser?.login);
      if (run && run.status === "completed") {
        if (run.conclusion !== "success") throw new Error(`게시 작업이 실패했습니다. GitHub Actions 기록을 확인하세요:\n${run.html_url}`);
        return run;
      }
    }
    throw new Error("게시 작업이 오래 걸리고 있습니다. 잠시 후 게시 기록을 다시 확인하세요.");
  };

  const publicRaw = async (path) => {
    const response = await fetch(`https://api.github.com/repos/${PUBLIC_REPO}/contents/${path}`, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${token}` },
    });
    return response.ok ? response.text() : null;
  };

  const publishing = {
    current: async () => {
      const text = await publicRaw("version.json");
      return text ? JSON.parse(text) : null;
    },
    // Each publish/rollback is one commit to version.json; its message is "publish <sha> · <note>".
    history: async () => {
      const commits = await gh(`https://api.github.com/repos/${PUBLIC_REPO}/commits?path=version.json&per_page=15`);
      return commits.map((commit) => {
        const match = commit.commit.message.match(/^(publish|rollback) ([0-9a-f]{40})(?: · (.*))?/);
        return match && { kind: match[1], sha: match[2], note: match[3] || "", date: commit.commit.committer.date, url: commit.html_url };
      }).filter(Boolean);
    },
    publish: (message) => dispatch({ action: "publish", message: message || "빌더에서 게시" }),
    rollback: (sha) => dispatch({ action: "rollback", sha }),
  };

  // ---------------------------------------------------------------- login UI (github mode)

  const css = `
    .fs-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(0,0,0,.35); font: 13px/1.5 "SUIT", system-ui, sans-serif; }
    .fs-card { width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border: 1px solid #111; background: #fff; color: #111; }
    .fs-card h2 { margin: 0 0 10px; font-size: 16px; letter-spacing: .04em; }
    .fs-card ol { margin: 8px 0 14px; padding-left: 18px; }
    .fs-card li { margin: 4px 0; }
    .fs-card input { width: 100%; padding: 7px 8px; border: 1px solid #ccc; font: 12px ui-monospace, Consolas, monospace; }
    .fs-card .fs-row { display: flex; gap: 6px; margin-top: 10px; }
    .fs-card button { padding: 6px 12px; border: 1px solid #111; background: #fff; font: inherit; cursor: pointer; }
    .fs-card button.fs-primary { background: #111; color: #fff; }
    .fs-error { min-height: 1.5em; margin-top: 8px; color: #c62828; white-space: pre-line; }
    .fs-history { margin: 10px 0 0; padding: 0; list-style: none; border-top: 1px solid #ddd; }
    .fs-history li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 12px; }
    .fs-history .fs-grow { flex: 1; min-width: 0; }
    .fs-history .fs-tag { padding: 0 5px; border: 1px solid #111; font-size: 10px; }
    .fs-muted { color: #777; }
  `;
  const injectCss = () => {
    if (document.getElementById("fs-style")) return;
    const style = document.createElement("style");
    style.id = "fs-style";
    style.textContent = css;
    document.head.append(style);
  };

  const card = (html) => {
    injectCss();
    const overlay = document.createElement("div");
    overlay.className = "fs-overlay";
    overlay.innerHTML = `<div class="fs-card">${html}</div>`;
    document.body.append(overlay);
    return overlay;
  };

  const verify = async () => {
    currentUser = await gh("/user");
    const repo = await gh(repoApi);
    if (!repo.permissions?.push) throw new Error(`${currentUser.login} 계정은 ${REPO} 저장소에 쓰기 권한이 없습니다. 관리자에게 초대를 요청하세요.`);
    return currentUser;
  };

  const loginDialog = () => new Promise((resolve) => {
    const overlay = card(`
      <h2>FILT. BUILDER 로그인</h2>
      <p>GitHub 계정의 <b>로그인 키(토큰)</b>로 접속합니다. 처음 한 번만 하면 이 브라우저에 저장됩니다.</p>
      <ol>
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub 토큰 만들기 페이지</a>를 엽니다 (회사 GitHub 계정으로 로그인).</li>
        <li>Token name: <b>FILT builder</b> · Expiration: <b>No expiration</b>(또는 원하는 기간)</li>
        <li>Resource owner: <b>${OWNER}</b> · Repository access: <b>Only select repositories</b> → <b>${REPO}</b></li>
        <li>Permissions → Repository permissions에서 <b>Contents</b>와 <b>Actions</b>를 <b>Read and write</b>로 바꿉니다.</li>
        <li>맨 아래 <b>Generate token</b>을 누르고, 나온 <code>github_pat_…</code> 키를 아래에 붙여넣습니다.</li>
      </ol>
      <form>
        <input type="text" name="username" value="filt-builder" autocomplete="username" hidden>
        <input type="password" name="password" placeholder="github_pat_…" autocomplete="current-password" spellcheck="false">
        <div class="fs-error"></div>
        <div class="fs-row"><button type="submit" class="fs-primary">로그인</button></div>
      </form>
      <p class="fs-muted">키는 이 브라우저에 저장됩니다. 브라우저가 비밀번호 저장을 물으면 저장해 두세요 — 다음에 자동완성됩니다. 공용 PC에서는 사용 후 로그아웃하세요.</p>
    `);
    const input = overlay.querySelector('input[type="password"]');
    const error = overlay.querySelector(".fs-error");
    const submit = async () => {
      token = input.value.trim();
      if (!token) return;
      error.textContent = "확인 중…";
      try {
        await verify();
        try { localStorage.setItem(TOKEN_KEY, token); } catch { /* session only */ }
        overlay.remove();
        resolve(currentUser);
      } catch (problem) {
        token = "";
        error.textContent = problem.message;
      }
    };
    overlay.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); submit(); });
    input.focus();
  });

  function logout(reload = true) {
    token = "";
    currentUser = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    if (reload) location.reload();
  }

  // Resolves once the page may use the store (always immediately in local mode).
  const ready = async () => {
    if (mode !== "github") return null;
    if (token) {
      try { return await verify(); } catch { token = ""; }
    }
    return loginDialog();
  };

  const publishDialog = async () => {
    const overlay = card(`
      <h2>게시</h2>
      <p>저장된 내용(게시용 저장한 상세페이지, WORKS 목록, 템플릿)을 공개 페이지에 반영합니다.<br>
      <span class="fs-muted">게시 후 5분 안에 아임웹 페이지에 나타납니다.</span></p>
      <input type="text" placeholder="게시 메모 (예: 템프인 이미지 교체)">
      <div class="fs-error"></div>
      <div class="fs-row"><button class="fs-primary" data-act="publish">게시하기</button><button data-act="close">닫기</button></div>
      <h2 style="margin-top:18px">게시 기록</h2>
      <ul class="fs-history"><li class="fs-muted">불러오는 중…</li></ul>
    `);
    const message = overlay.querySelector("input");
    const status = overlay.querySelector(".fs-error");
    const list = overlay.querySelector(".fs-history");
    const buttons = () => overlay.querySelectorAll("button");
    const busy = (on) => buttons().forEach((button) => { button.disabled = on; });

    const loadHistory = async () => {
      try {
        const [current, history] = await Promise.all([publishing.current(), publishing.history()]);
        list.replaceChildren(...history.map((entry) => {
          const item = document.createElement("li");
          const live = current?.sha === entry.sha;
          item.innerHTML = `<span class="fs-grow"></span>${live ? '<span class="fs-tag">현재</span>' : ""}`;
          item.firstChild.textContent = `${new Date(entry.date).toLocaleString("ko-KR")} · ${entry.kind === "rollback" ? "되돌림" : "게시"} · ${entry.note || entry.sha.slice(0, 7)}`;
          if (!live) {
            const back = document.createElement("button");
            back.textContent = "이 버전으로 되돌리기";
            back.addEventListener("click", () => run(() => publishing.rollback(entry.sha), "되돌리는 중…", "되돌렸습니다. 5분 안에 반영됩니다."));
            item.append(back);
          }
          return item;
        }));
        if (!history.length) list.innerHTML = '<li class="fs-muted">아직 게시 기록이 없습니다.</li>';
      } catch (error) {
        list.innerHTML = "";
        status.textContent = error.message;
      }
    };

    const run = async (task, working, done) => {
      busy(true);
      status.textContent = working;
      try {
        await task();
        status.textContent = done;
        await loadHistory();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy(false);
      }
    };

    overlay.querySelector('[data-act="publish"]').addEventListener("click", () =>
      run(() => publishing.publish(message.value.trim()), "게시 중… (1~2분 걸립니다)", "게시했습니다. 5분 안에 아임웹 페이지에 반영됩니다."));
    overlay.querySelector('[data-act="close"]').addEventListener("click", () => overlay.remove());
    loadHistory();
  };

  // Header widget: the publish button, then the signed-in user with a text-style logout (github mode only).
  // Kept apart from the page's save buttons so 게시 is never clicked by mistake for 게시용 저장.
  // Fills the header's action row (see header.js) as: account / draft / save / deploy.
  // The account goes before the page's own buttons, deploy after them.
  // ---------------------------------------------------------------- design system
  // runtime/pages/design.json, edited on design.html. Defaults are the values the site was built with.
  // designVars() turns it into the CSS variables pages use (runtime/design.js sets the same ones):
  //   colors[]   --filt-key (the first), --filt-<id>
  //   logo       --filt-logo-stroke (in the mark's 240×410 units), --filt-logo-color,
  //              --filt-logo-morph (seconds), --filt-logo-ease (a GSAP ease name, read by the menu script)
  //   type       --filt-font-family, --filt-font-weight;
  //              per scale entry --filt-size-<id>, --filt-size-<id>-mobile, --filt-weight-<id>, --filt-line-<id>
  //   logo.intro --filt-intro-scale, --filt-intro-appear / -gather / -hold / -dock (seconds)
  //   motion     --filt-motion-panel, --filt-motion-hover, --filt-motion-slide (seconds),
  //              --filt-motion-slide-ease, --filt-slide-interval (seconds)
  const DEFAULT_DESIGN = {
    version: 2,
    colors: [{ id: "key", name: "키컬러", value: "#BD005E" }],
    // intro: the HOME entrance (lines gather into a large mark, hold, then dock on the menu logo).
    logo: { stroke: 5, color: "black", duration: 0.8, ease: "power2.inOut", intro: { scale: 0.6, appear: 0.1, gather: 1.8, hold: 0.1, dock: 1 } },
    type: {
      family: "'Suit', 'Pretendard Variable', 'Noto Sans KR', sans-serif",
      weight: 300,
      scale: [
        // Measured on the live site (Imweb's root font size is 10px, so 1.2rem = 12px).
        { id: "body", name: "본문", pc: 12, mobile: 13.5, weight: 500, line: 1.8 },
        { id: "caption", name: "캡션", pc: 9, mobile: 10, weight: 300, line: 1.25 },
        { id: "overview", name: "개요표", pc: 10, mobile: 10, weight: 400, line: 1.6 },
        { id: "overview-title", name: "개요표 제목", pc: 12, mobile: 12, weight: 700, line: 1.3 },
        { id: "list", name: "목록", pc: 12, mobile: 12, weight: 300, line: 1.6 },
        { id: "menu", name: "메뉴", pc: 12, mobile: 12, weight: 400, line: 1.6 },
      ],
    },
    motion: { panel: 0.35, hover: 0.2, slide: 1, slideInterval: 10, slideEase: "cubic-bezier(.45,0,.55,1)" },
  };
  const publicFontUrl = (src) => (mode === "local"
    ? new URL(`/runtime/${src.replace(/^\.?\//, "")}`, location.href).href
    : new URL(src, "https://filt-office.github.io/filt-website-images/").href);
  const previewFontUrl = (font) => fontSources.get(font.src) || publicFontUrl(font.src);
  const loadDesignFont = async (design) => {
    const font = savedFont(design?.type?.font);
    if (!font) return null;
    let url = fontSources.get(font.src);
    if (!url) {
      try { url = await backend.assetUrl(font.src); } catch { /* public URL below is still useful after deploy */ }
      url = url || publicFontUrl(font.src);
      fontSources.set(font.src, url);
    }
    return useFontFace(font, url);
  };
  // Saved files may predate a section; missing parts take the defaults.
  const fullDesign = (design) => {
    const base = JSON.parse(JSON.stringify(DEFAULT_DESIGN));
    if (!design) return base;
    const scale = base.type.scale.map((entry) => ({ ...entry, ...(design.type?.scale || []).find((saved) => saved.id === entry.id) }));
    const type = { ...base.type, ...design.type, scale };
    const font = savedFont(design.type?.font);
    if (font) {
      type.font = font;
      // A saved custom family always wins over a stale hand-written type.family declaration.
      type.family = fontStack(font.family);
    } else delete type.font;
    return {
      ...base,
      ...design,
      colors: design.colors?.length ? design.colors : base.colors,
      logo: { ...base.logo, ...design.logo, intro: { ...base.logo.intro, ...design.logo?.intro } },
      type,
      motion: { ...base.motion, ...design.motion },
    };
  };
  const designVars = (input) => {
    const design = fullDesign(input);
    const vars = { "--filt-key": design.colors[0].value };
    design.colors.forEach((color) => { vars[`--filt-${color.id}`] = color.value; });
    vars["--filt-logo-stroke"] = String(design.logo.stroke);
    vars["--filt-logo-color"] = design.logo.color === "black" ? "#000" : `var(--filt-${design.logo.color}, #000)`;
    vars["--filt-logo-morph"] = `${design.logo.duration}s`;
    vars["--filt-logo-ease"] = design.logo.ease;
    vars["--filt-font-family"] = design.type.family;
    vars["--filt-font-weight"] = String(design.type.weight);
    design.type.scale.forEach((entry) => {
      vars[`--filt-size-${entry.id}`] = `${entry.pc}px`;
      vars[`--filt-size-${entry.id}-mobile`] = `${entry.mobile}px`;
      vars[`--filt-weight-${entry.id}`] = String(entry.weight);
      vars[`--filt-line-${entry.id}`] = String(entry.line);
    });
    vars["--filt-motion-panel"] = `${design.motion.panel}s`;
    vars["--filt-motion-hover"] = `${design.motion.hover}s`;
    vars["--filt-motion-slide"] = `${design.motion.slide}s`;
    vars["--filt-motion-slide-ease"] = design.motion.slideEase;
    vars["--filt-slide-interval"] = `${design.motion.slideInterval}s`;
    const intro = design.logo.intro;
    vars["--filt-intro-scale"] = String(intro.scale);
    ["appear", "gather", "hold", "dock"].forEach((key) => { vars[`--filt-intro-${key}`] = `${intro[key]}s`; });
    return vars;
  };
  const applyDesign = (design) => {
    const current = fullDesign(design);
    const root = document.documentElement.style;
    Object.entries(designVars(current)).forEach(([name, value]) => root.setProperty(name, value));
    window.FiltDesign = current;
    document.dispatchEvent(new CustomEvent("filt-design", { detail: window.FiltDesign }));
    // Do not hold page rendering on a remote font, but refresh previews once its actual face is ready.
    if (current.type.font) loadDesignFont(current)
      .then(() => document.dispatchEvent(new CustomEvent("filt-design", { detail: window.FiltDesign })))
      .catch((error) => console.warn("FILT uploaded font could not be loaded.", error));
  };

  const mountHeader = (container) => {
    injectCss();
    backend.getPage("design").then(applyDesign, () => applyDesign(DEFAULT_DESIGN));
    const item = (tag, text, title, className = "") => {
      const el = document.createElement(tag);
      el.className = `fb-act${className ? ` ${className}` : ""}`;
      el.textContent = text;
      el.title = title;
      return el;
    };
    const first = container.querySelector(".fb-act");
    const before = (el) => container.insertBefore(el, first);
    if (mode !== "github") {
      before(item("span", "local", "로컬 모드 · 게시는 scripts/release.sh"));
      return;
    }
    // Last publish: version, who ran it (the note ends with "(@login)") and when; links to the
    // public repo's commit on GitHub.
    const version = before(item("a", "…", "마지막 게시", "version"));
    version.href = `https://github.com/${PUBLIC_REPO}/commits/main/version.json`;
    version.target = "_blank";
    version.rel = "noopener";
    publishing.history().then(([last]) => {
      if (!last) { version.textContent = "게시 기록 없음"; return; }
      const who = (last.note.match(/@([\w-]+)\)?\s*$/) || [])[1];
      const when = new Date(last.date);
      const pad = (n) => String(n).padStart(2, "0");
      version.textContent = `v.${last.sha.slice(0, 7)}${who ? ` @${who}` : ""} ${pad(when.getMonth() + 1)}/${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
      version.title = `마지막 ${last.kind === "rollback" ? "되돌리기" : "게시"}: ${last.note || ""}\n${when.toLocaleString("ko-KR")}\n누르면 GitHub에서 봅니다`;
      version.href = last.url;
    }).catch(() => { version.textContent = "게시 기록"; });
    if (currentUser) {
      const account = before(item("button", currentUser.login, "누르면 로그아웃", "account"));
      account.addEventListener("click", () => { if (confirm(`${currentUser.login} 계정에서 로그아웃할까요?`)) logout(); });
    }
    container.append(item("button", "deploy", "게시 창을 엽니다 (누르자마자 반영되지 않습니다)", "deploy"));
    container.lastChild.addEventListener("click", publishDialog);
  };

  const backend = mode === "github" ? github : local;

  // ---------------------------------------------------------------- edit stamps
  // Saving compares with what was loaded and stamps what changed: each changed works row and
  // each project gets edited: { by, at, what } (who, ISO time, the changed fields or sections).
  const userName = () => currentUser?.login || (mode === "github" ? "" : "local");
  const stamp = (what) => ({ by: userName(), at: new Date().toISOString(), what });
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const WORK_FIELDS = [
    ["category", "분류"], ["nameKo", "한글명"], ["nameEn", "영문명"], ["year", "연도"], ["program", "용도"],
    ["location", "지역"], ["status", "상태"], ["thumb", "썸네일"], ["cardThumb", "카드 이미지"],
    ["mobileShape", "모바일 비율"], ["show.list", "목록 표시"], ["show.gallery", "갤러리 표시"], ["show.mobile", "모바일 표시"],
    ["galleryOrder", "갤러리 순서"], ["projectId", "상세페이지"], ["link", "링크"], ["id", "ID"], ["note", "메모"],
  ];
  const valueAt = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj);
  const PROJECT_PARTS = [
    ["영문 제목", (p) => p.overview?.titleEn], ["한글 제목", (p) => p.overview?.subtitle], ["개요표", (p) => p.overview?.fields],
    ["이미지", (p) => p.gallery], ["도면 설정", (p) => { const { images, ...rest } = p.mobile?.drawings || {}; return rest; }], ["설명", (p) => p.description],
  ];
  let loadedWorks = null;
  const loadedProjects = new Map();
  const copy = (value) => JSON.parse(JSON.stringify(value));

  window.FiltStore = {
    mode,
    ready,
    mountHeader,
    isExternal,
    imageFormats: IMAGE_FORMATS,
    ...backend,
    userName,
    applyDesign,
    // Attributes for a preview's <html>: the current (maybe unsaved) colours, and the flag that tells
    // runtime/design.js not to load pages/design.json over them. The font details let that early-return
    // route install a real FontFace inside the iframe instead of only inheriting a CSS declaration.
    designAttrs: () => {
      const design = fullDesign(window.FiltDesign);
      const vars = Object.entries(designVars(design)).map(([name, value]) => `${name}: ${value}`).join("; ");
      const font = savedFont(design.type.font);
      const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const fontAttrs = font ? ` data-filt-font-src="${escapeAttr(previewFontUrl(font))}" data-filt-font-family="${escapeAttr(font.family)}" data-filt-font-format="${font.format}"` : "";
      return ` data-filt-design="builder"${fontAttrs} style="${vars.replace(/"/g, "&quot;")}"`;
    },
    fullDesign,
    designVars,
    upload: async (projectId, device, file) => backend.upload(projectId, device, await prepareUpload(file)),
    fontFormats: FONT_FORMATS,
    fontStack,
    uploadFont: async (file) => {
      const meta = await inspectFont(file);
      const blobUrl = URL.createObjectURL(file);
      let face;
      try {
        // Decode before writing. A failed FontFace leaves the selected design object untouched.
        face = await loadFontFace(meta, blobUrl);
      } catch (error) {
        URL.revokeObjectURL(blobUrl);
        throw new Error(`글꼴을 불러올 수 없습니다: ${error.message || "지원하지 않는 글꼴 파일입니다."}`);
      }
      let src;
      try {
        src = await backend.uploadFont(file);
      } catch (error) {
        URL.revokeObjectURL(blobUrl);
        throw error;
      }
      fontSources.set(src, blobUrl);
      document.fonts?.add(face);
      return { src, ...meta };
    },
    getWorks: async () => {
      const data = await backend.getWorks();
      loadedWorks = copy(data);
      return data;
    },
    saveWorks: async (data) => {
      const before = new Map((loadedWorks?.works || []).map((work) => [work.id, work]));
      data.works.forEach((work) => {
        const old = before.get(work.id);
        const what = old ? WORK_FIELDS.filter(([path]) => !same(valueAt(work, path), valueAt(old, path))).map(([, label]) => label) : ["새 행"];
        if (what.length) work.edited = stamp(what.join(", "));
      });
      const result = await backend.saveWorks(data);
      loadedWorks = copy(data);
      return result;
    },
    getProject: async (id) => {
      const result = await backend.getProject(id);
      loadedProjects.set(id, copy(result.project));
      return result;
    },
    // The editor reshapes what it loads; it passes that state here as the comparison point.
    rememberProject: (id, project) => { loadedProjects.set(id, copy(project)); },
    saveProject: async (id, target, project) => {
      const old = loadedProjects.get(id);
      const what = old ? PROJECT_PARTS.filter(([, read]) => !same(read(project), read(old))).map(([label]) => label) : ["새 프로젝트"];
      project.edited = stamp(what.length ? what.join(", ") : "변경 없음");
      const result = await backend.saveProject(id, target, project);
      loadedProjects.set(id, copy(project));
      return { ...result, edited: project.edited };
    },
  };
})();
