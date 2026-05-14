import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const html = await fs.readFile(new URL("../public/disclosure.html", import.meta.url), "utf8");
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];

assert.ok(script, "disclosure page script should exist");

function createElement(id) {
  return {
    id,
    textContent: "",
    innerHTML: ""
  };
}

const elements = new Map([
  ["page-title", createElement("page-title")],
  ["page-intro", createElement("page-intro")],
  ["cid-label", createElement("cid-label")],
  ["cid-display", createElement("cid-display")],
  ["history-title", createElement("history-title")],
  ["history-container", createElement("history-container")]
]);

const document = {
  cookie: "",
  title: "",
  documentElement: { lang: "" },
  getElementById(id) {
    return elements.get(id);
  }
};

const config = {
  siteId: "demo-site",
  banner: {
    language: "en",
    disclosurePage: {}
  },
  categories: [
    { id: "necessary", label: "Necessary" },
    { id: "analytics", label: "Analytics" }
  ]
};

const history = [
  {
    type: "banner_shown",
    cid: "cid-test",
    siteId: "demo-site",
    source: "runtime",
    createdAt: "2026-05-14T10:00:00.000Z"
  },
  {
    type: "decision",
    cid: "cid-test",
    siteId: "demo-site",
    source: "user",
    action: "save_choices",
    categories: {
      necessary: true,
      analytics: false
    },
    createdAt: "2026-05-14T10:01:00.000Z"
  }
];

const context = vm.createContext({
  console,
  document,
  window: {
    location: {
      search: "?siteId=demo-site&cid=cid-test"
    }
  },
  URLSearchParams,
  fetch: async (url) => ({
    ok: true,
    json: async () => String(url).includes("/api/public/disclosure/") ? history : config
  })
});

vm.runInContext(script, context);
await new Promise((resolve) => setTimeout(resolve, 0));
await new Promise((resolve) => setTimeout(resolve, 0));

const rendered = elements.get("history-container").innerHTML;

assert.match(rendered, /banner_shown/, "history should render records without categories");
assert.match(rendered, /Necessary/, "history should render granted category labels");
assert.match(rendered, /Analytics/, "history should render denied category labels");
assert.doesNotMatch(rendered, /Cannot convert undefined or null to object/);

console.log("Disclosure history tests passed.");
