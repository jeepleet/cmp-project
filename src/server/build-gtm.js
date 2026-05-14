import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

async function build() {
  const code = await fs.readFile(path.join(ROOT, "gtm", "own-cmp-consent-mode-template-code.js"), "utf8");
  const fieldsJson = await fs.readFile(path.join(ROOT, "gtm", "template-fields.json"), "utf8");
  const fields = JSON.parse(fieldsJson);

  const info = {
    type: "TAG",
    id: "cvt_temp_public_id",
    version: 1,
    securityGroups: [],
    displayName: fields.templateName || "Own CMP Consent Mode Bridge",
    brand: {
      id: "brand_dummy",
      displayName: "Own CMP",
      thumbnail: ""
    },
    description: "Sets Google Consent Mode defaults and updates consent from the Own CMP runtime.",
    categories: ["UTILITY", "ADVERTISING", "ANALYTICS"],
    containerContexts: ["WEB"]
  };

  const templateParameters = toGtmFields(fields.fields);

  const permissions = [];
  const globalsList = [];
  fields.permissions.filter(p => p.permission === "access_globals").forEach(p => {
    p.keys.forEach(k => {
      globalsList.push(gtmMap(
        ["key", "read", "write", "execute"],
        [
          gtmString(k),
          gtmBoolean(p.access === "read" || p.access === "any"),
          gtmBoolean(p.access === "write" || p.access === "any"),
          gtmBoolean(p.access === "execute" || p.access === "any")
        ]
      ));
    });
  });

  if (globalsList.length > 0) {
    permissions.push(permission("access_globals", [
      { key: "keys", value: gtmList(globalsList) }
    ]));
  }

  const consentTypes = fields.permissions.find(p => p.permission === "access_consent")?.types || [];
  if (consentTypes.length > 0) {
    permissions.push(permission("access_consent", [
      {
        key: "consentTypes",
        value: gtmList(consentTypes.map(t => gtmMap(
          ["consentType", "read", "write"],
          [gtmString(t), gtmBoolean(false), gtmBoolean(true)]
        )))
      }
    ]));
  }

  if (fields.permissions.some(p => p.permission === "write_data_layer")) {
    permissions.push(permission("write_data_layer", [
      { key: "allowedKeys", value: gtmString("any") }
    ]));
  }

  const injectScriptUrls = fields.permissions.find(p => p.permission === "inject_script")?.urls || [];
  if (injectScriptUrls.length > 0) {
    permissions.push(permission("inject_script", [
      { key: "urls", value: gtmList(injectScriptUrls.map(gtmString)) }
    ]));
  }

  const terms = [
    "By creating or modifying this file you agree to Google Tag Manager's Community",
    "Template Gallery Developer Terms of Service available at",
    "https://developers.google.com/tag-manager/gallery-tos (or such other URL as",
    "Google may provide), as modified from time to time."
  ].join("\n");

  const tpl = [
    "___TERMS_OF_SERVICE___",
    terms,
    "",
    "___INFO___",
    JSON.stringify(info, null, 2),
    "",
    "___TEMPLATE_PARAMETERS___",
    JSON.stringify(templateParameters, null, 2),
    "",
    "___SANDBOXED_JS_FOR_WEB_TEMPLATE___",
    code,
    "",
    "___WEB_PERMISSIONS___",
    JSON.stringify(permissions, null, 2),
    "",
    "___TESTS___",
    "scenarios: []",
    "",
    "___NOTES___",
    `Built on ${new Date().toISOString()}`
  ].join("\n");

  await fs.writeFile(path.join(ROOT, "gtm", "template.tpl"), tpl);
  console.log("Generated gtm/template.tpl");
}

build().catch(console.error);

function toGtmFields(sourceFields) {
  return sourceFields.map(field => {
    if (field.type === "select") {
      return {
        type: "SELECT",
        name: field.name,
        displayName: field.displayName,
        simpleValueType: true,
        selectItems: (field.options || []).map(option => ({
          value: option,
          displayValue: option
        })),
        defaultValue: field.defaultValue
      };
    }

    return {
      type: "TEXT",
      name: field.name,
      displayName: field.displayName,
      simpleValueType: true,
      valueHint: field.defaultValue == null ? "" : String(field.defaultValue),
      help: field.help || "",
      defaultValue: field.defaultValue == null ? "" : String(field.defaultValue)
    };
  });
}

function permission(publicId, param) {
  return {
    instance: {
      key: { publicId, versionId: "1" },
      param
    },
    clientAnnotations: {
      isEditedByUser: true
    },
    isRequired: true
  };
}

function gtmString(string) {
  return { type: 1, string };
}

function gtmBoolean(boolean) {
  return { type: 8, boolean };
}

function gtmList(listItem) {
  return { type: 2, listItem };
}

function gtmMap(keys, values) {
  return {
    type: 3,
    mapKey: keys.map(gtmString),
    mapValue: values
  };
}
