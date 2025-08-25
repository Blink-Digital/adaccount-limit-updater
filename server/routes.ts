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
          spend_cap: updatedData.spend_cap,
          currency: updatedData.currency || 'USD'
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

  // Get Business Manager accounts with pagination and optional spend data
  app.post("/api/facebook/business-manager-accounts", async (req, res) => {
    try {
      const { accessToken, businessId, limit = 10, after, before, includeSpend = false, search } = businessManagerAccountsRequestSchema.parse(req.body);
      
      console.log(`[BM-ACCOUNTS] ${after ? `Using cursor pagination with after: ${after.substring(0, 20)}...` : 'Fetching first page (no cursor)'}`);
      if (includeSpend) {
        console.log(`[BM-ACCOUNTS] Including last month spend data`);
      }
      if (search) {
        console.log(`[BM-ACCOUNTS] Server-side search query: "${search}"`);
      }
      
      // Build URL with cursor-based pagination
      let url = `https://graph.facebook.com/v21.0/${businessId}/owned_ad_accounts?fields=id,name,spend_cap,currency,account_status&filtering=[{"field":"account_status","operator":"EQUAL","value":"1"}]&limit=${limit}&access_token=${accessToken}`;
      
      if (after) {
        url += `&after=${after}`;
      } else if (before) {
        url += `&before=${before}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to fetch Business Manager accounts"
        };
        return res.status(400).json(apiResponse);
      }
      
      console.log(`[BM-ACCOUNTS] Retrieved ${data.data?.length || 0} active accounts from Facebook API`);
      console.log(`[BM-ACCOUNTS] Facebook paging info:`, JSON.stringify(data.paging || {}));
      
      // Debug: Log first few account names for search debugging
      if (search && data.data?.length > 0) {
        console.log(`[BM-ACCOUNTS-DEBUG] First 5 account names:`, data.data.slice(0, 5).map((acc: any) => `"${acc.name}"`));
      }
      
      let accounts: InactiveAccount[] = (data.data || []).map((account: any) => ({
        id: account.id,
        name: account.name,
        spend_cap: account.spend_cap,
        last_month_spend: 0, // Default value
        currency: account.currency || 'USD',
        account_status: account.account_status?.toString() || '1'
      }));

      // Apply server-side search filtering if search query is provided
      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        const originalCount = accounts.length;
        
        // Debug: Log all account names before filtering
        console.log(`[BM-ACCOUNTS-DEBUG] All account names before search:`, accounts.map(acc => `"${acc.name}" (ID: ${acc.id})`));
        
        accounts = accounts.filter((account: InactiveAccount) => {
          // Search by account name
          const nameMatch = account.name.toLowerCase().includes(searchLower);
          
          // Search by account ID (handle both with and without "act_" prefix)
          const idMatch = account.id.toLowerCase().includes(searchLower);
          const idWithoutPrefix = account.id.replace('act_', '').toLowerCase();
          const idPrefixMatch = idWithoutPrefix.includes(searchLower);
          
          const matches = nameMatch || idMatch || idPrefixMatch;
          
          // Debug: Log each account's match result
          if (account.name.toLowerCase().includes('kongz')) {
            console.log(`[BM-ACCOUNTS-DEBUG] Kongz account found: "${account.name}" (ID: ${account.id}), nameMatch: ${nameMatch}, idMatch: ${idMatch}, matches: ${matches}`);
          }
          
          return matches;
        });
        
        console.log(`[BM-ACCOUNTS] Search filtered: ${accounts.length} of ${originalCount} accounts match "${search}"`);
      }
      
      // Note: Business Manager insights endpoint doesn't exist
      // Individual account spend data will be fetched from frontend
      if (includeSpend && accounts.length > 0) {
        console.log(`[BM-ACCOUNTS] Fetching spend data for ${accounts.length} accounts...`);
        
        console.log('[BM-ACCOUNTS] Skipping spend data - will be loaded individually from frontend');
      }
      
      const apiResponse: ApiResponse<InactiveAccount[]> = {
        success: true,
        data: accounts,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: accounts.length,
          itemsPerPage: limit,
          hasNextPage: !!data.paging?.next,
          hasPreviousPage: !!data.paging?.previous,
          nextCursor: data.paging?.cursors?.after || null,
          previousCursor: data.paging?.cursors?.before || null
        }
      };
      
      res.json(apiResponse);
    } catch (error: any) {
      console.error("[BM-ACCOUNTS] Error:", error);
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message || "Internal server error"
      };
      res.status(500).json(apiResponse);
    }
  });

  // Fetch individual ad account spend data
  app.post("/api/facebook/account-spend", async (req, res) => {
    try {
      const { accessToken, accountId, datePreset = 'last_month' } = req.body;
      
      if (!accessToken || !accountId) {
        return res.status(400).json({
          success: false,
          error: "Missing accessToken or accountId"
        });
      }
      
      // Add 'act_' prefix if not present
      const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
      
      const url = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?fields=spend&date_preset=${datePreset}&access_token=${accessToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const apiResponse: ApiResponse = {
          success: false,
          error: data.error?.message || "Failed to fetch account spend"
        };
        return res.status(400).json(apiResponse);
      }
      
      // Extract spend value from response
      const spend = data.data?.[0]?.spend ? parseFloat(data.data[0].spend) : 0;
      
      const apiResponse: ApiResponse<{ spend: number }> = {
        success: true,
        data: { spend },
        message: "Account spend fetched successfully"
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

  const httpServer = createServer(app);
  return httpServer;
}
