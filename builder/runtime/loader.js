// Stable entry point for Imweb widgets. Paste once; it never needs to change.
//   <script src=".../loader.js" data-template="project"></script>            (shared page: /project?id=tempin)
//   <div data-filt-project="tempin"></div>
//   <script src=".../loader.js" data-template="project" data-project-id="tempin"></script>
//   <div data-filt-works></div>
//   <script src=".../loader.js" data-template="works" data-view="list"></script>
//   <script src=".../loader.js" data-template="home"></script>     (also "office", "news")
// version.json on the main branch names the published commit. raw.githubusercontent.com caches it
// for at most 5 minutes, while jsDelivr branch URLs are cached by browsers for 7 days, so the
// loader reads the pointer from GitHub and then loads immutable commit-pinned files from jsDelivr.
(() => {
  const script = document.currentScript;
  if (!script) return;

  const REPO = "filt-office/filt-website";
  const ENTRIES = { project: "project-template.js", works: "works.js", home: "pages.js", office: "pages.js", news: "pages.js" };
  const template = ENTRIES[script.dataset.template] ? script.dataset.template : "project";
  const entry = ENTRIES[template];

  const inject = (ref) => {
    const target = document.createElement("script");
    target.src = `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/${entry}`;
    Object.entries(script.dataset).forEach(([key, value]) => {
      if (key !== "template") target.dataset[key] = value;
    });
    if (entry === "pages.js") target.dataset.page = template;
    script.after(target);
  };

  fetch(`https://raw.githubusercontent.com/${REPO}/main/version.json`, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.status))))
    .then((version) => {
      if (!/^[0-9a-f]{40}$/.test(version.sha || "")) throw new Error("Invalid version.json");
      inject(version.sha);
    })
    .catch((error) => {
      console.warn("FILT loader: version lookup failed, using main.", error);
      inject("main");
    });
})();
