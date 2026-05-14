import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const runtimeCode = await fs.readFile(new URL("../public/cmp/owncmp.js", import.meta.url), "utf8");

function createElement(tagName, document) {
  const element = {
    tagName: tagName.toUpperCase(),
    id: "",
    type: "",
    className: "",
    hidden: false,
    innerHTML: "",
    children: [],
    attributes: {},
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    appendChild(child) {
      this.children.push(child);
      if (child.id) document.elements.set(child.id, child);
      return child;
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    focus() {},
    remove() {
      if (this.id) document.elements.delete(this.id);
    }
  };

  return element;
}

function createDocument(storedConsent) {
  const document = {
    elements: new Map(),
    currentScript: {
      src: "https://cmp.example.test/cmp/owncmp.js",
      getAttribute() {
        return null;
      }
    },
    activeElement: null,
    cookie: storedConsent ? `CleanCmpConsent=${encodeURIComponent(JSON.stringify(storedConsent))}` : "",
    head: null,
    body: null,
    createElement(tagName) {
      return createElement(tagName, document);
    },
    getElementById(id) {
      return this.elements.get(id) || null;
    },
    getElementsByTagName(name) {
      return name === "script" ? [this.currentScript] : [];
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  document.head = createElement("head", document);
  document.body = createElement("body", document);
  return document;
}

async function runRuntime(config, storedConsent, options = {}) {
  const document = createDocument(storedConsent);
  const window = {
    dataLayer: [],
    document,
    navigator: { globalPrivacyControl: false },
    performance: { mark() {}, getEntriesByName: () => [] },
    console
  };
  if (options.bootstrap) window.OwnCMPBootstrap = options.bootstrap;

  let fetchedUrl = "";

  const context = vm.createContext({
    window,
    document,
    navigator: window.navigator,
    performance: window.performance,
    console,
    URL,
    encodeURIComponent,
    decodeURIComponent,
    fetch: async (url) => {
      fetchedUrl = String(url);
      return {
      ok: true,
      json: async () => config
      };
    }
  });

  vm.runInContext(runtimeCode, context);
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { document, window, fetchedUrl };
}

const storedConsent = {
  schemaVersion: 1,
  type: "decision",
  cid: "cid-test",
  siteId: "demo-site",
  source: "user",
  action: "save_choices",
  categories: {
    necessary: true,
    analytics: true,
    marketing: false,
    personalization: false
  },
  googleConsent: {},
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z"
};

const baseConfig = {
  siteId: "demo-site",
  version: "test",
  consentTtlDays: 180,
  banner: {
    preferencesText: "Cookie preferences",
    reopenButtonPosition: "left"
  },
  googleConsentMode: {
    defaultState: {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      personalization_storage: "denied",
      security_storage: "granted"
    },
    categoryMap: {
      necessary: ["functionality_storage", "security_storage"],
      analytics: ["analytics_storage"],
      marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
      personalization: ["personalization_storage"]
    },
    regionalOverrides: [],
    recordConsent: true
  },
  dataLayer: { eventName: "cmp_consent_ready" },
  gpc: { enabled: true, showNotice: true, denyCategories: ["marketing", "personalization"] },
  cookieCleanup: { mode: "on_explicit_denial" },
  categories: [
    { id: "necessary", label: "Necessary", required: true, default: true },
    { id: "analytics", label: "Analytics", required: false, default: false },
    { id: "marketing", label: "Marketing", required: false, default: false },
    { id: "personalization", label: "Personalization", required: false, default: false }
  ],
  services: []
};

{
  const { document, window } = await runRuntime(baseConfig, storedConsent);
  const reopenButton = document.getElementById("owncmp-reopen");
  const readyEvent = window.dataLayer.find((entry) => entry && entry.event === "cmp_consent_ready");

  assert.ok(reopenButton, "reopen button should render");
  assert.equal(reopenButton.className, "owncmp-reopen owncmp-reopen-left");
  assert.equal(reopenButton.style.left, "18px");
  assert.equal(reopenButton.style.right, "auto");
  assert.match(reopenButton.innerHTML, /fill="#f2b76b"/);
  assert.ok(readyEvent, "configured dataLayer event should be pushed");
}

{
  const legacyConfig = {
    ...baseConfig,
    dataLayer: { eventName: "owncmp_consent_ready" }
  };
  const { window } = await runRuntime(legacyConfig, storedConsent);
  const readyEvent = window.dataLayer.find((entry) => entry && entry.event === "cmp_consent_ready");

  assert.ok(readyEvent, "legacy owncmp_consent_ready should migrate to cmp_consent_ready");
}

{
  const dottedConfig = {
    ...baseConfig,
    dataLayer: { eventName: "cmp.consent_ready" }
  };
  const { window } = await runRuntime(dottedConfig, storedConsent);
  const readyEvent = window.dataLayer.find((entry) => entry && entry.event === "cmp_consent_ready");

  assert.ok(readyEvent, "previous cmp.consent_ready value should migrate to cmp_consent_ready");
}

{
  const { window, fetchedUrl } = await runRuntime(baseConfig, storedConsent, {
    bootstrap: {
      siteId: "demo-site",
      configUrl: "https://cmp.example.test/api/public/config/demo-site/production",
      dataLayerName: "customDataLayer",
      googleConsent: false,
      gtmConsentFallback: true
    }
  });
  const readyEvent = window.customDataLayer.find((entry) => entry && entry.event === "cmp_consent_ready");

  assert.equal(fetchedUrl, "https://cmp.example.test/api/public/config/demo-site/production");
  assert.ok(readyEvent, "bootstrap dataLayer name should receive the consent-ready event");
}

console.log("Runtime behavior tests passed.");
