import React from "react";
import { Key, Loader2, Sparkles } from "lucide-react";

interface LoginScreenProps {
    onLogin: (clientId?: string) => void;
    loggingIn: boolean;
}

export function LoginScreen({ onLogin, loggingIn }: LoginScreenProps) {
    const SAVED_CLIENT_ID_KEY = 'mailer_client_id';
    const [clientId, setClientId] = React.useState<string>(
        () => (typeof window !== 'undefined' ? localStorage.getItem(SAVED_CLIENT_ID_KEY) ?? "" : "")
    );

    const handleClientIdChange = (val: string) => {
        setClientId(val);
        if (val) {
            localStorage.setItem(SAVED_CLIENT_ID_KEY, val);
        } else {
            localStorage.removeItem(SAVED_CLIENT_ID_KEY);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="space-y-2">
                     <div className="mb-4"></div>
                    <h1 className="text-4xl font-bold font-[family-name:var(--font-bitcount)] tracking-wide pt-2">Welcome to Mailer</h1>
                    <p className="text-muted-foreground">Send personalized email campaigns with ease</p>
                </div>
                <div className="space-y-4">
                    {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                        <div className="relative max-w-xs mx-auto">
                          <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input 
                              type="text" 
                              placeholder="Enter Client ID" 
                              value={clientId}
                              onChange={e => handleClientIdChange(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          />
                        </div>
                    )}
                    
                    <button 
                      onClick={() => onLogin(clientId)}
                      disabled={loggingIn || (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && !clientId)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium w-full justify-center"
                    >
                      {loggingIn ? (
                          <>
                              <Loader2 className="animate-spin" size={20} />
                              Connecting...
                          </>
                      ) : (
                          <>
                              <Key size={20} />
                              Connect Gmail
                          </>
                      )}
                    </button>
                    
                     {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                         <p className="text-xs text-muted-foreground/50">
                             Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env to skip manual entry
                         </p>
                     )}
                </div>
            </div>
        </div>
    );
}
