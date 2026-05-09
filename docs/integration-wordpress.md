# WordPress Integration Guide

To integrate Own CMP into a WordPress site, you can use a lightweight PHP snippet in your theme's `functions.php` file. This method avoids the need for a heavy plugin and ensures the script loads early enough for Google Consent Mode.

## Implementation

Add the following code to the end of your theme's `functions.php` file (or use a plugin like "Code Snippets"):

```php
/**
 * Inject Own CMP into the site head.
 */
function inject_own_cmp() {
    // Configuration - Replace with your actual domain and Site ID
    $cmp_domain = 'https://your-cmp-instance.com';
    $site_id = 'demo-site';
    $environment = 'production'; // or 'preview' for testing
    
    // Check if we are in GTM mode (set to true if using the GTM bridge)
    $gtm_mode = false; 
    $google_consent_attr = $gtm_mode ? 'data-google-consent="false"' : '';

    echo "\n<!-- Own CMP Start -->\n";
    echo sprintf(
        '<script src="%s/cmp/owncmp.js" data-site-id="%s" data-config-url="%s/api/public/config/%s/%s" %s defer></script>',
        esc_url($cmp_domain),
        esc_attr($site_id),
        esc_url($cmp_domain),
        esc_attr($site_id),
        esc_attr($environment),
        $google_consent_attr
    );
    echo "\n<!-- Own CMP End -->\n";
}
add_action('wp_head', 'inject_own_cmp', 1);
```

## Why Hook into `wp_head` with priority 1?

Google Consent Mode works best when the defaults are set as early as possible. By using `add_action('wp_head', ..., 1)`, we ensure the CMP script tag is one of the very first things in the HTML `<head>`, allowing it to set Consent Mode signals before other tags (like GTM or GA4) start firing.

## Verification

After adding the snippet:
1. View your site's source code (Ctrl+U) and confirm the `<script id="owncmp-script">` tag appears inside the `<head>`.
2. Open the browser console and type `window.OwnCMP`. If it returns an object, the script is loaded.
3. Check the `dataLayer` for the `consent` 'default' events.
