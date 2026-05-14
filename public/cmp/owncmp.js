(function () {
  "use strict";

  if (window.performance && performance.mark) performance.mark("owncmp-init");

  var script = document.currentScript || lastScript();
  var bootstrap = window.OwnCMPBootstrap && typeof window.OwnCMPBootstrap === "object" ? window.OwnCMPBootstrap : {};
  var siteId = attr("data-site-id", "demo-site");
  var configUrl = attr("data-config-url", "/api/public/config/" + encodeURIComponent(siteId) + "/production");
  var dataLayerName = attr("data-layer", "dataLayer");
  var manageGoogleConsent = attr("data-google-consent", "true") !== "false";
  var gtmConsentFallback = attr("data-gtm-consent-fallback", "false") === "true";
  var api = createApi();
  var pendingCid = null;
  var bannerRecordSent = false;

  var fallbackGoogleState = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted"
  };

  window.OwnCMP = api;
  window.OwnCMPAddConsentListener = function (listener) {
    api.addConsentListener(listener);
    return true;
  };
  window[dataLayerName] = window[dataLayerName] || [];
  if (manageGoogleConsent) {
    setGoogleConsent("default", withWait(fallbackGoogleState, 500));
  }

  fetchConfig()
    .then(function (config) {
      if (window.performance && performance.mark) performance.mark("owncmp-config-received");
      start(config);
    })
    .catch(function () {
      start(defaultConfig());
    });

  function start(config) {
    api._config = config;
    api._siteId = config.siteId || siteId;
    renderReopenButton(config);

    if (manageGoogleConsent && config.googleConsentMode && Array.isArray(config.googleConsentMode.regionalOverrides)) {
      config.googleConsentMode.regionalOverrides.forEach(function (override) {
        if (Array.isArray(override.region) && override.region.length > 0) {
          var state = withWait(override.state, config.googleConsentMode.waitForUpdateMs || 500);
          state.region = override.region;
          setGoogleConsent("default", state);
        }
      });
    }

    var stored = readStoredConsent(config);
    if (stored) {
      applyConsent(config, stored, "stored");
      return;
    }

    showBanner(config);
  }

  var previousActiveElement = null;

  function showBanner(config) {
    if (document.getElementById("owncmp-root")) return;
    if (window.performance && performance.mark) performance.mark("owncmp-banner-shown");

    previousActiveElement = document.activeElement;
    var gpcActive = Boolean(config.gpc && config.gpc.enabled && navigator.globalPrivacyControl === true);
    var selection = api._consent && api._consent.categories
      ? copy(api._consent.categories)
      : initialSelection(config, gpcActive);
    var banner = config.banner || {};
    var theme = banner.theme || {};
    var privacyPolicyUrl = safeHttpUrl(banner.privacyPolicyUrl);
    var disclosureUrl = disclosurePageUrl(config);
    var radius = bannerRadius(banner.cornerStyle);
    var root = document.createElement("div");
    root.id = "owncmp-root";
    root.className = banner.position === "center" ? "owncmp-position-center" : "owncmp-position-bottom";
    root.innerHTML = [
      '<div class="owncmp-backdrop" data-owncmp-close></div>',
      '<section class="owncmp-panel" role="dialog" aria-modal="true" aria-labelledby="owncmp-title" aria-describedby="owncmp-body">',
      banner.logoDataUrl ? '<div class="owncmp-logo"><img src="' + escapeHtml(banner.logoDataUrl) + '" alt="' + escapeHtml(banner.logoAlt || "") + '"></div>' : "",
      '<div class="owncmp-copy">',
      '<h2 id="owncmp-title">' + escapeHtml(banner.title || "Privacy choices") + "</h2>",
      '<p id="owncmp-body">' + escapeHtml(banner.body || "Choose which cookies and technologies you allow.") + "</p>",
      privacyPolicyUrl ? '<p class="owncmp-linkline"><a href="' + escapeHtml(privacyPolicyUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(banner.privacyPolicyText || "Privacy policy") + "</a></p>" : "",
      gpcActive && config.gpc.showNotice ? '<p class="owncmp-note">' + escapeHtml(banner.gpcNoticeText || "Global Privacy Control was detected. Sale and sharing categories are off by default.") + "</p>" : "",
      "</div>",
      '<div class="owncmp-actions">',
      '<button type="button" class="owncmp-btn owncmp-neutral" data-owncmp-reject>' + escapeHtml(banner.rejectAllText || "Reject all") + "</button>",
      '<button type="button" class="owncmp-btn owncmp-plain" data-owncmp-preferences>' + escapeHtml(banner.preferencesText || "Preferences") + "</button>",
      '<button type="button" class="owncmp-btn owncmp-primary" data-owncmp-accept>' + escapeHtml(banner.acceptAllText || "Accept all") + "</button>",
      "</div>",
      '<div class="owncmp-preferences" hidden>',
      '<div class="owncmp-category-list">' + categoryControls(config, selection) + "</div>",
      '<div class="owncmp-actions owncmp-actions-end">',
      '<a href="' + escapeHtml(disclosureUrl) + '" target="_blank" style="font-size: 12px; color: var(--owncmp-neutral); margin-right: auto; text-decoration: underline;">' + escapeHtml(banner.disclosureLinkText || "View my consent data") + "</a>",
      '<button type="button" class="owncmp-btn owncmp-primary" data-owncmp-save>' + escapeHtml(banner.saveText || "Save choices") + "</button>",
      "</div>",
      "</div>",
      "</section>"
    ].join("");

    root.style.setProperty("--owncmp-bg", theme.background || "#ffffff");
    root.style.setProperty("--owncmp-text", theme.text || "#1d1f24");
    root.style.setProperty("--owncmp-border", theme.border || "#d9dee7");
    root.style.setProperty("--owncmp-primary", theme.primary || "#0f766e");
    root.style.setProperty("--owncmp-neutral", theme.neutral || "#374151");
    root.style.setProperty("--owncmp-radius", radius.panel);
    root.style.setProperty("--owncmp-control-radius", radius.control);

    injectStyles(banner.customCss);
    appendToBody(root);
    dispatchBannerShown(config, gpcActive);

    var panel = root.querySelector(".owncmp-panel");
    var focusable = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable[0]) focusable[0].focus();

    root.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        choose(config, api._consent ? api._consent.categories : initialSelection(config, gpcActive), "user");
      }
      if (e.key === "Tab") {
        var elements = Array.prototype.slice.call(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter(function(el) {
            return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          });
        var first = elements[0];
        var last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    });

    root.querySelector("[data-owncmp-accept]").addEventListener("click", function () {
      choose(config, allSelection(config, true), "user", "accept_all");
    });
    root.querySelector("[data-owncmp-reject]").addEventListener("click", function () {
      choose(config, allSelection(config, false), "user", "reject_all");
    });
    root.querySelector("[data-owncmp-preferences]").addEventListener("click", function () {
      root.querySelector(".owncmp-preferences").hidden = false;
      root.querySelector("[data-owncmp-preferences]").hidden = true;
      var firstInput = root.querySelector("[data-owncmp-category]");
      if (firstInput) firstInput.focus();
    });
    root.querySelector("[data-owncmp-save]").addEventListener("click", function () {
      var next = {};
      config.categories.forEach(function (category) {
        var input = root.querySelector('[data-owncmp-category="' + cssEscape(category.id) + '"]');
        next[category.id] = category.required || Boolean(input && input.checked);
      });
      choose(config, next, "user", "save_choices");
    });
  }

  function choose(config, categories, source, action) {
    if (window.performance && performance.mark) performance.mark("owncmp-interaction");
    var record = buildRecord(config, categories, source, action);
    try {
      writeStoredConsent(config, record);
      safeRun(function () { applyConsent(config, record, source); });
      safeRun(function () { syncShopifyCustomerPrivacy(config, record); });
      safeRun(function () { dispatchRecord(config, record); });
      safeRun(function () { cleanupDeniedCookies(config, categories); });
    } finally {
      closeBanner();
    }
  }

  function applyConsent(config, record, source) {
    var googleConsent = mapGoogleConsent(config, record.categories);
    record.googleConsent = googleConsent;

    if (manageGoogleConsent || gtmConsentFallback) {
      setGoogleConsent("update", googleConsent);
    }
    api._consent = record;
    notifyGtmBridge(record);
    notifyConsentListeners(record);
    emitReady(config, record, source);
  }

  function dispatchBannerShown(config, gpcActive) {
    if (bannerRecordSent) return;
    var record = {
      schemaVersion: 1,
      type: "banner_shown",
      cid: getPendingCid(config),
      siteId: config.siteId || siteId,
      configVersion: config.version || "draft",
      source: "runtime",
      gpc: Boolean(gpcActive),
      createdAt: new Date().toISOString()
    };
    bannerRecordSent = true;
    dispatchRecord(config, record);
  }

  function dispatchRecord(config, record) {
    if (config.googleConsentMode && config.googleConsentMode.recordConsent === false) return;
    
    var endpoint = configUrl.split("/api/public/config")[0] + "/api/public/record";
    var payload = {
      siteId: config.siteId || siteId,
      type: record.type || "decision",
      configVersion: config.version,
      cid: record.cid,
      source: record.source,
      action: record.action,
      categories: record.categories,
      gpc: record.gpc
    };

    if (typeof fetch === "function") {
      fetch(endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(function() {});
    }
  }

  function syncShopifyCustomerPrivacy(config, record) {
    var integration = config.integrations && config.integrations.shopifyCustomerPrivacy;
    if (!integration || integration.enabled !== true) return;
    if (!record || record.source !== "user") return;

    var consent = {
      analytics: Boolean(record.categories && record.categories.analytics),
      marketing: Boolean(record.categories && record.categories.marketing),
      preferences: Boolean(record.categories && record.categories.personalization)
    };

    loadShopifyCustomerPrivacy(function (api) {
      if (!api || typeof api.setTrackingConsent !== "function") return;
      api.setTrackingConsent(consent, function () {});
    });
  }

  function loadShopifyCustomerPrivacy(callback) {
    if (window.Shopify && window.Shopify.customerPrivacy) {
      callback(window.Shopify.customerPrivacy);
      return;
    }

    if (!window.Shopify || typeof window.Shopify.loadFeatures !== "function") {
      callback(null);
      return;
    }

    window.Shopify.loadFeatures([
      {
        name: "consent-tracking-api",
        version: "0.1"
      }
    ], function (error) {
      callback(error ? null : window.Shopify && window.Shopify.customerPrivacy);
    });
  }

  function mapGoogleConsent(config, categories) {
    var googleConfig = config.googleConsentMode || {};
    var state = copy(googleConfig.defaultState || fallbackGoogleState);
    var categoryMap = googleConfig.categoryMap || {};

    Object.keys(categoryMap).forEach(function (categoryId) {
      var granted = Boolean(categories[categoryId]);
      categoryMap[categoryId].forEach(function (signal) {
        state[signal] = granted ? "granted" : "denied";
      });
    });

    return state;
  }

  function emitReady(config, record, source) {
    var eventName = consentEventName(config);
    window[dataLayerName] = window[dataLayerName] || [];
    window[dataLayerName].push({
      event: eventName,
      owncmp: {
        siteId: config.siteId || siteId,
        version: config.version || "draft",
        hasDecision: true,
        source: source,
        gpc: Boolean(navigator.globalPrivacyControl === true),
        categories: copy(record.categories),
        googleConsent: copy(record.googleConsent)
      }
    });
  }

  function setGoogleConsent(command, state) {
    window[dataLayerName] = window[dataLayerName] || [];
    window.gtag = window.gtag || function () {
      window[dataLayerName].push(arguments);
    };
    window.gtag("consent", command, state);
  }

  function notifyGtmBridge(record) {
    if (typeof window.OwnCMPGtmBridge === "function") {
      safeRun(function () { window.OwnCMPGtmBridge(record); });
    }
  }

  function notifyConsentListeners(record) {
    api._listeners.forEach(function (listener) {
      safeRun(function () { listener(record); });
    });
  }

  function withWait(state, waitMs) {
    var next = copy(state);
    next.wait_for_update = waitMs;
    return next;
  }

  function initialSelection(config, gpcActive) {
    var selection = {};
    var deny = config.gpc && Array.isArray(config.gpc.denyCategories) ? config.gpc.denyCategories : [];
    config.categories.forEach(function (category) {
      selection[category.id] = category.required || Boolean(category.default);
      if (gpcActive && deny.indexOf(category.id) !== -1) {
        selection[category.id] = false;
      }
    });
    return selection;
  }

  function allSelection(config, enabled) {
    var selection = {};
    config.categories.forEach(function (category) {
      selection[category.id] = category.required || Boolean(enabled);
    });
    return selection;
  }

  function buildRecord(config, categories, source, action) {
    var existing = readStoredConsent(config);
    var now = new Date().toISOString();
    return {
      schemaVersion: 1,
      type: "decision",
      cid: (existing && existing.cid) || getPendingCid(config),
      siteId: config.siteId || siteId,
      configVersion: config.version || "draft",
      source: source,
      action: action || "save_choices",
      categories: categories,
      googleConsent: mapGoogleConsent(config, categories),
      gpc: Boolean(navigator.globalPrivacyControl === true),
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now
    };
  }

  function readStoredConsent(config) {
    var legacy = false;
    var raw = readCookie(cookieName(config));
    if (!raw) {
      raw = readCookie(legacyCookieName(config));
      legacy = Boolean(raw);
    }
    if (!raw) return null;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.siteId !== (config.siteId || siteId) || !parsed.categories) return null;
      if (legacy) writeStoredConsent(config, parsed);
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeStoredConsent(config, record) {
    var ttl = Number(config.consentTtlDays || 180);
    var encoded = encodeURIComponent(JSON.stringify(record));
    document.cookie = cookieName(config) + "=" + encoded + "; Path=/; Max-Age=" + ttl * 86400 + "; SameSite=Lax";
    expireCookie(legacyCookieName(config));
  }

  function readCookie(name) {
    var cookies = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < cookies.length; i += 1) {
      var part = cookies[i].trim();
      if (part.indexOf(name + "=") === 0) {
        return decodeURIComponent(part.slice(name.length + 1));
      }
    }
    return "";
  }

  function cookieName(config) {
    return "CleanCmpConsent";
  }

  function legacyCookieName(config) {
    return (config.consentCookieName && config.consentCookieName !== "CleanCmpConsent" ? config.consentCookieName : "owncmp_consent") + "_" + (config.siteId || siteId);
  }

  function expireCookie(name) {
    document.cookie = name + "=; Path=/; Max-Age=0; SameSite=Lax";
  }

  function getPendingCid(config) {
    var existing = readStoredConsent(config);
    if (existing && existing.cid) return existing.cid;
    if (!pendingCid) {
      pendingCid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return pendingCid;
  }

  function cleanupDeniedCookies(config, categories) {
    if (!config.cookieCleanup || config.cookieCleanup.mode !== "on_explicit_denial") return;
    if (!Array.isArray(config.services)) return;

    config.services.forEach(function (service) {
      if (!service.enabled || categories[service.category]) return;
      (service.cookies || []).forEach(deleteCookiePattern);
    });
  }

  function deleteCookiePattern(pattern) {
    if (!pattern) return;
    var names = document.cookie.split(";").map(function (part) {
      return part.split("=")[0].trim();
    });
    var matcher = wildcardMatcher(pattern);
    names.forEach(function (name) {
      if (!matcher(name)) return;
      document.cookie = name + "=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    });
  }

  function wildcardMatcher(pattern) {
    var source = "^" + String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
    var regex = new RegExp(source);
    return function (value) {
      return regex.test(value);
    };
  }

  function closeBanner() {
    var root = document.getElementById("owncmp-root");
    if (root) root.remove();
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
  }

  function renderReopenButton(config) {
    var banner = config.banner || {};
    var side = banner.reopenButtonPosition === "left" ? "left" : "right";
    var button = document.getElementById("owncmp-reopen") || document.createElement("button");
    button.id = "owncmp-reopen";
    button.type = "button";
    button.className = "owncmp-reopen owncmp-reopen-" + side;
    button.setAttribute("aria-label", banner.preferencesText || "Cookie preferences");
    button.innerHTML = [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8 2.7 2.7 0 0 1-3.1-3.1 2.7 2.7 0 0 1-3.1-3.1 2.7 2.7 0 0 1-2.6-2.6Z" fill="#f2b76b" stroke="#7c3f12" stroke-width="1.6" stroke-linejoin="round"></path>',
      '<path d="M15.5 6.2c.8.5 1.5 1.2 2.1 2" fill="none" stroke="#fff3d6" stroke-width="1.4" stroke-linecap="round"></path>',
      '<circle cx="8.3" cy="10" r="1.25" fill="#7c3f12"></circle>',
      '<circle cx="12.5" cy="14.1" r="1.25" fill="#7c3f12"></circle>',
      '<circle cx="8.8" cy="15.5" r="1" fill="#7c3f12"></circle>',
      '<circle cx="14.9" cy="10.6" r=".9" fill="#7c3f12"></circle>',
      '<path d="M12.7 18.2l2 1.7 3.4-4.1" fill="none" stroke="#0f766e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>',
      "</svg>"
    ].join("");
    button.onclick = function () { showBanner(config); };
    button.style.left = side === "left" ? "18px" : "auto";
    button.style.right = side === "right" ? "18px" : "auto";
    button.style.setProperty("--owncmp-bg", (banner.theme && banner.theme.background) || "#ffffff");
    button.style.setProperty("--owncmp-border", (banner.theme && banner.theme.border) || "#d9dee7");
    button.style.setProperty("--owncmp-primary", (banner.theme && banner.theme.primary) || "#0f766e");
    injectStyles(banner.customCss);
    appendToBody(button);
  }

  function categoryControls(config, selection) {
    return config.categories.map(function (category) {
      var checked = selection[category.id] ? " checked" : "";
      var disabled = category.required ? " disabled" : "";
      return [
        '<label class="owncmp-category">',
        '<span><strong>' + escapeHtml(category.label) + "</strong>",
        "<small>" + escapeHtml(category.description || "") + "</small></span>",
        '<input type="checkbox" data-owncmp-category="' + escapeHtml(category.id) + '"' + checked + disabled + ">",
        "</label>"
      ].join("");
    }).join("");
  }

  function injectStyles(customCss) {
    if (document.getElementById("owncmp-style")) return;
    var style = document.createElement("style");
    style.id = "owncmp-style";
    style.textContent = [
      "#owncmp-root{position:fixed;inset:0;z-index:2147483647;color:var(--owncmp-text);font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4}",
      ".owncmp-backdrop{position:absolute;inset:0;background:rgba(29,31,36,.18)}",
      ".owncmp-panel{position:absolute;left:16px;right:16px;bottom:16px;max-width:960px;margin:auto;background:var(--owncmp-bg);border:1px solid var(--owncmp-border);border-radius:var(--owncmp-radius);box-shadow:0 18px 50px rgba(29,31,36,.18);padding:18px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px}",
      ".owncmp-position-center .owncmp-panel{top:50%;bottom:auto;transform:translateY(-50%);max-width:720px;grid-template-columns:1fr}",
      ".owncmp-logo{grid-column:1/-1;margin-bottom:-4px}.owncmp-logo img{display:block;max-width:180px;max-height:64px;object-fit:contain}",
      ".owncmp-copy h2{margin:0 0 8px;font-size:20px;letter-spacing:0}.owncmp-copy p{margin:0;color:var(--owncmp-text)}.owncmp-note{margin-top:10px!important;font-size:13px}",
      ".owncmp-linkline{margin-top:10px!important;font-size:13px}.owncmp-linkline a{color:var(--owncmp-neutral);text-decoration:underline}",
      ".owncmp-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.owncmp-actions-end{margin-top:14px}",
      ".owncmp-btn{min-height:40px;border-radius:var(--owncmp-control-radius);border:1px solid var(--owncmp-border);padding:0 14px;font:inherit;font-weight:700;cursor:pointer}.owncmp-primary{color:#fff;background:var(--owncmp-primary);border-color:var(--owncmp-primary)}.owncmp-neutral{color:#fff;background:var(--owncmp-neutral);border-color:var(--owncmp-neutral)}.owncmp-plain{background:#fff;color:var(--owncmp-text)}",
      ".owncmp-preferences{grid-column:1/-1;border-top:1px solid var(--owncmp-border);padding-top:14px}.owncmp-category-list{display:grid;gap:10px}.owncmp-category{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px;border:1px solid var(--owncmp-border);border-radius:var(--owncmp-radius)}.owncmp-category small{display:block;margin-top:3px;color:#667085}.owncmp-category input{width:20px;height:20px}",
      ".owncmp-reopen{position:fixed;bottom:18px;z-index:2147483646;width:48px;height:48px;border-radius:999px;border:1px solid #8b5a2b;background:#fff7ed;color:#7c3f12;box-shadow:0 10px 28px rgba(29,31,36,.2);display:flex;align-items:center;justify-content:center;cursor:pointer}.owncmp-reopen svg{width:28px;height:28px;display:block}.owncmp-reopen-left{left:18px;right:auto}.owncmp-reopen-right{right:18px;left:auto}.owncmp-reopen:hover{background:#ffedd5;color:#6b2f0d}.owncmp-reopen:focus{outline:3px solid rgba(124,63,18,.28);outline-offset:2px}",
      "@media(max-width:720px){.owncmp-panel{grid-template-columns:1fr;left:8px;right:8px;bottom:8px}.owncmp-position-center .owncmp-panel{top:50%;bottom:auto}.owncmp-actions{justify-content:stretch}.owncmp-btn{flex:1 1 140px}}"
    ].join("") + (customCss ? "\n" + String(customCss) : "");
    document.head.appendChild(style);
  }

  function appendToBody(node) {
    if (document.body) {
      document.body.appendChild(node);
      return;
    }
    document.addEventListener("DOMContentLoaded", function () {
      document.body.appendChild(node);
    }, { once: true });
  }

  function fetchConfig() {
    return fetch(configUrl, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) throw new Error("Config request failed");
      return response.json();
    });
  }

  function defaultConfig() {
    return {
      siteId: siteId,
      version: "fallback",
      consentCookieName: "CleanCmpConsent",
      consentTtlDays: 180,
      banner: {},
      googleConsentMode: {
        defaultState: fallbackGoogleState,
        categoryMap: {
          necessary: ["functionality_storage", "security_storage"],
          analytics: ["analytics_storage"],
          marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
          personalization: ["personalization_storage"]
        },
        regionalOverrides: []
      },
      dataLayer: { eventName: "cmp_consent_ready" },
      gpc: { enabled: true, showNotice: true, denyCategories: ["marketing", "personalization"] },
      cookieCleanup: { mode: "on_explicit_denial" },
      categories: [
        { id: "necessary", label: "Necessary", description: "Required for the site to work.", required: true, default: true },
        { id: "analytics", label: "Analytics", description: "Measurement and site improvement.", required: false, default: false },
        { id: "marketing", label: "Marketing", description: "Advertising measurement and remarketing.", required: false, default: false },
        { id: "personalization", label: "Personalization", description: "Content and preference personalization.", required: false, default: false }
      ],
      services: []
    };
  }

  function createApi() {
    return {
      version: "0.1.0",
      _listeners: [],
      _config: null,
      _consent: null,
      getConsent: function () {
        return this._consent;
      },
      getConfig: function () {
        return this._config;
      },
      onReady: function (listener) {
        this.addConsentListener(listener);
      },
      onChange: function (listener) {
        if (typeof listener === "function") this._listeners.push(listener);
      },
      addConsentListener: function (listener) {
        if (typeof listener !== "function") return;
        if (this._consent) listener(this._consent);
        this._listeners.push(listener);
      },
      openBanner: function() {
        if (this._config) showBanner(this._config);
      },
      getPerformanceMetrics: function() {
        if (!window.performance || !performance.getEntriesByName) return null;
        var start = performance.getEntriesByName("owncmp-init")[0];
        var config = performance.getEntriesByName("owncmp-config-received")[0];
        var banner = performance.getEntriesByName("owncmp-banner-shown")[0];
        var click = performance.getEntriesByName("owncmp-interaction")[0];
        
        return {
          scriptLoad: start ? start.startTime : 0,
          configLatency: (start && config) ? config.startTime - start.startTime : 0,
          timeToBanner: (start && banner) ? banner.startTime - start.startTime : 0,
          interactionDelay: (click && banner) ? click.startTime - banner.startTime : 0 // Basic INP proxy
        };
      },
      getConfig: function () {
        return this._config;
      },
      resetConsent: function () {
        if (!this._config) return;
        expireCookie(cookieName(this._config));
        expireCookie(legacyCookieName(this._config));
        this._consent = null;
        showBanner(this._config);
      }
    };
  }

  function attr(name, fallback) {
    var value = script && script.getAttribute(name);
    if (value) return value;

    var bootstrapName = {
      "data-site-id": "siteId",
      "data-config-url": "configUrl",
      "data-layer": "dataLayerName",
      "data-google-consent": "googleConsent",
      "data-gtm-consent-fallback": "gtmConsentFallback"
    }[name];
    var bootstrapValue = bootstrapName ? bootstrap[bootstrapName] : null;
    if (bootstrapValue === undefined && name === "data-layer") bootstrapValue = bootstrap.dataLayer;
    if (bootstrapValue !== undefined && bootstrapValue !== null && bootstrapValue !== "") return String(bootstrapValue);

    var queryName = {
      "data-site-id": "siteId",
      "data-config-url": "configUrl",
      "data-layer": "dataLayer",
      "data-google-consent": "googleConsent",
      "data-gtm-consent-fallback": "gtmConsentFallback"
    }[name];

    return queryName ? scriptQueryParam(queryName, fallback) : fallback;
  }

  function consentEventName(config) {
    var configured = config.dataLayer && config.dataLayer.eventName;
    if (configured === "owncmp_consent_ready" || configured === "owncmp.consent_ready" || configured === "cmp.consent_ready") return "cmp_consent_ready";
    return configured || "cmp_consent_ready";
  }

  function disclosurePageUrl(config) {
    var cid = api._consent && api._consent.cid ? api._consent.cid : getPendingCid(config);
    return publicBaseUrl() + "/disclosure.html?siteId=" + encodeURIComponent(config.siteId || siteId) + "&cid=" + encodeURIComponent(cid);
  }

  function publicBaseUrl() {
    try {
      var url = new URL(configUrl, window.location.href);
      var marker = "/api/public/config";
      var index = url.pathname.indexOf(marker);
      var path = index === -1 ? "" : url.pathname.slice(0, index);
      return url.origin + path;
    } catch (_) {
      return "";
    }
  }

  function scriptQueryParam(name, fallback) {
    if (!script || !script.src) return fallback;
    try {
      var params = new URL(script.src, window.location.href).searchParams;
      return params.get(name) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function lastScript() {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeRun(fn) {
    try {
      fn();
    } catch (error) {
      if (window.console && typeof console.warn === "function") {
        console.warn("Own CMP non-critical runtime error:", error);
      }
    }
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function safeHttpUrl(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    try {
      var url = new URL(text, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (e) {
      return "";
    }
  }

  function bannerRadius(cornerStyle) {
    if (cornerStyle === "round") return { panel: "16px", control: "999px" };
    if (cornerStyle === "square") return { panel: "0", control: "0" };
    return { panel: "8px", control: "6px" };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
