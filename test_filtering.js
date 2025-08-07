// Test script to check Facebook Graph API filtering capabilities
// This will help us understand what fields are actually filterable

const testFilteringCapabilities = async () => {
  const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"; // Replace with actual token
  
  console.log("=== Testing Facebook Graph API Filtering Capabilities ===\n");
  
  // Test 1: Current working filter (account_status only)
  console.log("🧪 Test 1: Current working filter (account_status only)");
  const basicFilter = JSON.stringify([
    {"field":"account_status","operator":"EQUAL","value":"1"}
  ]);
  const basicUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(basicFilter)}&limit=5&access_token=${ACCESS_TOKEN}`;
  console.log("URL:", basicUrl);
  console.log("");
  
  // Test 2: Adding spend_cap filter
  console.log("🧪 Test 2: Adding spend_cap filter");
  const spendCapFilter = JSON.stringify([
    {"field":"account_status","operator":"EQUAL","value":"1"},
    {"field":"spend_cap","operator":"GREATER_THAN","value":"1"}
  ]);
  const spendCapUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(spendCapFilter)}&limit=5&access_token=${ACCESS_TOKEN}`;
  console.log("URL:", spendCapUrl);
  console.log("");
  
  // Test 3: Alternative spend_cap field names
  console.log("🧪 Test 3: Testing alternative field names");
  const altFilters = [
    {"field":"spend_cap","operator":"GREATER_THAN","value":"1"},
    {"field":"spending_cap","operator":"GREATER_THAN","value":"1"},
    {"field":"account_spending_limit","operator":"GREATER_THAN","value":"1"}
  ];
  
  altFilters.forEach((filter, index) => {
    const testFilter = JSON.stringify([
      {"field":"account_status","operator":"EQUAL","value":"1"},
      filter
    ]);
    const url = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(testFilter)}&limit=5&access_token=${ACCESS_TOKEN}`;
    console.log(`Test 3.${index + 1} (${filter.field}):`, url);
  });
  console.log("");
  
  // Test 4: Business Manager endpoint
  console.log("🧪 Test 4: Business Manager endpoint with spend_cap filter");
  const bmFilter = JSON.stringify([
    {"field":"account_status","operator":"EQUAL","value":"1"},
    {"field":"spend_cap","operator":"GREATER_THAN","value":"1"}
  ]);
  const bmUrl = `https://graph.facebook.com/BUSINESS_ID/owned_ad_accounts?fields=id,name,spend_cap,currency,account_status&filtering=${encodeURIComponent(bmFilter)}&limit=5&access_token=${ACCESS_TOKEN}`;
  console.log("URL:", bmUrl);
  console.log("");
  
  console.log("=== Instructions ===");
  console.log("1. Replace YOUR_ACCESS_TOKEN_HERE with real Facebook access token");
  console.log("2. Replace BUSINESS_ID with actual business manager ID for Test 4");
  console.log("3. Run each test URL in browser or curl to see results");
  console.log("4. Look for error responses that indicate unsupported filters");
  console.log("");
  
  console.log("=== Expected Outcomes ===");
  console.log("✅ Success: Returns filtered accounts (spend_cap filtering works!)");
  console.log("❌ Error: Returns error message (field not filterable)");
  console.log("⚠️  Ignored: Returns all accounts (filter silently ignored)");
};

testFilteringCapabilities();