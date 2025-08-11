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
import { Label } from "../components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  businessManagerRequestSchema,
  businessManagerAccountsRequestSchema,
  type FacebookAccount,
  type ApiResponse,
  type BusinessManager
} from "@shared/schema";
import { 
  Key, 
  RefreshCw, 
  AlertTriangle,
  Loader2,
  DollarSign,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2
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
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);
  const [processedAccounts, setProcessedAccounts] = useState<Set<string>>(new Set());
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const accountsPerPage = 20;
  const { toast } = useToast();

  // Form for fetching inactive accounts
  const form = useForm({
    resolver: zodResolver(fetchAccountRequestSchema.omit({ adAccountId: true })),
    defaultValues: {
      accessToken: ""
    }
  });

  // Function to fetch business managers
  const fetchBusinessManagers = async (token: string) => {
    try {
      const response = await apiRequest("POST", "/api/facebook/business-managers", { accessToken: token });
      const data = await response.json();
      if (data.success && data.data) {
        setBusinessManagers(data.data);
        // Auto-select first business manager if none selected
        if (data.data.length > 0 && !selectedBusinessId) {
          setSelectedBusinessId(data.data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch business managers:", error);
    }
  };

  // Query to fetch inactive accounts with pagination
  const { data: inactiveAccounts, isLoading, error, refetch } = useQuery({
    queryKey: ['business-manager-accounts', selectedBusinessId, currentPage, accessToken],
    queryFn: async () => {
      console.log(`[QUERY] Fetching page ${currentPage} for BM ${selectedBusinessId}`);
      if (!accessToken) return null;
      
      // If BM is selected, fetch from that BM, otherwise use old endpoint
      if (selectedBusinessId) {
        const response = await apiRequest("POST", "/api/facebook/business-manager-accounts", { 
          accessToken,
          businessId: selectedBusinessId,
          page: currentPage, 
          limit: accountsPerPage 
        });
        const data = await response.json();
        
        // Server now handles all filtering (active accounts, spend_cap > 1, zero spending)
        if (data.success && data.data) {
          console.log(`[FRONTEND] Received ${data.data.length} accounts from server for page ${currentPage}`);
          // Server-side filtering is complete, just return the data with proper pagination
        }
        return data;
      } else {
        const response = await apiRequest("POST", "/api/facebook/inactive-accounts", { 
          accessToken, 
          page: currentPage, 
          limit: accountsPerPage 
        });
        return response.json();
      }
    },
    enabled: !!accessToken && !!selectedBusinessId,
    staleTime: 0, // Always fetch fresh data
    cacheTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Mutation to set spend cap to $1 for an account
  const resetSpendCapMutation = useMutation({
    mutationFn: async ({ accountId }: { accountId: string }) => {
      setProcessingAccountId(accountId);
      const response = await apiRequest("POST", "/api/facebook/set-spend-cap-to-one", {
        accessToken,
        adAccountId: accountId
      });
      return response.json();
    },
    onSuccess: (response: any, variables: { accountId: string }) => {
      // Find the account to get its currency
      const account = currentAccounts.find((acc: InactiveAccount) => acc.id === variables.accountId);
      const currencyDisplay = account ? formatCurrencyForSetCap(account.currency) : '$1';
      
      // Add account to processed accounts set
      setProcessedAccounts(prev => new Set(prev).add(variables.accountId));
      
      toast({
        title: "Success",
        description: `Spend cap set to ${currencyDisplay} successfully`
      });
      setProcessingAccountId(null);
      // Don't refetch - keep optimistic UI state
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set spend cap",
        variant: "destructive"
      });
      setProcessingAccountId(null);
    }
  });

  const onSubmit = (data: { accessToken: string }) => {
    setAccessToken(data.accessToken);
    setCurrentPage(1); // Reset to first page when fetching new data
    // Fetch business managers when token is submitted
    fetchBusinessManagers(data.accessToken);
  };

  const handleFacebookLogin = (token: string) => {
    setAccessToken(token);
    form.setValue("accessToken", token);
    sessionStorage.setItem('facebook_access_token', token);
    // Fetch business managers when new token is received
    fetchBusinessManagers(token);
  };

  const handleBusinessManagerChange = (businessId: string) => {
    console.log(`[BM-CHANGE] Changing Business Manager to: ${businessId}`);
    setSelectedBusinessId(businessId);
    setCurrentPage(1); // Reset to first page when changing BM
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

  const formatCurrencyForSetCap = (currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(1);
  };

  // Get pagination info from API response
  const pagination = inactiveAccounts?.pagination;
  const totalAccounts = pagination?.totalItems || 0;
  const totalPages = pagination?.totalPages || 0;
  const currentAccounts = inactiveAccounts?.data || [];

  const goToPage = (page: number) => {
    console.log(`[PAGINATION] Going to page ${page}`);
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    console.log(`[PAGINATION] Going to previous page from ${currentPage}`);
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    // Allow going to next page if we have exactly the limit (likely more pages)
    const hasMoreData = inactiveAccounts?.pagination?.hasNextPage || 
                       (currentAccounts.length === accountsPerPage);
    console.log(`[PAGINATION] Next page clicked. Current accounts: ${currentAccounts.length}, hasMoreData: ${hasMoreData}`);
    if (hasMoreData) {
      setCurrentPage(prev => {
        console.log(`[PAGINATION] Changing page from ${prev} to ${prev + 1}`);
        return prev + 1;
      });
    }
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
                <p className="text-sm text-gray-600">Review active ad accounts and reset spend caps as needed</p>
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
                          onTokenReceived={handleFacebookLogin}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Business Manager Selection */}
                  {businessManagers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Business Manager</Label>
                      <Select 
                        value={selectedBusinessId} 
                        onValueChange={handleBusinessManagerChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Business Manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessManagers.map((bm) => (
                            <SelectItem key={bm.id} value={bm.id}>
                              {bm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Choose which Business Manager to view inactive accounts from
                      </p>
                    </div>
                  )}

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
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span>Active Ad Accounts</span>
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
                        <h3 className="text-lg font-medium text-gray-900">No Accounts Found</h3>
                        <p className="text-gray-600">No active ad accounts found in this Business Manager.</p>
                      </div>
                    ) : (
                      <>
                        {/* Pagination Header */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                          <div className="text-sm text-gray-700">
                            Showing {currentAccounts.length} accounts on page {currentPage}
                            {currentAccounts.length === accountsPerPage && (
                              <span className="text-gray-500"> (likely more pages available)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Page {currentPage}
                            {totalPages > currentPage && ` of ${totalPages}+`}
                          </div>
                        </div>

                        {/* Accounts Grid */}
                        <div className="grid gap-4">
                          {currentAccounts.map((account: InactiveAccount) => (
                          <div
                            key={account.id}
                            className={`border rounded-lg p-4 hover:bg-gray-50 ${
                              processedAccounts.has(account.id) 
                                ? 'border-green-300 bg-green-50' 
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <FaFacebookF className="text-gray-600 text-sm" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <h3 className="font-medium text-gray-900">{account.name}</h3>
                                      {processedAccounts.has(account.id) && (
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500">{account.id}</p>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Currency:</span>
                                    <div className="font-medium">{account.currency}</div>
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
                                  disabled={processingAccountId === account.id || processedAccounts.has(account.id)}
                                  variant="outline"
                                  className={`${
                                    processedAccounts.has(account.id)
                                      ? 'border-green-600 text-green-600 bg-green-100'
                                      : 'border-green-300 text-green-600 hover:bg-green-50'
                                  }`}
                                >
                                  {processingAccountId === account.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : processedAccounts.has(account.id) ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Set to {formatCurrencyForSetCap(account.currency)}
                                    </>
                                  ) : (
                                    `Set to ${formatCurrencyForSetCap(account.currency)}`
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                          ))}
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex items-center justify-center space-x-2 pt-4 border-t border-gray-200">
                          <Button
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            variant="outline"
                            size="sm"
                          >
                            Previous
                          </Button>
                          
                          <div className="flex items-center space-x-2 px-4">
                            <span className="text-sm text-gray-700">Page {currentPage}</span>
                          </div>
                          
                          <Button
                            onClick={goToNextPage}
                            disabled={currentAccounts.length < accountsPerPage}
                            variant="outline"
                            size="sm"
                          >
                            Next
                          </Button>
                        </div>
                      </>
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