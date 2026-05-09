const state = {
  config: null,
  activeConfig: null,
  versions: [],
  dirty: false,
  session: null
};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const loginView = qs("#login-view");
const appView = qs("#app-view");
const saveState = qs("#save-state");

init();

async function init() {
  try {
    bindNavigation();
    bindLogin();
    bindActions();
    await loadSession();
  } catch (error) {
    console.error("Initialization failed:", error);
    document.body.innerHTML = `<div style="padding: 20px; color: #b42318; font-family: sans-serif;">
      <h2>Application Error</h2>
      <p>The admin interface failed to load.</p>
      <pre style="background: #fef3f2; padding: 10px; border: 1px solid #fecdca;">${error.stack || error.message}</pre>
      <button onclick="window.location.reload()" style="padding: 8px 16px; cursor: pointer;">Retry</button>
    </div>`;
  }
}

async function loadSession() {
  const session = await api("/api/session");
  state.session = session;
  const warning = qs("#login-warning");
  if (warning) warning.hidden = !session.usingDefaultCredentials;

  if (session.authenticated) {
    updateUserInfo(session);
    await loadConfig();
    showApp();
  } else {
    showLogin();
  }
}

function updateUserInfo(session) {
  const emailEl = qs("#user-email");
  if (emailEl) emailEl.textContent = session.email || "";
}

function bindLogin() {
  const form = qs("#login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const errorEl = qs("#login-error");
    if (errorEl) errorEl.hidden = true;

    try {
      const session = await api("/api/login", {
        method: "POST",
        body: {
          email: formData.get("email"),
          password: formData.get("password")
        }
      });
      updateUserInfo(session);
      await loadConfig();
      showApp();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
      }
    }
  });
}

function bindNavigation() {
  qsa(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".nav-item").forEach((item) => item.classList.remove("active"));
      qsa(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      const panel = qs(`#panel-${button.dataset.panel}`);
      if (panel) panel.classList.add("active");
    });
  });
}

function bindActions() {
  const safeListen = (id, event, fn) => {
    const el = qs(id);
    if (el) el.addEventListener(event, fn);
  };

  safeListen("#save-button", "click", saveDraft);
  safeListen("#publish-button", "click", publishConfig);
  safeListen("#export-button", "click", exportConfig);
  safeListen("#import-button", "click", () => qs("#import-input")?.click());
  safeListen("#import-input", "change", importConfig);
  safeListen("#logout-button", "click", logout);
  safeListen("#add-service-button", "click", addService);
  safeListen("#add-override-button", "click", addRegionalOverride);
  safeListen("#refresh-history-button", "click", loadVersionsAndRender);
  safeListen("#process-scan-button", "click", processScan);
  safeListen("#scanner-script-copy", "click", () => {
    navigator.clipboard.writeText(qs("#scanner-script-copy").textContent);
    alert("Script copied to clipboard!");
  });
  
  safeListen("#gpc-enabled", "change", (event) => {
    if (state.config) {
      state.config.gpc.enabled = event.target.checked;
      markDirty();
    }
  });

  safeListen("#consent-ttl", "input", (event) => {
    if (state.config) {
      state.config.consentTtlDays = Number(event.target.value || 180);
      markDirty();
    }
  });

  safeListen("#datalayer-event", "input", (event) => {
    if (state.config) {
      state.config.dataLayer.eventName = event.target.value.trim() || "owncmp.consent_ready";
      markDirty();
      renderSnippets();
    }
  });

  safeListen("#banner-form", "input", (event) => {
    const target = event.target;
    if (!target.name || !state.config) return;
    setPath(state.config, target.name, target.value);
    markDirty();
    renderOverview();
    renderSnippets();
  });
}

async function loadConfig() {
  state.config = await api("/api/config");
  await Promise.all([loadActiveConfig(), loadVersions()]);
  state.dirty = false;
  renderAll();
}

async function loadActiveConfig() {
  try {
    state.activeConfig = await api(`/api/public/config/${encodeURIComponent(state.config.siteId)}/production`);
  } catch (_) {
    state.activeConfig = null;
  }
}

async function loadVersions() {
  try {
    state.versions = await api(`/api/versions/${encodeURIComponent(state.config.siteId)}/production`);
  } catch (error) {
    console.error("Failed to load versions:", error);
    state.versions = [];
  }
}

async function loadVersionsAndRender() {
  await loadVersions();
  renderHistory();
}

function renderAll() {
  renderBannerForm();
  renderOverview();
  renderCategories();
  renderServices();
  renderDiff();
  renderHistory();
  renderSnippets();
  updateSaveState();
}

function renderBannerForm() {
  const form = qs("#banner-form");
  qsa("[name]", form).forEach((input) => {
    input.value = getPath(state.config, input.name) ?? "";
  });
}

function renderOverview() {
  qs("#site-heading").textContent = state.config.siteName || "Consent workspace";
  qs("#metric-site-id").textContent = state.config.siteId;
  qs("#metric-version").textContent = state.config.version || "draft";
  qs("#metric-published").textContent = state.config.lastPublishedAt
    ? new Date(state.config.lastPublishedAt).toLocaleString()
    : "Not published";

  const eventPreview = {
    event: state.config.dataLayer.eventName,
    owncmp: {
      siteId: state.config.siteId,
      hasDecision: true,
      source: "user",
      categories: Object.fromEntries(state.config.categories.map((category) => [category.id, category.default])),
      googleConsent: state.config.googleConsentMode.defaultState
    }
  };
  qs("#event-preview").textContent = JSON.stringify(eventPreview, null, 2);
  renderDiff();
}

function renderDiff() {
  const target = qs("#publish-diff");
  if (!target || !state.config) return;

  const changes = diffConfigs(state.activeConfig, state.config);
  if (!state.activeConfig) {
    target.innerHTML = '<p class="empty-state">No active production config found.</p>';
    return;
  }

  if (!changes.length) {
    target.innerHTML = '<p class="empty-state">No publish changes detected.</p>';
    return;
  }

  const rows = changes.slice(0, 60).map((change) => `
    <div class="diff-row">
      <div class="diff-path">${escapeHtml(change.path)}</div>
      <div class="diff-val diff-before">${escapeHtml(change.before || "(empty)")}</div>
      <div class="diff-val diff-after">${escapeHtml(change.after || "(empty)")}</div>
    </div>
  `).join("");

  target.innerHTML = `
    <div class="diff-header">
      <div>Setting</div>
      <div>Current</div>
      <div>Draft</div>
    </div>
    <div class="diff-list">
      ${rows}
    </div>
    ${changes.length > 60 ? `<p class="empty-state" style="margin-top: 10px;">${changes.length - 60} more changes hidden.</p>` : ""}
  `;
}

function renderCategories() {
  qs("#gpc-enabled").checked = Boolean(state.config.gpc.enabled);
  qs("#consent-ttl").value = state.config.consentTtlDays;
  qs("#datalayer-event").value = state.config.dataLayer.eventName;

  const rows = state.config.categories.map((category, index) => {
    const signals = state.config.googleConsentMode.categoryMap[category.id] || [];
    return `
      <tr>
        <td><input data-category-index="${index}" data-field="label" value="${escapeHtml(category.label)}"></td>
        <td><input data-category-index="${index}" data-field="description" value="${escapeHtml(category.description)}"></td>
        <td><input class="compact" data-category-index="${index}" data-field="required" type="checkbox" ${category.required ? "checked" : ""}></td>
        <td><input class="compact" data-category-index="${index}" data-field="default" type="checkbox" ${category.default ? "checked" : ""} ${category.required ? "disabled" : ""}></td>
        <td>${escapeHtml(signals.join(", ") || "none")}</td>
      </tr>
    `;
  }).join("");

  qs("#category-rows").innerHTML = rows;
  qsa("[data-category-index]").forEach((input) => {
    input.addEventListener("input", updateCategory);
    input.addEventListener("change", updateCategory);
  });

  renderRegionalOverrides();
}

function renderRegionalOverrides() {
  const overrides = state.config?.googleConsentMode?.regionalOverrides || [];
  const rows = overrides.map((override, index) => {
    const signals = Object.entries(override.state || {})
      .filter(([_, value]) => value === "denied")
      .map(([key]) => key.replace("_storage", ""))
      .join(", ") || "none denied";

    return `
      <tr>
        <td><input data-override-index="${index}" data-field="displayName" value="${escapeHtml(override.displayName)}"></td>
        <td><input data-override-index="${index}" data-field="region" value="${escapeHtml(override.region.join(", "))}"></td>
        <td style="font-size: 0.85rem; color: #64748b">${escapeHtml(signals)} denied</td>
        <td><button class="button subtle" data-remove-override="${index}" type="button">Remove</button></td>
      </tr>
    `;
  }).join("");

  qs("#regional-rows").innerHTML = rows || '<tr><td colspan="4" class="empty-state">No regional overrides defined.</td></tr>';

  qsa("[data-override-index]").forEach((input) => {
    input.addEventListener("input", updateRegionalOverride);
  });
  qsa("[data-remove-override]").forEach((button) => {
    button.addEventListener("click", () => {
      state.config.googleConsentMode.regionalOverrides.splice(Number(button.dataset.removeOverride), 1);
      markDirty();
      renderCategories();
    });
  });
}

function updateRegionalOverride(event) {
  const input = event.target;
  const override = state.config.googleConsentMode.regionalOverrides[Number(input.dataset.overrideIndex)];
  const field = input.dataset.field;

  if (field === "region") {
    override.region = input.value.split(",").map(r => r.trim().toUpperCase()).filter(Boolean);
  } else {
    override[field] = input.value;
  }
  markDirty();
}

function addRegionalOverride() {
  state.config.googleConsentMode.regionalOverrides.push({
    region: ["US-CA"],
    displayName: "California",
    state: clone(state.config.googleConsentMode.defaultState)
  });
  markDirty();
  renderCategories();
}

function updateCategory(event) {
  const input = event.target;
  const category = state.config.categories[Number(input.dataset.categoryIndex)];
  const field = input.dataset.field;
  category[field] = input.type === "checkbox" ? input.checked : input.value;
  if (category.required) category.default = true;
  markDirty();
  renderOverview();
}

function renderServices() {
  const categoryOptions = state.config.categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`)
    .join("");

  qs("#service-rows").innerHTML = state.config.services.map((service, index) => `
    <tr>
      <td><input class="compact" data-service-index="${index}" data-field="enabled" type="checkbox" ${service.enabled ? "checked" : ""}></td>
      <td><input data-service-index="${index}" data-field="name" value="${escapeHtml(service.name)}"></td>
      <td>
        <select data-service-index="${index}" data-field="category">
          ${categoryOptions}
        </select>
      </td>
      <td><input data-service-index="${index}" data-field="cookies" value="${escapeHtml(service.cookies.join(", "))}"></td>
      <td><button class="button subtle" data-remove-service="${index}" type="button">Remove</button></td>
    </tr>
  `).join("");

  state.config.services.forEach((service, index) => {
    const select = qs(`select[data-service-index="${index}"][data-field="category"]`);
    if (select) select.value = service.category;
  });

  qsa("[data-service-index]").forEach((input) => {
    input.addEventListener("input", updateService);
    input.addEventListener("change", updateService);
  });
  qsa("[data-remove-service]").forEach((button) => {
    button.addEventListener("click", () => {
      state.config.services.splice(Number(button.dataset.removeService), 1);
      markDirty();
      renderServices();
    });
  });
}

function renderHistory() {
  const rows = qs("#history-rows");
  if (!rows) return;

  if (!state.versions.length) {
    rows.innerHTML = '<tr><td colspan="5">No published versions yet.</td></tr>';
    qs("#version-preview").textContent = "Publish once to create a version.";
    return;
  }

  rows.innerHTML = state.versions.map((version) => `
    <tr>
      <td>
        <strong>${escapeHtml(version.version)}</strong>
        ${version.active ? '<span class="status-pill">Active</span>' : ""}
      </td>
      <td>${formatDate(version.lastPublishedAt)}</td>
      <td>${formatDate(version.lastActivatedAt)}</td>
      <td>${version.serviceCount}</td>
      <td class="row-actions">
        <button class="button subtle" data-view-version="${escapeHtml(version.version)}" type="button">View</button>
        <button class="button" data-restore-version="${escapeHtml(version.version)}" type="button" ${version.active ? "disabled" : ""}>Restore</button>
      </td>
    </tr>
  `).join("");

  qsa("[data-view-version]").forEach((button) => {
    button.addEventListener("click", () => viewVersion(button.dataset.viewVersion));
  });
  qsa("[data-restore-version]").forEach((button) => {
    button.addEventListener("click", () => restoreVersion(button.dataset.restoreVersion));
  });
}

function updateService(event) {
  const input = event.target;
  const service = state.config.services[Number(input.dataset.serviceIndex)];
  const field = input.dataset.field;

  if (field === "enabled") {
    service.enabled = input.checked;
  } else if (field === "cookies") {
    service.cookies = input.value.split(",").map((item) => item.trim()).filter(Boolean);
  } else {
    service[field] = input.value;
  }

  if (!service.id || field === "name") {
    service.id = slugify(service.name);
  }

  markDirty();
}

function renderSnippets() {
  const origin = window.location.origin;
  qs("#script-snippet").textContent = `<script
  src="${origin}/cmp/owncmp.js"
  data-site-id="${state.config.siteId}"
  data-config-url="${origin}/api/public/config/${state.config.siteId}/production"
  defer>
</script>`;

  qs("#gtm-script-snippet").textContent = `<script
  src="${origin}/cmp/owncmp.js"
  data-site-id="${state.config.siteId}"
  data-config-url="${origin}/api/public/config/${state.config.siteId}/production"
  data-google-consent="false">
</script>`;

  qs("#gtm-snippet").textContent = `Consent bridge template source: gtm/own-cmp-consent-mode-template-code.js
Trigger: Consent Initialization - All Pages
Custom Event trigger for consent-dependent tags: ${state.config.dataLayer.eventName}
Useful filter: owncmp.hasDecision equals true
Google signals are available at: owncmp.googleConsent`;
}

function addService() {
  state.config.services.push({
    id: `service-${state.config.services.length + 1}`,
    name: "New service",
    category: "analytics",
    enabled: false,
    cookies: [],
    notes: ""
  });
  markDirty();
  renderServices();
}

async function saveDraft() {
  try {
    const saved = await api("/api/config", {
      method: "PUT",
      body: state.config
    });
    state.config = saved;
    state.dirty = false;
    renderAll();
  } catch (error) {
    alert("Failed to save draft: " + error.message);
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `owncmp-config-${state.config.siteId}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const config = JSON.parse(text);
    
    if (!config.siteId || !config.categories) {
      throw new Error("Invalid configuration file: missing siteId or categories.");
    }

    if (!window.confirm("Importing this file will overwrite your current draft. Continue?")) {
      event.target.value = "";
      return;
    }

    const saved = await api("/api/config", {
      method: "PUT",
      body: config
    });

    state.config = saved;
    state.dirty = false;
    renderAll();
    alert("Configuration imported successfully.");
  } catch (error) {
    alert("Import failed: " + error.message);
  } finally {
    event.target.value = "";
  }
}

async function processScan() {
  const input = qs("#scanner-input").value;
  const resultsEl = qs("#scanner-results");
  if (!input) return alert("Please paste scan results first.");

  try {
    const data = JSON.parse(input);
    const cookies = data.cookies || [];
    const db = await api("/api/public/cookie-db");
    
    const identified = [];
    const matchedNames = new Set();

    db.forEach(item => {
      const foundCookies = cookies.filter(c => {
        return item.patterns.some(pattern => {
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$", "i");
          return regex.test(c);
        });
      });

      if (foundCookies.length > 0) {
        foundCookies.forEach(c => matchedNames.add(c));
        const alreadyExists = state.config.services.some(s => s.id === item.id);
        if (!alreadyExists) {
          identified.push({ ...item, matched: foundCookies });
        }
      }
    });

    const unidentified = cookies.filter(c => !matchedNames.has(c));

    let html = "";

    if (identified.length > 0) {
      html += `
        <div class="card">
          <h3>Identified Services (${identified.length})</h3>
          <div class="table-wrap" style="margin-top: 15px;">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Detected Cookies</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${identified.map((s, i) => `
                  <tr>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td><span class="status-pill">${escapeHtml(s.category)}</span></td>
                    <td style="font-size: 11px; color: var(--muted)">${escapeHtml(s.matched.join(", "))}</td>
                    <td><button class="button subtle" onclick="addServiceFromScanner(${i}, this)" data-service='${JSON.stringify(s)}'>Add Service</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (unidentified.length > 0) {
      html += `
        <div class="card" style="margin-top: 2rem;">
          <h3>Unidentified Cookies (${unidentified.length})</h3>
          <p class="scenario-note">The following cookies were found but aren't in our database. You can add them manually to a new service.</p>
          <div class="table-wrap" style="margin-top: 15px;">
            <table>
              <thead>
                <tr>
                  <th>Cookie Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${unidentified.map((name) => `
                  <tr>
                    <td style="font-family: monospace;">${escapeHtml(name)}</td>
                    <td><button class="button subtle" onclick="addManualFromScanner('${escapeHtml(name)}')">Add to Services</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (!html) {
      html = '<div class="card"><p class="empty-state">No new cookies or services identified.</p></div>';
    }

    resultsEl.innerHTML = html;
  } catch (e) {
    alert("Invalid JSON data: " + e.message);
  }
}

window.addManualFromScanner = function(name) {
  state.config.services.push({
    id: `custom-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name: `Service for ${name}`,
    category: "analytics",
    enabled: true,
    cookies: [name]
  });
  markDirty();
  renderServices();
  alert(`Added ${name} as a new custom service. Please check the Services tab to categorize it.`);
};

window.addServiceFromScanner = function(index, button) {
  const data = JSON.parse(button.dataset.service);
  state.config.services.push({
    id: data.id,
    name: data.name,
    category: data.category,
    enabled: true,
    cookies: data.patterns
  });
  markDirty();
  renderServices();
  button.disabled = true;
  button.textContent = "Added";
};

async function publishConfig() {
  const changes = diffConfigs(state.activeConfig, state.config);
  if (state.activeConfig && changes.length && !window.confirm(`Publish ${changes.length} change(s) to production?`)) {
    return;
  }

  try {
    const published = await api("/api/publish", {
      method: "POST",
      body: state.config
    });
    state.config = published;
    state.activeConfig = clone(published);
    await loadVersions();
    state.dirty = false;
    renderAll();
  } catch (error) {
    alert("Publish failed: " + error.message);
  }
}

async function viewVersion(version) {
  try {
    const config = await api(`/api/versions/${encodeURIComponent(state.config.siteId)}/production/${encodeURIComponent(version)}`);
    qs("#version-preview").textContent = JSON.stringify(config, null, 2);
  } catch (error) {
    alert("Failed to view version: " + error.message);
  }
}

async function restoreVersion(version) {
  if (!window.confirm(`Restore version ${version} to production?`)) return;

  try {
    const restored = await api("/api/rollback", {
      method: "POST",
      body: {
        siteId: state.config.siteId,
        environment: "production",
        version
      }
    });

    state.config = restored;
    state.activeConfig = clone(restored);
    state.dirty = false;
    await loadVersions();
    renderAll();
    qs("#version-preview").textContent = JSON.stringify(restored, null, 2);
  } catch (error) {
    alert("Restore failed: " + error.message);
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  state.config = null;
  showLogin();
}

function markDirty() {
  state.dirty = true;
  updateSaveState();
  renderDiff();
}

function updateSaveState() {
  saveState.textContent = state.dirty ? "Unsaved" : "Saved";
  saveState.classList.toggle("danger-text", state.dirty);
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((current, key) => {
    current[key] = current[key] || {};
    return current[key];
  }, object);
  target[last] = value;
}

function slugify(value) {
  return String(value || "service")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "service";
}

function diffConfigs(before, after) {
  if (!before || !after) return [];

  const beforeFlat = flattenForDiff(stripVolatile(before));
  const afterFlat = flattenForDiff(stripVolatile(after));
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();

  return keys
    .filter((key) => beforeFlat[key] !== afterFlat[key])
    .map((key) => ({
      path: key,
      before: beforeFlat[key] ?? "",
      after: afterFlat[key] ?? ""
    }));
}

function stripVolatile(config) {
  const copy = JSON.parse(JSON.stringify(config));
  delete copy.version;
  delete copy.updatedAt;
  delete copy.lastPublishedAt;
  delete copy.lastActivatedAt;
  delete copy.restoredAt;
  delete copy.restoredFromVersion;
  return copy;
}

function flattenForDiff(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    output[prefix || "root"] = JSON.stringify(value);
    return output;
  }

  if (value && typeof value === "object") {
    Object.keys(value).sort().forEach((key) => {
      flattenForDiff(value[key], prefix ? `${prefix}.${key}` : key, output);
    });
    return output;
  }

  output[prefix || "root"] = String(value);
  return output;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
