"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center space-y-6">
       <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
            <AlertCircle size={32} />
       </div>
      
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
        <p className="text-muted-foreground text-sm">
            We encountered an unexpected error. Don't worry, your data is safe.
        </p>
        <div className="p-4 bg-muted/50 rounded-lg border border-border mt-4 text-left overflow-hidden">
             <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message || "Unknown error occurred"}
             </p>
        </div>
      </div>
      
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
