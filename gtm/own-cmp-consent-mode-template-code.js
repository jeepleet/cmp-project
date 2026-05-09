const setDefaultConsentState = require("setDefaultConsentState");
const updateConsentState = require("updateConsentState");
const callInWindow = require("callInWindow");
const setInWindow = require("setInWindow");
const gtagSet = require("gtagSet");
const makeNumber = require("makeNumber");

const CONSENT_TYPES = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
  "functionality_storage",
  "personalization_storage",
  "security_storage"
];

const DEFAULT_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "granted",
  personalization_storage: "denied",
  security_storage: "granted"
};

const splitInput = (input) => {
  if (!input) return [];
  return input.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry);
};

const normalizeConsent = (record) => {
  const source = record && record.googleConsent
    ? record.googleConsent
    : record && record.owncmp && record.owncmp.googleConsent
      ? record.owncmp.googleConsent
      : null;

  if (!source) return null;

  const output = {};
  CONSENT_TYPES.forEach((type) => {
    output[type] = source[type] === "granted" ? "granted" : "denied";
  });
  return output;
};

const applyConsentUpdate = (record) => {
  const consent = normalizeConsent(record);
  if (consent) updateConsentState(consent);
};

const buildDefaultState = () => {
  const state = {};
  CONSENT_TYPES.forEach((type) => {
    state[type] = data[type] === "granted" ? "granted" : DEFAULT_DENIED[type];
  });

  const regions = splitInput(data.region);
  if (regions.length) state.region = regions;

  state.wait_for_update = makeNumber(data.waitForUpdateMs) || 500;
  return state;
};

if (data.adsDataRedaction !== "inherit") {
  gtagSet("ads_data_redaction", data.adsDataRedaction === "true");
}

if (data.urlPassthrough !== "inherit") {
  gtagSet("url_passthrough", data.urlPassthrough === "true");
}

setDefaultConsentState(buildDefaultState());

setInWindow("OwnCMPGtmBridge", applyConsentUpdate, true);
callInWindow("OwnCMP.onReady", applyConsentUpdate);
callInWindow("OwnCMP.onChange", applyConsentUpdate);

data.gtmOnSuccess();
