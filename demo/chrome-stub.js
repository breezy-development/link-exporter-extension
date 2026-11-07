// Minimal chrome.* stub so popup.html / options.html can be previewed in a normal tab
// (used to make the README screenshots). Not part of the extension package.
//
// Preview URL params: ?q=<filter text>&scope=all|internal|external&format=csv|md|txt
(() => {
  const params = new URLSearchParams(location.search);
  const PAGE_URL = "https://docs.python.org/3/library/csv.html";
  const PAGE_TITLE = "csv — CSV File Reading and Writing — Python 3 documentation";
  const store = { defaultFormat: params.get("format") || "csv" };

  const linksPromise = fetch(new URL("sample-links.json", document.currentScript.src)).then((r) =>
    r.json(),
  );

  window.chrome = {
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, ...store };
        },
        async set(values) {
          Object.assign(store, values);
        },
      },
    },
    tabs: {
      async query() {
        return [{ id: 1, url: PAGE_URL, title: PAGE_TITLE }];
      },
    },
    scripting: {
      async executeScript() {
        const links = await linksPromise;
        const q = params.get("q");
        const scope = params.get("scope");
        if (q) document.getElementById("query").value = q;
        if (scope) document.querySelector(`input[name="scope"][value="${scope}"]`).checked = true;
        return [{ result: links }];
      },
    },
    runtime: { openOptionsPage() {} },
  };
})();
