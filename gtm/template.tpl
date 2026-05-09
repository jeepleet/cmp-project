___TERMS_OF_SERVICE___
By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.

___INFO___
{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Own CMP Consent Mode Bridge",
  "brand": {
    "id": "brand_dummy",
    "displayName": "Own CMP",
    "thumbnail": ""
  },
  "description": "Sets Google Consent Mode defaults and updates consent from the Own CMP runtime.",
  "categories": [
    "UTILITY",
    "ADVERTISING",
    "ANALYTICS"
  ],
  "containerContexts": [
    "WEB"
  ]
}

___TEMPLATE_PARAMETERS___
[
  {
    "type": "TEXT",
    "name": "region",
    "displayName": "Region codes",
    "simpleValueType": true,
    "valueHint": "",
    "help": "Optional ISO 3166-2 region list, comma-separated. Leave blank for global defaults.",
    "defaultValue": ""
  },
  {
    "type": "TEXT",
    "name": "waitForUpdateMs",
    "displayName": "wait_for_update milliseconds",
    "simpleValueType": true,
    "valueHint": "500",
    "help": "",
    "defaultValue": "500"
  },
  {
    "type": "SELECT",
    "name": "ad_storage",
    "displayName": "Default ad_storage",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "denied"
  },
  {
    "type": "SELECT",
    "name": "ad_user_data",
    "displayName": "Default ad_user_data",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "denied"
  },
  {
    "type": "SELECT",
    "name": "ad_personalization",
    "displayName": "Default ad_personalization",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "denied"
  },
  {
    "type": "SELECT",
    "name": "analytics_storage",
    "displayName": "Default analytics_storage",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "denied"
  },
  {
    "type": "SELECT",
    "name": "functionality_storage",
    "displayName": "Default functionality_storage",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "granted"
  },
  {
    "type": "SELECT",
    "name": "personalization_storage",
    "displayName": "Default personalization_storage",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "denied"
  },
  {
    "type": "SELECT",
    "name": "security_storage",
    "displayName": "Default security_storage",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "denied",
        "displayValue": "denied"
      },
      {
        "value": "granted",
        "displayValue": "granted"
      }
    ],
    "defaultValue": "granted"
  },
  {
    "type": "SELECT",
    "name": "adsDataRedaction",
    "displayName": "Ads data redaction",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "inherit",
        "displayValue": "inherit"
      },
      {
        "value": "true",
        "displayValue": "true"
      },
      {
        "value": "false",
        "displayValue": "false"
      }
    ],
    "defaultValue": "inherit"
  },
  {
    "type": "SELECT",
    "name": "urlPassthrough",
    "displayName": "URL passthrough",
    "simpleValueType": true,
    "selectItems": [
      {
        "value": "inherit",
        "displayValue": "inherit"
      },
      {
        "value": "true",
        "displayValue": "true"
      },
      {
        "value": "false",
        "displayValue": "false"
      }
    ],
    "defaultValue": "inherit"
  }
]

___SANDBOXED_JS_FOR_WEB_TEMPLATE___
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


___WEB_PERMISSIONS___
[
  {
    "instance": {
      "key": {
        "publicId": "access_globals",
        "versionId": "1"
      },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "OwnCMP.onReady"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "OwnCMP.onChange"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "OwnCMPGtmBridge"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "access_consent",
        "versionId": "1"
      },
      "param": [
        {
          "key": "consentTypes",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "ad_storage"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "ad_user_data"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "ad_personalization"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "analytics_storage"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "functionality_storage"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "personalization_storage"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "security_storage"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "write_data_layer",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedKeys",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]

___TESTS___
scenarios: []

___NOTES___
Built on 2026-05-08T16:43:34.636Z