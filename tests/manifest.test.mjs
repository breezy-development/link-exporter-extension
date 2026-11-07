import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extension");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

test("is a Manifest V3 extension", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description.length <= 132, "Web Store limit is 132 characters");
});

test("requests only the minimum permissions", () => {
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
});

test("every referenced file exists", () => {
  const files = [
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const f of files) assert.ok(existsSync(join(root, f)), `missing ${f}`);
});

test("no remote code: pages load only local scripts", () => {
  for (const page of ["popup.html", "options.html"]) {
    const html = readFileSync(join(root, page), "utf8");
    for (const [, src] of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
      assert.ok(!/^https?:/.test(src), `${page} loads remote script ${src}`);
    }
    assert.ok(!/<script(?![^>]*src=)[^>]*>\s*\S/.test(html), `${page} has inline script`);
  }
});
