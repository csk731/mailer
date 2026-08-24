"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "@/lib/types";
import { REQUIRED_SCOPE } from "@/lib/gmail";
import { toast } from "sonner";
import { LoginScreen } from "@/components/LoginScreen";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  token: string | null;
  tokenExpiry: number | null;
  secondsRemaining: number | null;
  user: UserProfile | null;
  loading: boolean;
  loggingIn: boolean;
  login: (dynamicClientId?: string) => void;
  logout: () => void;
  extendSession: () => void;
  invalidateSession: (reason?: string) => void;
  checkTokenValidity: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Pure Incognito Zero Persistence: Clean any stale storage
  useEffect(() => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('mailer_subject');
      localStorage.removeItem('mailer_body');
      localStorage.removeItem('mailer_columns');
      localStorage.removeItem('mailer_data');
      localStorage.removeItem('gmail_token');
      localStorage.removeItem('gmail_token_expiry');
    } catch {}
  }, []);

  useEffect(() => {
    if (!token || !tokenExpiry) {
      setSecondsRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((tokenExpiry - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        invalidateSession("Your 60-minute Google session has expired. Please start a new session.");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [token, tokenExpiry]);

  useEffect(() => {
    if (!token) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an active session. Leaving or refreshing this page will completely end your session and clear all data from memory.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [token]);

  // Idle Inactivity Guard (auto-disconnect after 20 minutes of no user interaction)
  useEffect(() => {
    if (!token) return;

    let timeoutId: NodeJS.Timeout;
    const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

    const resetIdleTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invalidateSession("Session ended due to 20 minutes of inactivity for your security.");
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [token]);

  const revokeToken = (currentToken: string | null) => {
    if (!currentToken) return;
    try {
      if (typeof window !== "undefined" && window.google?.accounts?.oauth2?.revoke) {
        window.google.accounts.oauth2.revoke(currentToken, () => {
          console.log("Token revoked via Google Identity Services");
        });
      } else {
        fetch(`https://oauth2.googleapis.com/revoke?token=${currentToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Token revocation error", e);
    }
  };

  const invalidateSession = (reason?: string) => {
    revokeToken(token);
    setToken(null);
    setTokenExpiry(null);
    setUser(null);
    setSecondsRemaining(null);
    toast.info("Session ended", {
      description: reason || "Your temporary session has ended. All in-memory data was cleared."
    });
  };

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
            setTokenExpiry(expiryTime);

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
                
                toast.success("Session started!", {
                   description: `Connected as ${userData.name || userData.email}`
                });
            } catch (err) {
                console.error("Failed to fetch user info", err);
                toast.error("Failed to load user profile", {
                    description: "Authentication succeeded but profile load failed"
                });
            }
        } else {
            toast.error("Sign-in failed", {
                description: "Could not connect to your Google account. Please try again."
            });
        }
        setLoggingIn(false);
      },
      error_callback: () => {
          setLoggingIn(false);
          toast.error("Sign-in was cancelled or failed");
      }
    });
    client.requestAccessToken();
  };

  const logout = () => {
      const confirmMsg = [
          "⚠️ END SESSION",
          "",
          "Are you sure you want to end your session?",
          "",
          "• Your Google account will be disconnected.",
          "• All contacts and email drafts in this tab will be cleared."
      ].join("\n");

      if (!confirm(confirmMsg)) {
        return;
      }
  
      revokeToken(token);
      setToken(null);
      setTokenExpiry(null);
      setUser(null);
      setSecondsRemaining(null);
      toast.success("Session ended", {
          description: "You have been logged out and all session data was cleared."
      });
  };

  const checkTokenValidity = () => {
    if (tokenExpiry) {
        if (Date.now() >= tokenExpiry) {
            invalidateSession("Your temporary session has expired. Please reconnect to continue.");
            return false;
        }
    }
    return true;
  };

  const extendSession = () => {
    login();
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
    <AuthContext.Provider value={{ 
      token, 
      tokenExpiry, 
      secondsRemaining, 
      user, 
      loading, 
      loggingIn, 
      login, 
      logout, 
      extendSession, 
      invalidateSession,
      checkTokenValidity 
    }}>
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
