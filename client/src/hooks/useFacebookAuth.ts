import { useState, useEffect } from 'react';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface FacebookAuthResponse {
  authResponse: {
    accessToken: string;
    userID: string;
    expiresIn: number;
  } | null;
  status: 'connected' | 'not_authorized' | 'unknown';
}

export const useFacebookAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Facebook SDK
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: '426361686419846', // Facebook App ID
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
      
      setIsSDKLoaded(true);
    };

    // Load SDK if not already loaded
    if (!window.FB) {
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      setIsSDKLoaded(true);
    }
  }, []);

  const login = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isSDKLoaded || !window.FB) {
        reject(new Error('Facebook SDK not loaded'));
        return;
      }

      setIsLoading(true);
      setError(null);

      window.FB.login(
        (response: FacebookAuthResponse) => {
          setIsLoading(false);
          
          if (response.status === 'connected' && response.authResponse) {
            // Store token in session storage
            sessionStorage.setItem('facebook_access_token', response.authResponse.accessToken);
            resolve(response.authResponse.accessToken);
          } else {
            const errorMsg = 'Facebook login failed or was cancelled';
            setError(errorMsg);
            reject(new Error(errorMsg));
          }
        },
        { 
          scope: 'ads_read,ads_management',
          return_scopes: true
        }
      );
    });
  };

  const logout = () => {
    if (window.FB) {
      window.FB.logout();
    }
    sessionStorage.removeItem('facebook_access_token');
  };

  const getStoredToken = (): string | null => {
    return sessionStorage.getItem('facebook_access_token');
  };

  return {
    login,
    logout,
    getStoredToken,
    isLoading,
    isSDKLoaded,
    error
  };
};