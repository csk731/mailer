import { useState, useEffect } from "react";
import { UserProfile } from "@/lib/types";
import { REQUIRED_SCOPE } from "@/lib/gmail";
import { toast } from "sonner";

declare global {
  interface Window {
    google: any;
  }
}

export function useGmailAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  // Restore session
  useEffect(() => {
    const storedToken = localStorage.getItem('gmail_token');
    const storedUser = localStorage.getItem('gmail_user');
    const storedExpiry = localStorage.getItem('gmail_token_expiry');
    
    if (storedToken && storedUser && storedExpiry) {
        const now = Date.now();
        const expiryTime = parseInt(storedExpiry, 10);
        
        // Check if token is expired (or close to expiring, e.g. within 1 min)
        if (now >= expiryTime - 60000) {
            console.warn("Token expired, clearing session");
            localStorage.removeItem('gmail_token');
            localStorage.removeItem('gmail_user');
            localStorage.removeItem('gmail_token_expiry');
            setToken(null);
            setUser(null);
        } else {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
    } else {
        // Inconsistent state, clear all
        if (storedToken || storedUser) {
            localStorage.removeItem('gmail_token');
            localStorage.removeItem('gmail_user');
            localStorage.removeItem('gmail_token_expiry');
        }
    }
    setLoading(false);
  }, []);

  const login = (dynamicClientId?: string) => {
    const clientId = dynamicClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
        toast.error("Configuration error", {
            description: "Missing Google Client ID. Please set environment variable or enter manually."
        });
        return;
    }
    if (typeof window === "undefined" || !window.google) {
      toast.error("Google services unavailable", {
          description: "Please check your internet connection"
      });
      return;
    }

    setLoggingIn(true);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: REQUIRED_SCOPE,
      callback: async (response: any) => {
        if (response.access_token) {
            const accessToken = response.access_token;
            const expiresIn = response.expires_in || 3599; // Default to ~1h if missing
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            setToken(accessToken);
            localStorage.setItem('gmail_token', accessToken);
            localStorage.setItem('gmail_token_expiry', expiryTime.toString());

            // Fetch User Info
            try {
                const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                const userData = await userInfoRes.json();
                const profile: UserProfile = {
                    email: userData.email,
                    name: `${userData.given_name} ${userData.family_name || ''}`.trim(),
                    given_name: userData.given_name,
                    family_name: userData.family_name,
                    picture: userData.picture
                };
                setUser(profile);
                localStorage.setItem('gmail_user', JSON.stringify(profile));
                
                toast.success("Successfully logged in!", {
                   description: `Welcome, ${userData.name || userData.email}`
                });
            } catch (err) {
                console.error("Failed to fetch user info", err);
                toast.error("Failed to load user profile", {
                    description: "Authentication succeeded but profile load failed"
                });
            }
        } else {
            toast.error("Login failed", {
                description: "Unable to obtain access token"
            });
        }
        setLoggingIn(false);
      },
      error_callback: () => {
          setLoggingIn(false);
          toast.error("Login cancelled or failed");
      }
    });
    client.requestAccessToken();
  };

  const logout = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('gmail_token');
      localStorage.removeItem('gmail_user');
      localStorage.removeItem('gmail_token_expiry');
      toast.success("Logged out successfully");
      setTimeout(() => window.location.reload(), 500);
  };

  const checkTokenValidity = () => {
    const storedExpiry = localStorage.getItem('gmail_token_expiry');
    if (storedExpiry) {
        if (Date.now() >= parseInt(storedExpiry, 10)) {
            logout();
            return false;
        }
    }
    return true;
  };

  return { token, user, loading, loggingIn, login, logout, checkTokenValidity };
}
