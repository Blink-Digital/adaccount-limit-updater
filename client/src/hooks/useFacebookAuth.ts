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
      if (window.FB) {
        window.FB.init({
          appId: '426361686419846', // Facebook App ID
          cookie: true,
          xfbml: true,
          version: 'v19.0'  // Updated to latest version
        });
        
        setIsSDKLoaded(true);
      }
    };

    // Check if SDK is already loaded
    if (window.FB) {
      window.fbAsyncInit();
    } else {
      // Wait for SDK to load from the script tag in index.html
      const checkFB = setInterval(() => {
        if (window.FB) {
          window.fbAsyncInit();
          clearInterval(checkFB);
        }
      }, 100);

      // Clean up interval after 10 seconds
      setTimeout(() => clearInterval(checkFB), 10000);
    }
  }, []);

  const login = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isSDKLoaded || !window.FB) {
        reject(new Error('Facebook SDK not loaded. Please refresh the page and try again.'));
        return;
      }

      setIsLoading(true);
      setError(null);

      console.log('Attempting Facebook login...');

      window.FB.login(
        (response: FacebookAuthResponse) => {
          console.log('Facebook login response:', response);
          setIsLoading(false);
          
          if (response.status === 'connected' && response.authResponse) {
            // Store token in session storage
            sessionStorage.setItem('facebook_access_token', response.authResponse.accessToken);
            console.log('Facebook login successful, token stored');
            resolve(response.authResponse.accessToken);
          } else if (response.status === 'not_authorized') {
            const errorMsg = 'Please authorize the app to access your Facebook ads data';
            setError(errorMsg);
            reject(new Error(errorMsg));
          } else if (response.status === 'unknown') {
            const errorMsg = 'Facebook app configuration issue. Please enable JavaScript SDK in Facebook Developer Console and add this domain to allowed URLs.';
            setError(errorMsg);
            reject(new Error(errorMsg));
          } else {
            const errorMsg = 'Facebook login was cancelled or failed';
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