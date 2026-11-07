import { DEFAULT_OPTIONS } from "./lib/links.js";

const BOOLEAN_KEYS = ["stripTracking", "dedupe", "includeFragments"];

async function load() {
  const opts = await chrome.storage.sync.get(DEFAULT_OPTIONS);
  for (const key of BOOLEAN_KEYS) document.getElementById(key).checked = Boolean(opts[key]);
  document.getElementById("defaultFormat").value = opts.defaultFormat;
}

async function save() {
  const opts = { defaultFormat: document.getElementById("defaultFormat").value };
  for (const key of BOOLEAN_KEYS) opts[key] = document.getElementById(key).checked;
  await chrome.storage.sync.set(opts);
  const saved = document.getElementById("saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 1500);
}

document.getElementById("save").addEventListener("click", save);
load();
