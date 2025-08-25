import { useState, useEffect, useCallback } from "react";
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
  BarChart3,
  Calendar,
  Eye,
  EyeOff,
  TrendingUp,
  Search,
  X
} from "lucide-react";
import { FaFacebookF } from "react-icons/fa";
import { FacebookLoginButton } from "../components/FacebookLoginButton";
import { Link } from "wouter";

interface SpendAccount {
  id: string;
  name: string;
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

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'maximum', label: 'All time' }
];

export default function AdAccountSpend() {
  const [showToken, setShowToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>("last_30d");
  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [previousCursor, setPreviousCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const accountsPerPage = 20;
  const { toast } = useToast();

  // Form for fetching accounts
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
  const fetchAccountSpend = async (accountId: string, datePreset: string) => {
    try {
      // Set loading state
      setAccountSpends(prev => ({
        ...prev,
        [accountId]: { spend: 0, loading: true, error: null }
      }));

      const response = await apiRequest("POST", "/api/facebook/account-spend", {
        accessToken,
        accountId,
        datePreset
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

  // Track account IDs to only fetch spend data when accounts actually change
  const [previousAccountIds, setPreviousAccountIds] = useState<string[]>([]);

  // Auto-load spend data for all accounts when NEW accounts are loaded or date preset changes
  useEffect(() => {
    if (accountsData?.data && accessToken && selectedDatePreset) {
      const accounts = accountsData.data;
      const currentAccountIds = accounts.map((acc: SpendAccount) => acc.id);
      
      // Only fetch spend data if the actual account IDs changed (new accounts loaded)
      const idsChanged = JSON.stringify(currentAccountIds) !== JSON.stringify(previousAccountIds);
      
      if (idsChanged) {
        console.log(`[SPEND-LOADER] New accounts loaded - auto-loading spend data for ${accounts.length} accounts with preset: ${selectedDatePreset}`);
        
        // Clear previous spend data
        setAccountSpends({});
        
        // Fetch spend for all accounts
        accounts.forEach((account: SpendAccount) => {
          fetchAccountSpend(account.id, selectedDatePreset);
        });
        
        // Update tracked account IDs
        setPreviousAccountIds(currentAccountIds);
      } else {
        console.log(`[SPEND-LOADER] Account properties updated but IDs unchanged - skipping spend refresh`);
      }
    }
  }, [accountsData?.data, accessToken, selectedDatePreset, previousAccountIds]);

  // Refresh spend data when date preset changes (for existing accounts)
  useEffect(() => {
    if (accountsData?.data && accessToken && previousAccountIds.length > 0) {
      console.log(`[DATE-CHANGE] Date preset changed to ${selectedDatePreset} - refreshing spend data`);
      
      // Clear previous spend data
      setAccountSpends({});
      
      // Fetch spend for all accounts with new date preset
      accountsData.data.forEach((account: SpendAccount) => {
        fetchAccountSpend(account.id, selectedDatePreset);
      });
    }
  }, [selectedDatePreset]);

  // Manual fetch function with search support
  const fetchAccountsManually = async (cursor?: string | null, searchTerm?: string) => {
    if (!accessToken || !selectedBusinessId) return;
    
    setIsManualLoading(true);
    setManualError(null);
    
    // Show search loading state if searching
    if (searchTerm !== undefined) {
      setIsSearching(true);
    }
    
    try {
      const requestBody: any = { 
        accessToken,
        businessId: selectedBusinessId,
        page: currentPage, 
        limit: accountsPerPage,
        includeSpend: false // Don't need Business Manager insights for this page
      };
      
      // Add search parameter if provided
      if (searchTerm !== undefined && searchTerm.trim()) {
        requestBody.search = searchTerm.trim();
        console.log(`[MANUAL-FETCH] Server-side search: "${searchTerm}"`);
      }
      
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
      setIsSearching(false);
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

  // Trigger search when debounced search query changes
  useEffect(() => {
    if (accessToken && selectedBusinessId) {
      // Reset pagination when searching
      setCurrentPage(1);
      setNextCursor(null);
      setPreviousCursor(null);
      
      fetchAccountsManually(null, debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, accessToken, selectedBusinessId]);

  // Expose data in the expected format
  const spendAccounts = accountsData;
  const isLoading = isManualLoading;
  const error = manualError;

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

  const handleDatePresetChange = (datePreset: string) => {
    console.log(`[DATE-CHANGE] Changing date preset to: ${datePreset}`);
    setSelectedDatePreset(datePreset);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount); // Facebook Insights API returns amounts in dollars
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get pagination info from API response
  const pagination = spendAccounts?.pagination;
  const totalAccounts = pagination?.totalItems || 0;
  const totalPages = pagination?.totalPages || 0;
  const currentAccounts = spendAccounts?.data || [];

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
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Ad Account Spend</h1>
                <p className="text-sm text-gray-600">View spending data across all ad accounts for any date range</p>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/" className="text-gray-600 hover:text-blue-600">Manage Caps</Link>
              <Link href="/reset-spend-cap" className="text-gray-600 hover:text-blue-600">Reset Caps</Link>
              <Link href="/ad-account-spend" className="text-green-600 font-medium">Account Spend</Link>
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
                          Required permissions: ads_read, business_management
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
                        Choose which Business Manager to view accounts from
                      </p>
                    </div>
                  )}

                  {/* Date Range Selection */}
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select 
                      value={selectedDatePreset} 
                      onValueChange={handleDatePresetChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Date Range" />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Choose the time period for spend reporting
                    </p>
                  </div>

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
                    Load Account Spend Data
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
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Account Spending Report</span>
                    {selectedDatePreset && (
                      <Badge variant="outline" className="bg-green-50 text-green-800">
                        {DATE_PRESETS.find(p => p.value === selectedDatePreset)?.label}
                      </Badge>
                    )}
                  </div>
                  {spendAccounts?.data && (
                    <Badge variant="secondary">
                      {spendAccounts.data.length} accounts found
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-600 mt-2">Loading ad accounts...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-1" />
                      <div>
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <p className="text-sm text-red-700 mt-1">{typeof error === 'string' ? error : 'An error occurred'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {spendAccounts?.success && spendAccounts.data && (
                  <div className="space-y-4">
                    {/* Search Bar - Always Visible */}
                    <div className="space-y-4 border-b border-gray-200 pb-4">
                      {/* Search Bar */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="Search by account name or ID..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 pr-10"
                            />
                            {searchQuery && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                                onClick={() => setSearchQuery("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {(searchQuery || isSearching) && (
                          <div className="text-sm text-gray-600">
                            {isSearching ? (
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Searching...</span>
                              </div>
                            ) : searchQuery ? (
                              `Found ${currentAccounts.length} matching accounts`
                            ) : null}
                          </div>
                        )}
                      </div>
                      
                      {/* Pagination Info */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          {searchQuery ? (
                            `Showing ${currentAccounts.length} search results`
                          ) : (
                            `Showing ${currentAccounts.length} accounts on page ${currentPage}`
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1 || isSearching}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-500">
                            {searchQuery ? "Search Results" : `Page ${currentPage}`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={!accountsData?.pagination?.hasNextPage || isSearching || !!searchQuery}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Results Section */}
                    {spendAccounts.data.length === 0 ? (
                      <div className="text-center py-8">
                        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Accounts Found</h3>
                        <p className="text-gray-600">
                          {searchQuery 
                            ? `No accounts match your search "${searchQuery}". Try a different search term or clear the search to see all accounts.`
                            : "No ad accounts found in this Business Manager."
                          }
                        </p>
                      </div>
                    ) : (
                      <>

                        {/* Accounts Table */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-700">
                            <div>Account Name</div>
                            <div>Account ID</div>
                            <div>Currency</div>
                            <div>Total Spend</div>
                          </div>
                          <div className="divide-y divide-gray-200">
                            {currentAccounts.map((account: SpendAccount) => {
                              const spendData = accountSpends[account.id];
                              return (
                                <div key={account.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-gray-50">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                      <FaFacebookF className="text-gray-600 text-sm" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{account.name}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500 font-mono">{account.id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-900">{account.currency}</p>
                                  </div>
                                  <div>
                                    {spendData?.loading ? (
                                      <div className="flex items-center space-x-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        <span className="text-sm text-gray-500">Loading...</span>
                                      </div>
                                    ) : spendData?.error ? (
                                      <span className="text-sm text-red-600">Error loading</span>
                                    ) : (
                                      <span className="text-sm font-medium text-gray-900">
                                        {formatCurrency(spendData?.spend || 0, account.currency)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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