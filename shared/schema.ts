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

export type FacebookAccount = z.infer<typeof facebookAccountSchema>;
export type UpdateSpendCapRequest = z.infer<typeof updateSpendCapRequestSchema>;
export type FetchAccountRequest = z.infer<typeof fetchAccountRequestSchema>;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
