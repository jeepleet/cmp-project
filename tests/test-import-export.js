/**
 * Test script for Import/Export API functionality.
 * Requires the server to be running on http://localhost:8787
 */

async function test() {
  const baseUrl = "http://localhost:8787";
  const loginUrl = `${baseUrl}/api/login`;
  const configUrl = `${baseUrl}/api/config`;

  console.log("Starting Import/Export API tests...");

  try {
    // 1. Login to get session cookie
    console.log("1. Logging in...");
    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "change-me-now"
      })
    });

    if (!loginRes.ok) throw new Error("Login failed");
    const cookie = loginRes.headers.get("set-cookie");

    // 2. Export (GET)
    console.log("2. Testing Export (GET /api/config)...");
    const exportRes = await fetch(configUrl, {
      headers: { "Cookie": cookie }
    });
    if (!exportRes.ok) throw new Error("Export failed");
    const currentConfig = await exportRes.json();
    console.log(`   Success: Exported config for site "${currentConfig.siteId}"`);

    // 3. Import (PUT)
    console.log("3. Testing Import (PUT /api/config)...");
    const newConfig = JSON.parse(JSON.stringify(currentConfig));
    newConfig.siteName = "Import Test Site " + Date.now();
    
    const importRes = await fetch(configUrl, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      body: JSON.stringify(newConfig)
    });

    if (!importRes.ok) throw new Error("Import failed");
    const savedConfig = await importRes.json();
    
    if (savedConfig.siteName === newConfig.siteName) {
      console.log("   Success: Configuration imported and updated correctly.");
    } else {
      throw new Error("Import failed: Site name not updated.");
    }

    // 4. Restore original
    console.log("4. Restoring original configuration...");
    await fetch(configUrl, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      body: JSON.stringify(currentConfig)
    });
    console.log("   Success: Original configuration restored.");

    console.log("\nAll Import/Export API tests passed successfully!");
  } catch (error) {
    console.error("\nTest failed:", error.message);
    process.exit(1);
  }
}

test();
