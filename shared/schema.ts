import { z } from "zod";

// Facebook Graph API response types
export const facebookAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  spend_cap: z.number().nullable(),
});

export const updateSpendCapRequestSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  adAccountId: z.string().min(1, "Ad account ID is required"),
  spendCap: z.number().min(0, "Spend cap must be a positive number"),
});

export const fetchAccountRequestSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  adAccountId: z.string().min(1, "Ad account ID is required"),
});

export const inactiveAccountsRequestSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

export const resetSpendCapRequestSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  adAccountId: z.string().min(1, "Ad account ID is required"),
});

export const inactiveAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  spend_cap: z.number().nullable(),
  last_month_spend: z.number(),
  currency: z.string(),
  account_status: z.string(),
});

export type FacebookAccount = z.infer<typeof facebookAccountSchema>;
export type UpdateSpendCapRequest = z.infer<typeof updateSpendCapRequestSchema>;
export type FetchAccountRequest = z.infer<typeof fetchAccountRequestSchema>;
export type InactiveAccountsRequest = z.infer<typeof inactiveAccountsRequestSchema>;
export type ResetSpendCapRequest = z.infer<typeof resetSpendCapRequestSchema>;
export type InactiveAccount = z.infer<typeof inactiveAccountSchema>;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
