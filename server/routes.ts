import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  updateSpendCapRequestSchema, 
  fetchAccountRequestSchema,
  inactiveAccountsRequestSchema,
  resetSpendCapRequestSchema,
  businessManagerRequestSchema,
  businessManagerAccountsRequestSchema,
  type ApiResponse,
  type FacebookAccount,
  type InactiveAccount,
  type BusinessManager
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Fetch Facebook ad account details
  app.post("/api/facebook/account", async (req, res) => {
    try {
      const { accessToken, adAccountId } = fetchAccountRequestSchema.parse(req.body);
      
      const url = `https://graph.facebook.com/${adAccountId}?fields=id,name,spend_cap&access_token=${accessToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to fetch account details"
        };
        return res.status(400).json(apiResponse);
      }
      
      const apiResponse: ApiResponse<FacebookAccount> = {
        success: true,
        data: {
          id: data.id,
          name: data.name,
          spend_cap: data.spend_cap
        },
        message: "Account details fetched successfully"
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Update Facebook ad account spend cap
  app.post("/api/facebook/update-spend-cap", async (req, res) => {
    try {
      const { accessToken, adAccountId, spendCap } = updateSpendCapRequestSchema.parse(req.body);
      
      // Debug logging
      console.log("Received spend cap update request:", { adAccountId, spendCap, type: typeof spendCap });
      
      const url = `https://graph.facebook.com/${adAccountId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          access_token: accessToken,
          spend_cap: spendCap.toString()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to update spend cap"
        };
        return res.status(400).json(apiResponse);
      }
      
      // Fetch updated account details
      const updatedUrl = `https://graph.facebook.com/${adAccountId}?fields=id,name,spend_cap&access_token=${accessToken}`;
      const updatedResponse = await fetch(updatedUrl);
      const updatedData = await updatedResponse.json();
      
      const apiResponse: ApiResponse<FacebookAccount> = {
        success: true,
        data: {
          id: updatedData.id,
          name: updatedData.name,
          spend_cap: updatedData.spend_cap
        },
        message: "Spend cap updated successfully"
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Fetch inactive accounts (no spending last month)
  app.post("/api/facebook/inactive-accounts", async (req, res) => {
    try {
      const { accessToken, page = 1, limit = 20 } = inactiveAccountsRequestSchema.parse(req.body);
      
      // Get all active ad accounts for the user (filter by account_status=1 at Facebook API level)
      const filtering = JSON.stringify([{"field":"account_status","operator":"EQUAL","value":"1"}]);
      const accountsUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(filtering)}&limit=1000&access_token=${accessToken}`;
      const accountsResponse = await fetch(accountsUrl);
      const accountsData = await accountsResponse.json();
      
      if (!accountsResponse.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: accountsData.error?.message || "Failed to fetch accounts"
        };
        return res.status(400).json(apiResponse);
      }

      // Get last month's date range
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const since = Math.floor(lastMonth.getTime() / 1000);
      const until = Math.floor(lastMonthEnd.getTime() / 1000);

      const allInactiveAccounts: InactiveAccount[] = [];

      // Filter accounts: spend_cap > 1 unit in their currency, excluding zero/null spend caps
      // (Active accounts already filtered at Facebook API level)
      const filteredAccounts = accountsData.data.filter((account: any) => {
        
        // Exclude accounts with zero or null spend_cap
        if (!account.spend_cap || account.spend_cap === '0' || account.spend_cap === null) {
          console.log(`[INACTIVE-ACCOUNTS] Filtering out account ${account.name} - zero/null spend_cap: ${account.spend_cap}`);
          return false;
        }
        
        // Parse spend cap and ensure it's above 1 unit in their currency
        const spendCapStr = String(account.spend_cap).trim();
        const spendCap = parseFloat(spendCapStr);
        
        // Strict filtering: exclude accounts with spend_cap = 1 or less
        if (isNaN(spendCap) || spendCap <= 1 || spendCapStr === '1' || spendCapStr === '1.0' || spendCapStr === '1.00') {
          console.log(`[INACTIVE-ACCOUNTS] Filtering out account ${account.name} - spend_cap not above 1: original="${account.spend_cap}" parsed=${spendCap} currency=${account.currency}`);
          return false;
        }
        
        console.log(`[INACTIVE-ACCOUNTS] Including account ${account.name} - spend_cap above 1: original="${account.spend_cap}" parsed=${spendCap} currency=${account.currency}`);
        
        return true;
      });

      // Check spending for each filtered account
      for (const account of filteredAccounts) {
        try {
          // Get insights for last month
          const insightsUrl = `https://graph.facebook.com/${account.id}/insights?fields=spend&time_range={'since':'${since}','until':'${until}'}&access_token=${accessToken}`;
          const insightsResponse = await fetch(insightsUrl);
          const insightsData = await insightsResponse.json();
          
          let lastMonthSpend = 0;
          if (insightsResponse.ok && insightsData.data && insightsData.data.length > 0) {
            lastMonthSpend = parseFloat(insightsData.data[0].spend || '0') * 100; // Convert to cents
          }

          // If no spending last month, add to inactive list
          if (lastMonthSpend === 0) {
            allInactiveAccounts.push({
              id: account.id,
              name: account.name,
              spend_cap: account.spend_cap,
              last_month_spend: lastMonthSpend,
              currency: account.currency || 'USD',
              account_status: account.account_status
            });
          }
        } catch (error) {
          console.warn(`Failed to get insights for account ${account.id}:`, error);
          // Include accounts where we can't get insights as potentially inactive
          allInactiveAccounts.push({
            id: account.id,
            name: account.name,
            spend_cap: account.spend_cap,
            last_month_spend: 0,
            currency: account.currency || 'USD',
            account_status: account.account_status
          });
        }
      }

      // Apply pagination
      const totalItems = allInactiveAccounts.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedAccounts = allInactiveAccounts.slice(startIndex, endIndex);

      const apiResponse: ApiResponse<InactiveAccount[]> = {
        success: true,
        data: paginatedAccounts,
        message: `Found ${totalItems} accounts with no spending last month`,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit
        }
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Set spend cap to $1
  app.post("/api/facebook/set-spend-cap-to-one", async (req, res) => {
    try {
      const { accessToken, adAccountId } = resetSpendCapRequestSchema.parse(req.body);
      
      const url = `https://graph.facebook.com/${adAccountId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          access_token: accessToken,
          spend_cap: '1' // Set spend cap to $1
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to reset spend cap"
        };
        return res.status(400).json(apiResponse);
      }
      
      // Fetch updated account details
      const updatedUrl = `https://graph.facebook.com/${adAccountId}?fields=id,name,spend_cap&access_token=${accessToken}`;
      const updatedResponse = await fetch(updatedUrl);
      const updatedData = await updatedResponse.json();
      
      const apiResponse: ApiResponse<FacebookAccount> = {
        success: true,
        data: {
          id: updatedData.id,
          name: updatedData.name,
          spend_cap: updatedData.spend_cap
        },
        message: "Spend cap set to $1 successfully"
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Fetch Business Managers that user has access to
  app.post("/api/facebook/business-managers", async (req, res) => {
    try {
      const { accessToken } = businessManagerRequestSchema.parse(req.body);
      
      const url = `https://graph.facebook.com/me/businesses?fields=id,name&access_token=${accessToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to fetch business managers"
        };
        return res.status(400).json(apiResponse);
      }
      
      const businessManagers: BusinessManager[] = data.data?.map((bm: any) => ({
        id: bm.id,
        name: bm.name
      })) || [];
      
      const apiResponse: ApiResponse<BusinessManager[]> = {
        success: true,
        data: businessManagers,
        message: "Business managers fetched successfully"
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Fetch ad accounts for a specific Business Manager with pagination and spending data  
  app.post("/api/facebook/business-manager-accounts", async (req, res) => {
    try {
      const { accessToken, businessId, page, limit } = businessManagerAccountsRequestSchema.parse(req.body);
      
      const offset = (page - 1) * limit;
      // Filter by active accounts (account_status=1) at Facebook API level
      const filtering = JSON.stringify([{"field":"account_status","operator":"EQUAL","value":"1"}]);
      const url = `https://graph.facebook.com/${businessId}/owned_ad_accounts?fields=id,name,spend_cap,currency,account_status&filtering=${encodeURIComponent(filtering)}&limit=${limit}&offset=${offset}&access_token=${accessToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to fetch business manager accounts"
        };
        return res.status(400).json(apiResponse);
      }
      
      const accounts = data.data || [];
      
      // Filter accounts: spend_cap > 1 unit in their currency, excluding zero/null spend caps
      // (Active accounts already filtered at Facebook API level)
      const filteredAccounts = accounts.filter((account: any) => {
        
        // Exclude accounts with zero or null spend_cap
        if (!account.spend_cap || account.spend_cap === '0' || account.spend_cap === null) {
          console.log(`[BM-ACCOUNTS] Filtering out account ${account.name} - zero/null spend_cap: ${account.spend_cap}`);
          return false;
        }
        
        // Parse spend cap and ensure it's above 1 unit in their currency
        const spendCapStr = String(account.spend_cap).trim();
        const spendCap = parseFloat(spendCapStr);
        
        // Strict filtering: exclude accounts with spend_cap = 1 or less  
        if (isNaN(spendCap) || spendCap <= 1 || spendCapStr === '1' || spendCapStr === '1.0' || spendCapStr === '1.00') {
          console.log(`[BM-ACCOUNTS] Filtering out account ${account.name} - spend_cap not above 1: original="${account.spend_cap}" parsed=${spendCap} currency=${account.currency}`);
          return false;
        }
        
        console.log(`[BM-ACCOUNTS] Including account ${account.name} - spend_cap above 1: original="${account.spend_cap}" parsed=${spendCap} currency=${account.currency}`);
        
        return true;
      });
      
      // Get last month's date range
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = lastMonth.toISOString().split('T')[0];
      const lastMonthEnd = new Date(thisMonth.getTime() - 1).toISOString().split('T')[0];
      
      // Enrich filtered accounts with spending data
      const enrichedAccounts = [];
      for (const account of filteredAccounts) {
        try {
          // Get insights for last month
          const insightsUrl = `https://graph.facebook.com/${account.id}/insights?fields=spend&time_range={"since":"${lastMonthStart}","until":"${lastMonthEnd}"}&access_token=${accessToken}`;
          const insightsResponse = await fetch(insightsUrl);
          const insightsData = await insightsResponse.json();
          
          let lastMonthSpend = 0;
          if (insightsData.data && insightsData.data.length > 0) {
            lastMonthSpend = parseFloat(insightsData.data[0].spend || '0');
          }
          
          enrichedAccounts.push({
            id: account.id,
            name: account.name,
            spend_cap: account.spend_cap,
            last_month_spend: lastMonthSpend,
            currency: account.currency || 'USD',
            account_status: account.account_status
          });
        } catch (error) {
          console.warn(`Failed to get insights for account ${account.id}:`, error);
          // Include accounts where we can't get insights with 0 spend
          enrichedAccounts.push({
            id: account.id,
            name: account.name,
            spend_cap: account.spend_cap,
            last_month_spend: 0,
            currency: account.currency || 'USD',
            account_status: account.account_status
          });
        }
      }
      
      // Update pagination to reflect filtered results
      const totalItems = enrichedAccounts.length;
      const totalPages = Math.ceil(totalItems / limit);
      
      const apiResponse: ApiResponse<any[]> = {
        success: true,
        data: enrichedAccounts,
        message: "Business manager accounts fetched successfully with spending data",
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit
        }
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Test endpoint for filtering capabilities
  app.post("/test-filtering", async (req, res) => {
    try {
      const { accessToken } = req.body;
      
      if (!accessToken || typeof accessToken !== 'string') {
        return res.status(400).json({ error: "Valid access token required" });
      }
      
      // Sanitize token for logging (don't expose full token in logs)
      const tokenPreview = accessToken.substring(0, 10) + "...";
      
      console.log(`=== Testing Facebook Graph API Filtering Capabilities ===`);
      console.log(`Using token: ${tokenPreview}\n`);
      
      const results: any[] = [];
      
      // Test 1: Current working filter (account_status only)
      console.log("🧪 Test 1: Current working filter (account_status only)");
      const basicFilter = JSON.stringify([
        {"field":"account_status","operator":"EQUAL","value":"1"}
      ]);
      const basicUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&filtering=${encodeURIComponent(basicFilter)}&limit=3&access_token=${accessToken}`;
      
      try {
        const basicResponse = await fetch(basicUrl);
        const basicText = await basicResponse.text();
        
        let basicData;
        try {
          basicData = JSON.parse(basicText);
        } catch (parseError) {
          console.log("Failed to parse JSON response:", basicText.substring(0, 200));
          basicData = { error: { message: "Invalid JSON response from Facebook API" } };
        }
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
        const spendCapText = await spendCapResponse.text();
        
        let spendCapData;
        try {
          spendCapData = JSON.parse(spendCapText);
        } catch (parseError) {
          console.log("Failed to parse spend cap JSON response:", spendCapText.substring(0, 200));
          spendCapData = { error: { message: "Invalid JSON response from Facebook API" } };
        }
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
          const operatorText = await operatorResponse.text();
          
          let operatorData;
          try {
            operatorData = JSON.parse(operatorText);
          } catch (parseError) {
            console.log(`Failed to parse ${operator} JSON response:`, operatorText.substring(0, 200));
            operatorData = { error: { message: "Invalid JSON response from Facebook API" } };
          }
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

  const httpServer = createServer(app);
  return httpServer;
}
