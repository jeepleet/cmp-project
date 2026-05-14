import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../gtm/own-cmp-consent-mode-template-code.js", import.meta.url), "utf8");
const template = await fs.readFile(new URL("../gtm/template.tpl", import.meta.url), "utf8");

assert.match(source, /setInWindow\("OwnCMPBootstrap", bootstrapSettings, true\)/);
assert.match(source, /injectScript\(runtimeUrl,/);
assert.match(source, /const runtimeUrl = stableScriptUrl\(data\.runtimeUrl \|\| "https:\/\/cmp\.cleancmp\.com\/cmp\/owncmp\.js"\)/);
assert.doesNotMatch(source, /runtimeUrlWithConfig/);
assert.doesNotMatch(source, /siteId="\s*\+/);
assert.doesNotMatch(source, /configUrl="\s*\+/);
assert.doesNotMatch(source, /gtmConsentFallback=true/);

assert.match(template, /"string": "https:\/\/cmp\.cleancmp\.com\/cmp\/owncmp\.js"/);
assert.doesNotMatch(template, /https:\/\/cmp\.cleancmp\.com\/cmp\/owncmp\.js\?\*/);
assert.doesNotMatch(template, /runtimeUrlWithConfig/);

console.log("GTM template tests passed.");
