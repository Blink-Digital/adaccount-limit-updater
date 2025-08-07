// Test filtering capabilities by making actual API calls
import express from 'express';

const app = express();

// Test endpoint to check Facebook Graph API filtering capabilities
app.post("/test-filtering", async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: "Access token required" });
    }
    
    console.log("=== Testing Facebook Graph API Filtering Capabilities ===\n");
    
    const results: any[] = [];
    
    // Test 1: Current working filter (account_status only)
    console.log("🧪 Test 1: Current working filter (account_status only)");
    const basicFilter = JSON.stringify([
      {"field":"account_status","operator":"EQUAL","value":"1"}
    ]);
    const basicUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(basicFilter)}&limit=3&access_token=${accessToken}`;
    
    try {
      const basicResponse = await fetch(basicUrl);
      const basicData = await basicResponse.json();
      results.push({
        test: "Basic Filter (account_status only)",
        success: basicResponse.ok,
        status: basicResponse.status,
        accountCount: basicData.data?.length || 0,
        error: basicData.error?.message || null,
        sampleData: basicData.data?.slice(0, 1) || []
      });
      console.log(`✅ Basic filter: ${basicResponse.ok ? 'SUCCESS' : 'FAILED'} - ${basicData.data?.length || 0} accounts`);
    } catch (error: any) {
      results.push({
        test: "Basic Filter (account_status only)",
        success: false,
        error: error.message
      });
      console.log(`❌ Basic filter: FAILED - ${error.message}`);
    }
    
    // Test 2: Adding spend_cap filter
    console.log("🧪 Test 2: Adding spend_cap filter");
    const spendCapFilter = JSON.stringify([
      {"field":"account_status","operator":"EQUAL","value":"1"},
      {"field":"spend_cap","operator":"GREATER_THAN","value":"1"}
    ]);
    const spendCapUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(spendCapFilter)}&limit=3&access_token=${accessToken}`;
    
    try {
      const spendCapResponse = await fetch(spendCapUrl);
      const spendCapData = await spendCapResponse.json();
      results.push({
        test: "Spend Cap Filter",
        success: spendCapResponse.ok,
        status: spendCapResponse.status,
        accountCount: spendCapData.data?.length || 0,
        error: spendCapData.error?.message || null,
        sampleData: spendCapData.data?.slice(0, 1) || []
      });
      console.log(`🎯 Spend cap filter: ${spendCapResponse.ok ? 'SUCCESS' : 'FAILED'} - ${spendCapData.data?.length || 0} accounts`);
      if (spendCapData.error) {
        console.log(`   Error: ${spendCapData.error.message}`);
      }
    } catch (error: any) {
      results.push({
        test: "Spend Cap Filter",
        success: false,
        error: error.message
      });
      console.log(`❌ Spend cap filter: FAILED - ${error.message}`);
    }
    
    // Test 3: Alternative operators
    console.log("🧪 Test 3: Testing different operators");
    const operators = ["GREATER_THAN", "NOT_EQUAL", "IN"];
    
    for (const operator of operators) {
      const value = operator === "IN" ? ["2", "3", "4", "5"] : "1";
      const operatorFilter = JSON.stringify([
        {"field":"account_status","operator":"EQUAL","value":"1"},
        {"field":"spend_cap","operator":operator,"value":value}
      ]);
      const operatorUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(operatorFilter)}&limit=2&access_token=${accessToken}`;
      
      try {
        const operatorResponse = await fetch(operatorUrl);
        const operatorData = await operatorResponse.json();
        results.push({
          test: `Spend Cap ${operator}`,
          success: operatorResponse.ok,
          status: operatorResponse.status,
          accountCount: operatorData.data?.length || 0,
          error: operatorData.error?.message || null
        });
        console.log(`   ${operator}: ${operatorResponse.ok ? 'SUCCESS' : 'FAILED'} - ${operatorData.data?.length || 0} accounts`);
      } catch (error: any) {
        console.log(`   ${operator}: FAILED - ${error.message}`);
      }
    }
    
    console.log("\n=== Test Results Summary ===");
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.test}: ${result.success ? 'WORKS' : 'FAILED'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    res.json({
      success: true,
      message: "Filtering capability test completed",
      results: results,
      conclusion: results.find(r => r.test === "Spend Cap Filter")?.success ? 
        "🎉 spend_cap filtering IS supported by Facebook Graph API!" :
        "😞 spend_cap filtering is NOT supported by Facebook Graph API"
    });
    
  } catch (error: any) {
    console.error("Test error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default app;