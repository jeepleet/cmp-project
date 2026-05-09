# Global Privacy Control

Last updated: 2026-05-08

## Current Implementation

Own CMP has two GPC-related pieces:

- Runtime detection through `navigator.globalPrivacyControl`.
- Public support declaration at `/.well-known/gpc.json`.

The support resource currently lives at:

```text
public/.well-known/gpc.json
```

Expected local URL:

```text
http://localhost:8787/.well-known/gpc.json
```

Current response:

```json
{
  "gpc": true,
  "lastUpdate": "2026-05-08"
}
```

## Runtime Behavior

When GPC is detected and enabled in config, Own CMP defaults configured GPC-denied categories to off before the user interacts with the banner.

Current default denied categories:

- `marketing`
- `personalization`

## References

- W3C GPC draft: https://www.w3.org/TR/gpc/
- MDN GPC overview: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl
