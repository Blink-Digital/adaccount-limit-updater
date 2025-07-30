import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  updateSpendCapRequestSchema, 
  fetchAccountRequestSchema,
  type FacebookAccount,
  type ApiResponse 
} from "@shared/schema";
import { 
  Key, 
  Info, 
  Edit, 
  Code, 
  Download, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Copy,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { FaFacebookF } from "react-icons/fa";

export default function Home() {
  const [showToken, setShowToken] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<FacebookAccount | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Form for fetching account details
  const fetchForm = useForm({
    resolver: zodResolver(fetchAccountRequestSchema),
    defaultValues: {
      accessToken: "",
      adAccountId: "act_1003491274360037"
    }
  });

  // Form for updating spend cap
  const updateForm = useForm({
    resolver: zodResolver(updateSpendCapRequestSchema),
    defaultValues: {
      accessToken: "",
      adAccountId: "act_1003491274360037",
      spendCap: 0.00
    }
  });

  // Fetch account mutation
  const fetchAccountMutation = useMutation({
    mutationFn: async (data: { accessToken: string; adAccountId: string }) => {
      const response = await apiRequest("POST", "/api/facebook/account", data);
      return response.json();
    },
    onSuccess: (response: ApiResponse<FacebookAccount>) => {
      if (response.success && response.data) {
        setCurrentAccount(response.data);
        setError(null);
        // Sync token to update form
        updateForm.setValue("accessToken", fetchForm.getValues("accessToken"));
        updateForm.setValue("adAccountId", fetchForm.getValues("adAccountId"));
        toast({
          title: "Success",
          description: "Account details fetched successfully"
        });
      } else {
        setError(response.error || "Failed to fetch account details");
      }
    },
    onError: (error: any) => {
      setError(error.message || "Failed to fetch account details");
    }
  });

  // Update spend cap mutation
  const updateSpendCapMutation = useMutation({
    mutationFn: async (data: { accessToken: string; adAccountId: string; spendCap: number }) => {
      const response = await apiRequest("POST", "/api/facebook/update-spend-cap", data);
      return response.json();
    },
    onSuccess: (response: ApiResponse<FacebookAccount>) => {
      if (response.success && response.data) {
        setCurrentAccount(response.data);
        setLastResponse(response);
        setError(null);
        toast({
          title: "Success",
          description: "Spend cap updated successfully"
        });
      } else {
        setError(response.error || "Failed to update spend cap");
      }
    },
    onError: (error: any) => {
      setError(error.message || "Failed to update spend cap");
    }
  });

  const onFetchAccount = (data: { accessToken: string; adAccountId: string }) => {
    setError(null);
    fetchAccountMutation.mutate(data);
  };

  const onUpdateSpendCap = (data: { accessToken: string; adAccountId: string; spendCap: number }) => {
    setError(null);
    console.log("Submitting spend cap update:", data);
    updateSpendCapMutation.mutate(data);
  };

  const copyToClipboard = () => {
    if (lastResponse) {
      navigator.clipboard.writeText(JSON.stringify(lastResponse, null, 2));
      toast({
        title: "Copied",
        description: "Response copied to clipboard"
      });
    }
  };

  const dismissError = () => {
    setError(null);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "No limit";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount / 100); // Facebook returns amounts in cents but API expects dollars for updates
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FaFacebookF className="text-white text-sm" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Facebook Ads Spend Cap Manager</h1>
              <p className="text-sm text-gray-600">Manage ad account spend caps using Facebook Graph API</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
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
              <Form {...fetchForm}>
                <form onSubmit={fetchForm.handleSubmit(onFetchAccount)} className="space-y-4">
                  <FormField
                    control={fetchForm.control}
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
                          Required permissions: ads_read, ads_management, business_management
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={fetchForm.control}
                    name="adAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Ad Account ID <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="act_1003491274360037" />
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Enter the ad account ID (including 'act_' prefix)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={fetchAccountMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {fetchAccountMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Fetch Account Details
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Current Account Information */}
          {currentAccount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="h-5 w-5 text-emerald-600" />
                  <span>Current Account Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Account ID:</span>
                    <span className="font-mono text-sm text-gray-900">{currentAccount.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Account Name:</span>
                    <span className="text-sm text-gray-900">{currentAccount.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Current Spend Cap:</span>
                    <span className="text-sm text-gray-900 font-medium">
                      {formatCurrency(currentAccount.spend_cap)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Update Spend Cap Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit className="h-5 w-5 text-amber-600" />
                <span>Update Spend Cap</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...updateForm}>
                <form onSubmit={updateForm.handleSubmit(onUpdateSpendCap)} className="space-y-4">
                  <FormField
                    control={updateForm.control}
                    name="spendCap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          New Spend Cap (USD) <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">$</span>
                            </div>
                            <Input
                              {...field}
                              type="number"
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="pl-8"
                              onChange={(e) => {
                                const dollarValue = parseFloat(e.target.value) || 0;
                                console.log("Input change:", { inputValue: e.target.value, dollarValue });
                                field.onChange(dollarValue); // Store as dollars since API expects dollars
                              }}
                              value={field.value ? field.value.toString() : ""}
                            />
                          </div>
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Enter the new spend cap amount in USD (e.g., 1000.00)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={updateSpendCapMutation.isPending || !currentAccount}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updateSpendCapMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Update Spend Cap
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* API Response Section */}
          {lastResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5 text-purple-600" />
                  <span>API Response</span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Success
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono">
                    <code>{JSON.stringify(lastResponse, null, 2)}</code>
                  </pre>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Response received at {new Date().toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {(fetchAccountMutation.isPending || updateSpendCapMutation.isPending) && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center space-x-3">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">Processing API request...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800">API Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={dismissError}
                        className="text-red-800 hover:text-red-900 text-xs underline p-0 h-auto"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-gray-500">
          <p>Facebook Graph API Integration • Requires valid access token with appropriate permissions</p>
        </footer>
      </main>
    </div>
  );
}
