import React from "react";
import { Key, Loader2, ShieldCheck, Lock, RefreshCw } from "lucide-react";

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
            <div className="text-center space-y-6 max-w-md w-full">
                <div className="space-y-2">
                    <h1 className="text-2xl sm:text-4xl font-bold font-[family-name:var(--font-bitcount)] tracking-wide pt-2">Welcome to Mailer</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm">Send personalized email campaigns with ease</p>
                </div>

                {/* How Your Session Works */}
                <div className="text-left bg-muted/30 border border-border/80 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                        <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                        <span>Private Incognito Session</span>
                    </div>
                    <ul className="space-y-2 text-muted-foreground leading-relaxed">
                        <li className="flex items-start gap-2">
                            <Lock size={13} className="text-indigo-400 mt-0.5 shrink-0" />
                            <span><strong className="text-foreground">Temporary Workspace:</strong> Nothing is ever saved to your device. All contacts and email drafts exist only while this tab is open.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <RefreshCw size={13} className="text-amber-400 mt-0.5 shrink-0" />
                            <span><strong className="text-foreground">Ends on Close or Disconnect:</strong> Closing this tab or logging out immediately disconnects your account and clears all data.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 text-xs font-mono font-bold mt-0.5 shrink-0">✓</span>
                            <span><strong className="text-foreground">Complete Privacy:</strong> Your email and contact data stay strictly in this browser tab and are never stored or shared anywhere.</span>
                        </li>
                    </ul>
                </div>

                <div className="space-y-4">
                    {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                        <div className="relative max-w-xs mx-auto">
                          <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input 
                              type="text" 
                              placeholder="Enter Google Client ID" 
                              value={clientId}
                              onChange={e => handleClientIdChange(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          />
                        </div>
                    )}
                    
                    <button 
                      onClick={() => onLogin(clientId)}
                      disabled={loggingIn || (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && !clientId)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium w-full justify-center cursor-pointer"
                    >
                      {loggingIn ? (
                          <>
                              <Loader2 className="animate-spin" size={20} />
                              Starting Session...
                          </>
                      ) : (
                          <>
                              <Key size={20} />
                              Start Session
                          </>
                      )}
                    </button>
                    
                     {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                         <p className="text-xs text-muted-foreground/50">
                             Enter your Google Client ID to connect
                         </p>
                     )}
                </div>
            </div>
        </div>
    );
}
