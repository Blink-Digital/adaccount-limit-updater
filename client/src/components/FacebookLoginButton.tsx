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
      const token = await login();
      onTokenReceived(token);
      toast({
        title: "Success",
        description: "Successfully logged in with Facebook"
      });
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "Failed to login with Facebook",
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