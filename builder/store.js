// FILT builder storage. Both builder pages talk to data only through window.FiltStore.
// - "local":  served by builder/server.js (npm run builder); uses its /api endpoints.
// - "github": served from GitHub Pages; reads and commits straight to the private editor repo with
//             the signed-in person's GitHub token, so every save is a commit under their name.
(() => {
  "use strict";

  const OWNER = "filtehwa";
  const REPO = "filt-project-templates-editor";
  const BRANCH = "main";
  const PUBLIC_REPO = "filtehwa/filt-project-templates";
  const TOKEN_KEY = "filt-builder-token";
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const DEVICES = ["PC", "MOB"];
  const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
  const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif" };
  const MAX_UPLOAD = 20 * 1024 * 1024; // jsDelivr serves GitHub files up to 20MB

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
    upload: async (projectId, device, file) => (await localApi(
      `/api/upload?project=${encodeURIComponent(projectId)}&device=${device}&name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file },
    )).src,
    copyAsset: async (projectId, from, to) => (await localApi(
      `/api/copy-asset?project=${encodeURIComponent(projectId)}&to=${to}&from=${encodeURIComponent(from)}`,
      { method: "POST" },
    )).src,
    assetUrl: async (src) => (!src || isExternal(src) ? src || "" : `/runtime/${src.replace(/^\.?\//, "")}`),
    runtimeUrl: (file) => new URL(`/runtime/${file}`, location.href).href,
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
    runtimeUrl: (file) => new URL(`runtime/${file}`, location.href).href,
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
        return match && { kind: match[1], sha: match[2], note: match[3] || "", date: commit.commit.committer.date };
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
    .fs-user { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .fs-user img { width: 22px; height: 22px; border-radius: 50%; }
    .fs-user button, .fs-publish { padding: 4px 9px; border: 1px solid #111; background: #fff; font: inherit; cursor: pointer; }
    .fs-publish { background: #BD005E; border-color: #BD005E; color: #fff; }
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
        <li><a href="https://github.com/settings/tokens/new?description=FILT%20builder&scopes=repo" target="_blank" rel="noopener">GitHub 토큰 만들기 페이지</a>를 엽니다 (회사 GitHub 계정으로 로그인).</li>
        <li>Expiration(만료)은 90일 정도로 정하고, <b>repo</b> 항목이 체크된 상태로 맨 아래 <b>Generate token</b>을 누릅니다.</li>
        <li>나온 <code>ghp_…</code> 키를 복사해 아래에 붙여넣습니다.</li>
      </ol>
      <input type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false">
      <div class="fs-error"></div>
      <div class="fs-row"><button class="fs-primary">로그인</button></div>
      <p class="fs-muted">키는 이 브라우저에만 저장됩니다. 공용 PC에서는 사용 후 로그아웃하세요.</p>
    `);
    const input = overlay.querySelector("input");
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
    overlay.querySelector("button").addEventListener("click", submit);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
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

  // Header widget: signed-in user, logout, and the publish button (github mode only).
  const mountHeader = (container) => {
    injectCss();
    if (mode !== "github") {
      const note = document.createElement("span");
      note.className = "fs-muted";
      note.textContent = "로컬 모드 · 게시는 scripts/release.sh";
      container.append(note);
      return;
    }
    const box = document.createElement("div");
    box.className = "fs-user";
    if (currentUser) {
      const avatar = document.createElement("img");
      avatar.src = currentUser.avatar_url;
      avatar.alt = "";
      const name = document.createElement("span");
      name.textContent = currentUser.login;
      const out = document.createElement("button");
      out.textContent = "로그아웃";
      out.addEventListener("click", () => { if (confirm("로그아웃할까요?")) logout(); });
      box.append(avatar, name, out);
    }
    const publishButton = document.createElement("button");
    publishButton.className = "fs-publish";
    publishButton.textContent = "게시";
    publishButton.addEventListener("click", publishDialog);
    container.append(box, publishButton);
  };

  window.FiltStore = {
    mode,
    ready,
    mountHeader,
    isExternal,
    ...(mode === "github" ? github : local),
  };
})();
