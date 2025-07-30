import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  updateSpendCapRequestSchema, 
  fetchAccountRequestSchema,
  type ApiResponse,
  type FacebookAccount 
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
      console.log("Received spend cap update request:", { adAccountId, spendCap });
      
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

  const httpServer = createServer(app);
  return httpServer;
}
