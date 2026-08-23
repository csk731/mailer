"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "@/lib/types";
import { REQUIRED_SCOPE } from "@/lib/gmail";
import { toast } from "sonner";
import { LoginScreen } from "@/components/LoginScreen";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  loggingIn: boolean;
  login: (dynamicClientId?: string) => void;
  logout: () => void;
  checkTokenValidity: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('gmail_token');
    const storedUser = localStorage.getItem('gmail_user');
    const storedExpiry = sessionStorage.getItem('gmail_token_expiry');
    
    if (storedToken && storedUser && storedExpiry) {
        const now = Date.now();
        const expiryTime = parseInt(storedExpiry, 10);
        
        if (now >= expiryTime - 60000) {
            console.warn("Token expired, clearing session");
            sessionStorage.removeItem('gmail_token');
            localStorage.removeItem('gmail_user');
            sessionStorage.removeItem('gmail_token_expiry');
            setToken(null);
            setUser(null);
        } else {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
    } else {
        if (storedToken || storedUser) {
            sessionStorage.removeItem('gmail_token');
            localStorage.removeItem('gmail_user');
            sessionStorage.removeItem('gmail_token_expiry');
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
            const expiresIn = response.expires_in || 3599;
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            setToken(accessToken);
            sessionStorage.setItem('gmail_token', accessToken);
            sessionStorage.setItem('gmail_token_expiry', expiryTime.toString());

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
      if (!confirm("Are you sure you want to log out?")) {
        return;
      }
  
      setToken(null);
      setUser(null);
      sessionStorage.removeItem('gmail_token');
      localStorage.removeItem('gmail_user');
      sessionStorage.removeItem('gmail_token_expiry');
      toast.success("Logged out successfully");
  };

  const checkTokenValidity = () => {
    const storedExpiry = sessionStorage.getItem('gmail_token_expiry');
    if (storedExpiry) {
        if (Date.now() >= parseInt(storedExpiry, 10)) {
            setToken(null);
            setUser(null);
            sessionStorage.removeItem('gmail_token');
            localStorage.removeItem('gmail_user');
            sessionStorage.removeItem('gmail_token_expiry');
            toast.error("Session expired", { description: "Please log in again." });
            return false;
        }
    }
    return true;
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Initializing Mailer...</p>
          </div>
      );
  }

  // GLOBAL PROTECTION: If no user, show login screen
  if (!user || !token) {
      return <LoginScreen onLogin={login} loggingIn={loggingIn} />;
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, loggingIn, login, logout, checkTokenValidity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
