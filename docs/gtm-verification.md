# GTM Template Verification

Last updated: 2026-05-08

## Status

Manual verification is pending after regenerating `gtm/template.tpl` with corrected GTM export sections.

The repository contains a generated importable template at:

```text
gtm/template.tpl
```

The template includes source code and test scenarios, but the import and test result must be confirmed inside Google Tag Manager.

## Manual Verification Steps

1. Open Google Tag Manager.
2. Open a test container.
3. Go to **Templates**.
4. Under **Tag Templates**, click **New**.
5. Use the top-right menu and select **Import**.
6. Select `gtm/template.tpl`.
7. Save the template.
8. Open the template tests.
9. Run all tests.
10. Create a tag from the template.
11. Fire it on **Consent Initialization - All Pages**.
12. Confirm that it sets default consent and updates consent when `window.OwnCMPGtmBridge` receives a record.

## Expected Result

- The `.tpl` imports without errors.
- Template permissions are accepted.
- Built-in template tests pass.
- A tag using the template can be created and assigned to **Consent Initialization - All Pages**.

## Result Log

- 2026-05-08: Pending user verification.
- 2026-05-08: First import attempt failed in GTM. The generated file used invalid export structure (`___PERMISSIONS___`, lowercase field types, missing Terms of Service section, and non-export permission value keys). Generator was corrected and `gtm/template.tpl` was regenerated.
