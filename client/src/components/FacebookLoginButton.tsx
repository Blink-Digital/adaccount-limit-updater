import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFacebookAuth } from '@/hooks/useFacebookAuth';
import { useToast } from '@/hooks/use-toast';
import { FaFacebookF } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';

interface FacebookLoginButtonProps {
  onTokenReceived: (token: string) => void;
  disabled?: boolean;
}

export const FacebookLoginButton = ({ onTokenReceived, disabled }: FacebookLoginButtonProps) => {
  const { login, isLoading, isSDKLoaded, error } = useFacebookAuth();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async () => {
    try {
      setIsAuthenticating(true);
      
      // Check if SDK is loaded
      if (!isSDKLoaded) {
        throw new Error("Facebook SDK is still loading, please wait a moment and try again");
      }
      
      const token = await login();
      onTokenReceived(token);
      toast({
        title: "Success", 
        description: "Successfully logged in with Facebook and retrieved access token"
      });
    } catch (err: any) {
      console.error("Facebook login error:", err);
      toast({
        title: "Login Failed",
        description: err.message || "Failed to login with Facebook. Please check your popup blocker settings.",
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const isButtonDisabled = disabled || isLoading || isAuthenticating || !isSDKLoaded;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogin}
      disabled={isButtonDisabled}
      className="border-blue-600 text-blue-600 hover:bg-blue-50"
    >
      {isAuthenticating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FaFacebookF className="mr-2 h-4 w-4" />
      )}
      {isAuthenticating ? 'Logging in...' : 'Login with Facebook'}
    </Button>
  );
};