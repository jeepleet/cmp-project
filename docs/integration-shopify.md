# Shopify Integration Guide

Integrating Own CMP into Shopify is done by manually editing your theme's Liquid files. This ensures the CMP script loads before Shopify's native tracking and other third-party apps.

## Implementation

The example below uses the active production config URL, so new published configs become active automatically. For controlled launches, replace the config URL with the pinned production version URL shown in Admin after publishing.

1. Log in to your Shopify Admin.
2. Go to **Online Store** > **Themes**.
3. Click the **...** (three dots) next to your active theme and select **Edit code**.
4. Find and open the `layout/theme.liquid` file.
5. Paste the following snippet immediately after the opening `<head>` tag:

```liquid
<!-- Own CMP Start -->
{%- assign cmp_domain = 'https://your-cmp-instance.com' -%}
{%- assign site_id = 'demo-site' -%}
{%- assign environment = 'production' -%}
{%- assign gtm_mode = false -%}

<script 
  src="{{ cmp_domain }}/cmp/owncmp.js" 
  data-site-id="{{ site_id }}" 
  data-config-url="{{ cmp_domain }}/api/public/config/{{ site_id }}/{{ environment }}" 
  {% if gtm_mode %}data-google-consent="false"{% endif %}
  defer>
</script>
<!-- Own CMP End -->
```

## Placement Strategy

Shopify loads many scripts automatically. By placing this snippet as the **very first item** after the `<head>` tag, you ensure that Own CMP has the best chance to set Google Consent Mode defaults before Shopify's internal analytics or Google tags begin to execute.

## Customer Privacy API Note

Shopify has its own "Customer Privacy" settings. When using Own CMP:
- You should usually disable Shopify's native "limit tracking" settings if they conflict with your regional rules.
- Own CMP will handle the Google Consent Mode signals directly, which most Shopify-integrated Google tags will respect.
- In Own CMP Admin, enable **Consent > Connect to Shopify Customer Privacy API** to pass explicit visitor choices to Shopify's `window.Shopify.customerPrivacy.setTrackingConsent`.
- Own CMP maps `analytics` to Shopify analytics consent, `marketing` to Shopify marketing consent, and `personalization` to Shopify preferences consent.
- Own CMP does not set Shopify `sale_of_data` from the normal cookie banner. Shopify treats data sale/sharing opt-out as a separate customer opt-out flow.

## Verification

1. Save your `theme.liquid` changes.
2. Open your store in a new tab.
3. Use the browser's **Inspector (F12)** > **Console**.
4. Type `window.OwnCMP.getConfig()` to verify the CMP is active and running with the correct configuration.
