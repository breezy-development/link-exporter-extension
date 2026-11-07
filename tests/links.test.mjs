import assert from "node:assert/strict";
import { test } from "node:test";

import {
  exportFilename,
  filterLinks,
  normalizeLinks,
  registrableHost,
  toCSV,
  toMarkdown,
  toPlainText,
} from "../extension/lib/links.js";

const PAGE = "https://blog.example.com/posts/hello?id=7";

const RAW = [
  { href: "https://blog.example.com/about", text: "  About\n us " },
  { href: "/contact", text: "Contact" },
  { href: "https://blog.example.com/about", text: "About (footer)" },
  { href: "https://shop.example.com/cart", text: "Cart" },
  { href: "https://github.com/acme?utm_source=blog&utm_medium=x&tab=repos", text: "GitHub" },
  { href: "https://news.example.org/a#comments", text: "Story" },
  { href: "#section-2", text: "Section 2" },
  { href: "mailto:hi@example.com", text: "Email" },
  { href: "javascript:void(0)", text: "JS" },
  { href: "http://[bad", text: "Broken" },
];

test("normalizeLinks resolves, cleans, dedupes and classifies", () => {
  const links = normalizeLinks(RAW, PAGE);
  assert.deepEqual(
    links.map((l) => l.url),
    [
      "https://blog.example.com/about",
      "https://blog.example.com/contact",
      "https://shop.example.com/cart",
      "https://github.com/acme?tab=repos",
      "https://news.example.org/a",
    ],
  );
  assert.equal(links[0].text, "About us");
  assert.deepEqual(
    links.map((l) => l.external),
    [false, false, false, true, true],
  );
});

test("options can keep duplicates, fragments and tracking params", () => {
  const links = normalizeLinks(RAW, PAGE, {
    dedupe: false,
    includeFragments: true,
    stripTracking: false,
  });
  const urls = links.map((l) => l.url);
  assert.equal(urls.filter((u) => u === "https://blog.example.com/about").length, 2);
  assert.ok(urls.includes("https://blog.example.com/posts/hello?id=7#section-2"));
  assert.ok(urls.includes("https://news.example.org/a#comments"));
  assert.ok(urls.some((u) => u.includes("utm_source=blog")));
});

test("stripping all params leaves no dangling question mark", () => {
  const [link] = normalizeLinks([{ href: "https://x.com/p?fbclid=abc&gclid=1", text: "" }], PAGE);
  assert.equal(link.url, "https://x.com/p");
});

test("filterLinks by scope and query", () => {
  const links = normalizeLinks(RAW, PAGE);
  assert.equal(filterLinks(links, { scope: "external" }).length, 2);
  assert.equal(filterLinks(links, { scope: "internal" }).length, 3);
  assert.deepEqual(
    filterLinks(links, { query: "  CART " }).map((l) => l.text),
    ["Cart"],
  );
  assert.deepEqual(
    filterLinks(links, { query: "github.com" }).map((l) => l.text),
    ["GitHub"],
  );
});

test("toCSV quotes, escapes and blocks formula injection", () => {
  const csv = toCSV([
    { text: 'Say "hi", world', url: "https://a.com/", host: "a.com", external: true },
    { text: "=HYPERLINK(\"evil\")", url: "https://b.com/", host: "b.com", external: false },
  ]);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], "text,url,host,external");
  assert.equal(lines[1], '"Say ""hi"", world",https://a.com/,a.com,yes');
  assert.equal(lines[2], `"'=HYPERLINK(""evil"")",https://b.com/,b.com,no`);
});

test("toMarkdown and toPlainText", () => {
  const links = [
    { text: "Docs [v2]", url: "https://a.com/docs", host: "a.com", external: true },
    { text: "", url: "https://a.com/x", host: "a.com", external: true },
  ];
  assert.equal(
    toMarkdown(links),
    "- [Docs \\[v2\\]](https://a.com/docs)\n- [https://a.com/x](https://a.com/x)\n",
  );
  assert.equal(toPlainText(links), "https://a.com/docs\nhttps://a.com/x\n");
});

test("registrableHost handles subdomains and two-part TLDs", () => {
  assert.equal(registrableHost("www.example.com"), "example.com");
  assert.equal(registrableHost("a.b.example.com"), "example.com");
  assert.equal(registrableHost("shop.example.co.uk"), "example.co.uk");
  assert.equal(registrableHost("localhost"), "localhost");
});

test("exportFilename", () => {
  assert.equal(
    exportFilename("https://www.example.com/a", "csv", new Date("2026-11-07T12:00:00Z")),
    "links-example.com-2026-11-07.csv",
  );
});
