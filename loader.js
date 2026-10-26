// Stable entry point for Imweb widgets. Paste once; it never needs to change.
//   <div data-filt-project="tempin"></div>
//   <script src=".../loader.js" data-template="project" data-project-id="tempin"></script>
//   <div data-filt-works></div>
//   <script src=".../loader.js" data-template="works" data-view="list"></script>
// version.json on the main branch names the published commit. raw.githubusercontent.com caches it
// for at most 5 minutes, while jsDelivr branch URLs are cached by browsers for 7 days, so the
// loader reads the pointer from GitHub and then loads immutable commit-pinned files from jsDelivr.
(() => {
  const script = document.currentScript;
  if (!script) return;

  const REPO = "filtehwa/filt-project-templates";
  const ENTRIES = { project: "project-template.js", works: "works.js" };
  const entry = ENTRIES[script.dataset.template] || ENTRIES.project;

  const inject = (ref) => {
    const target = document.createElement("script");
    target.src = `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/${entry}`;
    Object.entries(script.dataset).forEach(([key, value]) => {
      if (key !== "template") target.dataset[key] = value;
    });
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
