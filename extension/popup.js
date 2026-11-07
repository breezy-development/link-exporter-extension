import {
  DEFAULT_OPTIONS,
  FORMATS,
  exportFilename,
  filterLinks,
  normalizeLinks,
} from "./lib/links.js";

const $ = (id) => document.getElementById(id);

const state = { pageUrl: "", links: [], visible: [] };

// Runs inside the page via chrome.scripting.executeScript, so it must be self-contained.
function collectAnchors() {
  return Array.from(document.querySelectorAll("a[href]"), (a) => ({
    href: a.href,
    text:
      a.innerText ||
      a.getAttribute("aria-label") ||
      a.title ||
      a.querySelector("img[alt]")?.alt ||
      "",
  }));
}

async function init() {
  const options = { ...DEFAULT_OPTIONS, ...(await chrome.storage.sync.get(DEFAULT_OPTIONS)) };
  $("format").value = options.defaultFormat;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.pageUrl = tab?.url ?? "";
  $("page").textContent = tab?.title ? `${tab.title} — ${state.pageUrl}` : state.pageUrl;

  let raw;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectAnchors,
    });
    raw = injection?.result ?? [];
  } catch (err) {
    showError("Chrome doesn't allow extensions to read this page (e.g. chrome:// or the Web Store).");
    return;
  }

  state.links = normalizeLinks(raw, state.pageUrl, options);
  render();
}

function currentFilter() {
  return {
    query: $("query").value,
    scope: document.querySelector('input[name="scope"]:checked').value,
  };
}

function render() {
  state.visible = filterLinks(state.links, currentFilter());
  const list = $("list");
  list.replaceChildren();

  const external = state.visible.filter((l) => l.external).length;
  $("count").textContent =
    `${state.visible.length} of ${state.links.length} links` +
    (state.visible.length ? ` · ${external} external` : "");

  if (!state.visible.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = state.links.length ? "No links match this filter." : "No links on this page.";
    list.append(li);
  }

  for (const link of state.visible) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.className = "text";
    text.textContent = link.text || "(no text)";
    if (link.external) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = link.host;
      text.append(badge);
    }
    const url = document.createElement("a");
    url.className = "url";
    url.href = link.url;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = link.url;
    li.append(text, url);
    list.append(li);
  }

  $("copy").disabled = $("download").disabled = !state.visible.length;
}

function exported() {
  const fmt = FORMATS[$("format").value];
  return { fmt, body: fmt.render(state.visible) };
}

async function copy() {
  const { body } = exported();
  await navigator.clipboard.writeText(body);
  flash($("copy"), "Copied!");
}

function download() {
  const { fmt, body } = exported();
  const blob = new Blob([body], { type: `${fmt.mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename(state.pageUrl, fmt.ext);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function flash(button, text) {
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => (button.textContent = original), 1200);
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
  $("copy").disabled = $("download").disabled = true;
}

$("query").addEventListener("input", render);
document.querySelectorAll('input[name="scope"]').forEach((r) => r.addEventListener("change", render));
$("copy").addEventListener("click", copy);
$("download").addEventListener("click", download);
$("open-options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
