import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TestFilteringPage() {
  const [accessToken, setAccessToken] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    if (!accessToken) {
      alert('Please enter a Facebook access token');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/test-filtering', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Test failed:', error);
      setResults({
        success: false,
        error: 'Failed to run test: ' + (error as Error).message
      });
    }
    setLoading(false);
  };

  const formatJSON = (obj: any) => {
    if (!obj) return 'null';
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Facebook Graph API Filtering Test</h1>
          <p className="text-muted-foreground mt-2">
            Test if Facebook Graph API supports spend_cap filtering for ad accounts
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Enter your Facebook access token to test filtering capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="token">Facebook Access Token</Label>
              <Input
                id="token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your Facebook access token"
              />
            </div>
            
            <Button onClick={runTest} disabled={loading || !accessToken}>
              {loading ? 'Running Tests...' : 'Run Filtering Tests'}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Test Conclusion:</strong> {results.conclusion}
              </AlertDescription>
            </Alert>

            {results.results && results.results.map((result: any, index: number) => (
              <Card key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? '✅' : '❌'} {result.test}
                    {result.accountCount !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        ({result.accountCount} accounts)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <strong>Status:</strong> {result.success ? 'SUCCESS' : 'FAILED'} ({result.status || 'N/A'})
                    </div>
                    
                    {result.error && (
                      <div className="text-red-600">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                    
                    {result.sampleData && result.sampleData.length > 0 && (
                      <div>
                        <strong>Sample Data:</strong>
                        <Textarea
                          className="mt-2 font-mono text-xs"
                          value={formatJSON(result.sampleData[0])}
                          readOnly
                          rows={8}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle>Full Results (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="font-mono text-xs"
                  value={formatJSON(results)}
                  readOnly
                  rows={15}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>What This Test Does</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Test 1:</strong> Confirms basic filtering works (account_status=1)</p>
              <p><strong>Test 2:</strong> Tests if spend_cap filtering is supported</p>
              <p><strong>Test 3:</strong> Tests different operators for spend_cap (GREATER_THAN, NOT_EQUAL, IN)</p>
              <p className="mt-4 text-muted-foreground">
                If Test 2 succeeds, we can move ALL filtering to Facebook's servers and eliminate 
                server-side filtering completely. This would be a massive performance improvement 
                for accounts with thousands of ad accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}