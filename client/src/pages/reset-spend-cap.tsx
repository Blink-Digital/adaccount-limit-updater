import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "../components/ui/form";
import { 
  fetchAccountRequestSchema,
  type FacebookAccount,
  type ApiResponse 
} from "@shared/schema";
import { 
  Key, 
  RefreshCw, 
  AlertTriangle,
  Loader2,
  DollarSign,
  Calendar,
  Eye,
  EyeOff
} from "lucide-react";
import { FaFacebookF } from "react-icons/fa";
import { FacebookLoginButton } from "../components/FacebookLoginButton";
import { Link } from "wouter";

interface InactiveAccount {
  id: string;
  name: string;
  spend_cap: number | null;
  last_month_spend: number;
  currency: string;
  account_status: string;
}

export default function ResetSpendCap() {
  const [showToken, setShowToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const { toast } = useToast();

  // Form for fetching inactive accounts
  const form = useForm({
    resolver: zodResolver(fetchAccountRequestSchema.omit({ adAccountId: true })),
    defaultValues: {
      accessToken: ""
    }
  });

  // Query to fetch inactive accounts
  const { data: inactiveAccounts, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/facebook/inactive-accounts', accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      const response = await apiRequest("POST", "/api/facebook/inactive-accounts", { accessToken });
      return response.json();
    },
    enabled: !!accessToken
  });

  // Mutation to set spend cap to $1 for an account
  const resetSpendCapMutation = useMutation({
    mutationFn: async ({ accountId }: { accountId: string }) => {
      const response = await apiRequest("POST", "/api/facebook/set-spend-cap-to-one", {
        accessToken,
        adAccountId: accountId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Spend cap set to $1 successfully"
      });
      refetch(); // Refresh the list
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set spend cap to $1",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: { accessToken: string }) => {
    setAccessToken(data.accessToken);
  };

  const handleResetSpendCap = (accountId: string) => {
    resetSpendCapMutation.mutate({ accountId });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount / 100); // Facebook returns amounts in cents
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <RefreshCw className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Reset Spend Caps</h1>
                <p className="text-sm text-gray-600">Set spend caps to $1 for accounts with no spending last month</p>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/" className="text-gray-600 hover:text-blue-600">Manage Caps</Link>
              <Link href="/reset-spend-cap" className="text-red-600 font-medium">Reset Caps</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* API Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-blue-600" />
                <span>API Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="accessToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Facebook Access Token <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showToken ? "text" : "password"}
                              placeholder="EAAYourAccessTokenHere..."
                              className="pr-12 font-mono text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                              onClick={() => setShowToken(!showToken)}
                            >
                              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Required permissions: ads_read, ads_management
                        </p>
                        <FacebookLoginButton 
                          onTokenReceived={(token: string) => {
                            form.setValue("accessToken", token);
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Find Inactive Accounts
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Results Section */}
          {accessToken && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    <span>Accounts with No Spending Last Month</span>
                  </div>
                  {inactiveAccounts?.data && (
                    <Badge variant="secondary">
                      {inactiveAccounts.data.length} accounts found
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-600 mt-2">Analyzing ad accounts...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-1" />
                      <div>
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <p className="text-sm text-red-700 mt-1">{error.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {inactiveAccounts?.success && inactiveAccounts.data && (
                  <div className="space-y-4">
                    {inactiveAccounts.data.length === 0 ? (
                      <div className="text-center py-8">
                        <DollarSign className="h-12 w-12 text-green-500 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">All Accounts Active</h3>
                        <p className="text-gray-600">All your ad accounts had spending activity last month.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {inactiveAccounts.data.map((account: InactiveAccount) => (
                          <div
                            key={account.id}
                            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <FaFacebookF className="text-gray-600 text-sm" />
                                  </div>
                                  <div>
                                    <h3 className="font-medium text-gray-900">{account.name}</h3>
                                    <p className="text-sm text-gray-500">{account.id}</p>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Current Spend Cap:</span>
                                    <div className="font-medium">
                                      {account.spend_cap ? 
                                        formatCurrency(account.spend_cap, account.currency) : 
                                        "No limit"
                                      }
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Last Month Spend:</span>
                                    <div className="font-medium">
                                      {formatCurrency(account.last_month_spend, account.currency)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Status:</span>
                                    <div className="font-medium">
                                      <Badge 
                                        variant={account.account_status === 'ACTIVE' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {account.account_status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <Button
                                  onClick={() => handleResetSpendCap(account.id)}
                                  disabled={resetSpendCapMutation.isPending}
                                  variant="outline"
                                  className="border-green-300 text-green-600 hover:bg-green-50"
                                >
                                  {resetSpendCapMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Set to $1"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}