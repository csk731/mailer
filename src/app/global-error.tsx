"use client";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-black text-white antialiased min-h-screen flex flex-col items-center justify-center p-6 font-sans">
        <div className="space-y-6 text-center max-w-lg">
           <div className="mx-auto w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center text-red-500">
                <AlertCircle size={32} />
           </div>
          <h2 className="text-2xl font-bold">Critical Application Error</h2>
          <p className="text-gray-400">
             A critical error occurred that prevented the application from loading. 
             Please refresh the page or try again later.
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
