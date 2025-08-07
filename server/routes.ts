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
      
      // Get all ad accounts for the user
      const accountsUrl = `https://graph.facebook.com/me/adaccounts?fields=id,name,spend_cap,account_status,currency&access_token=${accessToken}`;
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

      // Filter accounts: only active accounts with spend_cap > $1
      const filteredAccounts = accountsData.data.filter((account: any) => {
        // Only active accounts (account_status = 1)
        if (account.account_status !== 1) return false;
        
        // Only accounts with spend_cap > $1
        const spendCap = parseFloat(account.spend_cap || '0');
        if (spendCap <= 1) return false;
        
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
      const url = `https://graph.facebook.com/${businessId}/owned_ad_accounts?fields=id,name,spend_cap,currency,account_status&limit=${limit}&offset=${offset}&access_token=${accessToken}`;
      
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
      
      // Filter accounts: only active accounts with spend_cap > $1
      const filteredAccounts = accounts.filter((account: any) => {
        // Only active accounts (account_status = 1)
        if (account.account_status !== 1) return false;
        
        // Only accounts with spend_cap > $1
        const spendCap = parseFloat(account.spend_cap || '0');
        if (spendCap <= 1) return false;
        
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

  const httpServer = createServer(app);
  return httpServer;
}
