import { useState, useEffect } from "react";
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

interface AccountSpendState {
  [accountId: string]: {
    spend: number;
    loading: boolean;
    error: string | null;
  };
}

export default function ResetSpendCap() {
  const [showToken, setShowToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);
  const [processedAccounts, setProcessedAccounts] = useState<Set<string>>(new Set());
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [previousCursor, setPreviousCursor] = useState<string | null>(null);
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

  // Use manual fetching to avoid React Query cursor loops
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [accountsData, setAccountsData] = useState<any>(null);
  const [accountSpends, setAccountSpends] = useState<AccountSpendState>({});

  // Function to fetch spend data for individual account
  const fetchAccountSpend = async (accountId: string) => {
    try {
      // Set loading state
      setAccountSpends(prev => ({
        ...prev,
        [accountId]: { spend: 0, loading: true, error: null }
      }));

      const response = await apiRequest("POST", "/api/facebook/account-spend", {
        accessToken,
        accountId,
        datePreset: 'last_month'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAccountSpends(prev => ({
          ...prev,
          [accountId]: { spend: data.data.spend, loading: false, error: null }
        }));
      } else {
        setAccountSpends(prev => ({
          ...prev,
          [accountId]: { spend: 0, loading: false, error: data.error || 'Failed to fetch spend' }
        }));
      }
    } catch (error) {
      setAccountSpends(prev => ({
        ...prev,
        [accountId]: { spend: 0, loading: false, error: 'Network error' }
      }));
    }
  };

  // Auto-load spend data for all accounts when they're loaded
  useEffect(() => {
    if (accountsData?.data && accessToken) {
      const accounts = accountsData.data;
      console.log(`[SPEND-LOADER] Auto-loading spend data for ${accounts.length} accounts`);
      
      // Clear previous spend data
      setAccountSpends({});
      
      // Fetch spend for all accounts
      accounts.forEach((account: InactiveAccount) => {
        fetchAccountSpend(account.id);
      });
    }
  }, [accountsData?.data, accessToken]);

  // Manual fetch function
  const fetchAccountsManually = async (cursor?: string | null) => {
    if (!accessToken || !selectedBusinessId) return;
    
    setIsManualLoading(true);
    setManualError(null);
    
    try {
      const requestBody: any = { 
        accessToken,
        businessId: selectedBusinessId,
        page: currentPage, 
        limit: accountsPerPage,
        includeSpend: true // Enable Business Manager insights for spend data
      };
      
      if (cursor) {
        requestBody.after = cursor;
        console.log(`[MANUAL-FETCH] Using cursor: ${cursor.substring(0, 30)}...`);
      }
      
      const response = await apiRequest("POST", "/api/facebook/business-manager-accounts", requestBody);
      const data = await response.json();
      
      if (data.success) {
        setAccountsData(data);
        console.log(`[MANUAL-FETCH] Success: ${data.data?.length || 0} accounts for page ${currentPage}`);
      } else {
        setManualError(data.error || 'Failed to fetch accounts');
      }
    } catch (error: any) {
      setManualError(error.message || 'Network error');
      console.error('[MANUAL-FETCH] Error:', error);
    } finally {
      setIsManualLoading(false);
    }
  };

  // Initial fetch when access token or business manager changes
  useEffect(() => {
    if (accessToken && selectedBusinessId && currentPage === 1) {
      setNextCursor(null);
      setPreviousCursor(null);
      fetchAccountsManually();
    }
  }, [accessToken, selectedBusinessId]);

  // Expose data in the expected format
  const inactiveAccounts = accountsData;
  const isLoading = isManualLoading;
  const error = manualError;

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
    setNextCursor(null); // Reset cursors
    setPreviousCursor(null);
  };

  const handleResetSpendCap = (accountId: string) => {
    resetSpendCapMutation.mutate({ accountId });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount); // Facebook Insights API returns amounts in dollars
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



  const goToNextPage = () => {
    const hasNextPageData = accountsData?.pagination?.hasNextPage;
    const nextCursorData = accountsData?.pagination?.nextCursor;
    console.log(`[PAGINATION] Next page clicked. hasNextPage: ${hasNextPageData}, nextCursor: ${nextCursorData?.substring(0, 20) || 'none'}`);
    
    if (hasNextPageData && nextCursorData) {
      const newPage = currentPage + 1;
      console.log(`[PAGINATION] Going from page ${currentPage} to ${newPage}`);
      setCurrentPage(newPage);
      setNextCursor(nextCursorData);
      fetchAccountsManually(nextCursorData);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      console.log(`[PAGINATION] Going from page ${currentPage} to ${newPage}`);
      setCurrentPage(newPage);
      
      if (newPage === 1) {
        // Go back to first page (no cursor)
        setNextCursor(null);
        setPreviousCursor(null);
        fetchAccountsManually();
      } else {
        // This is simplified - for full implementation, we'd need to track cursors for each page
        toast({
          title: "Navigation Limitation",
          description: "Currently only Next and back to first page are supported"
        });
      }
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
                        <p className="text-sm text-red-700 mt-1">{typeof error === 'string' ? error : error?.message}</p>
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
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Currency:</span>
                                    <div className="font-medium">{account.currency}</div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Last Month Spend:</span>
                                    <div className="font-medium text-blue-600">
                                      {accountSpends[account.id]?.loading ? (
                                        <div className="flex items-center space-x-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span>Loading...</span>
                                        </div>
                                      ) : accountSpends[account.id]?.error ? (
                                        <span className="text-red-500 text-xs">Unable to load</span>
                                      ) : (
                                        formatCurrency(accountSpends[account.id]?.spend || 0, account.currency)
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Spend Cap:</span>
                                    <div className="font-medium text-green-600">
                                      {account.spend_cap 
                                        ? formatCurrency(account.spend_cap, account.currency)
                                        : "No Limit"
                                      }
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
                            disabled={currentPage === 1 || isLoading}
                            variant="outline"
                            size="sm"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading...
                              </>
                            ) : (
                              'Previous'
                            )}
                          </Button>
                          
                          <div className="flex items-center space-x-2 px-4">
                            <span className="text-sm text-gray-700">Page {currentPage}</span>
                          </div>
                          
                          <Button
                            onClick={goToNextPage}
                            disabled={currentAccounts.length < accountsPerPage || isLoading}
                            variant="outline"
                            size="sm"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading...
                              </>
                            ) : (
                              'Next'
                            )}
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