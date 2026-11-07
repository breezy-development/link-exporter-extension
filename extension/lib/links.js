// Pure link-processing helpers shared by the popup and the tests. No chrome.* APIs here.

export const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^_hs(enc|mi)$/i,
  /^ref_src$/i,
];

export const DEFAULT_OPTIONS = Object.freeze({
  stripTracking: true,
  dedupe: true,
  includeFragments: false,
  defaultFormat: "csv",
});

/**
 * Turn raw anchors ({href, text}) collected from a page into clean link records.
 * @param {{href: string, text: string}[]} raw
 * @param {string} pageUrl
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
 * @returns {{url: string, text: string, host: string, external: boolean}[]}
 */
export function normalizeLinks(raw, pageUrl, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const page = new URL(pageUrl);
  const seen = new Set();
  const out = [];

  for (const { href, text } of raw) {
    let url;
    try {
      url = new URL(href, page);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    if (!opts.includeFragments) {
      if (url.hash && sameDocument(url, page)) continue;
      url.hash = "";
    }
    if (opts.stripTracking) stripTrackingParams(url);

    const key = url.href;
    if (opts.dedupe && seen.has(key)) continue;
    seen.add(key);

    out.push({
      url: key,
      text: cleanText(text),
      host: url.hostname,
      external: registrableHost(url.hostname) !== registrableHost(page.hostname),
    });
  }
  return out;
}

export function stripTrackingParams(url) {
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(name))) url.searchParams.delete(name);
  }
  if ([...url.searchParams.keys()].length === 0) url.search = "";
  return url;
}

/**
 * @param {ReturnType<typeof normalizeLinks>} links
 * @param {{query?: string, scope?: "all" | "internal" | "external"}} filter
 */
export function filterLinks(links, { query = "", scope = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return links.filter((l) => {
    if (scope === "internal" && l.external) return false;
    if (scope === "external" && !l.external) return false;
    if (!q) return true;
    return l.url.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);
  });
}

export function toCSV(links) {
  const rows = [["text", "url", "host", "external"]];
  for (const l of links) rows.push([l.text, l.url, l.host, l.external ? "yes" : "no"]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function toMarkdown(links) {
  return links.map((l) => `- [${escapeMarkdown(l.text || l.url)}](${l.url})`).join("\n") + "\n";
}

export function toPlainText(links) {
  return links.map((l) => l.url).join("\n") + "\n";
}

export const FORMATS = {
  csv: { label: "CSV", mime: "text/csv", ext: "csv", render: toCSV },
  md: { label: "Markdown", mime: "text/markdown", ext: "md", render: toMarkdown },
  txt: { label: "URLs", mime: "text/plain", ext: "txt", render: toPlainText },
};

export function exportFilename(pageUrl, ext, now = new Date()) {
  const host = new URL(pageUrl).hostname.replace(/^www\./, "") || "page";
  const stamp = now.toISOString().slice(0, 10);
  return `links-${host}-${stamp}.${ext}`;
}

function sameDocument(url, page) {
  return url.origin === page.origin && url.pathname === page.pathname && url.search === page.search;
}

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function csvCell(value) {
  let s = String(value ?? "");
  // Neutralise spreadsheet formula injection from untrusted page text.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeMarkdown(text) {
  return text.replace(/([\\\[\]])/g, "\\$1");
}

// Good enough without a public-suffix list: compares the last two labels
// (last three for common two-part TLDs like co.uk).
export function registrableHost(hostname) {
  const parts = hostname.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const twoPart = /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoPart ? -3 : -2).join(".");
}
