"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function GlobalErrorHandler() {
  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const errorHandler = (event: ErrorEvent) => {
        // Prevent default browser error reporting if possible
        // event.preventDefault(); 
        
        console.error("Global Error Caught:", event.error);
        
        // Show user-friendly toast
        toast.error("An unexpected error occurred", {
            description: event.message || "Something went wrong. Please check your inputs.",
            duration: 5000,
        });
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
        console.error("Unmarshal Promise Rejection:", event.reason);
        
        const msg = event.reason?.message || "Operation failed unexpectedly";
        
        toast.error("System Error", {
            description: msg,
            duration: 5000
        });
        
        // Try to prevent Next.js overlay for specific known benign errors if needed
        // event.preventDefault();
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
        window.removeEventListener("error", errorHandler);
        window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  return null;
}
