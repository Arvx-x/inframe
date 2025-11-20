"use client";

// app/providers/Providers.tsx

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import { Toaster as AppToaster } from '@/app/components/ui/toaster'; // your custom UI toaster visual
import { Toaster as SonnerToaster } from '@/app/components/ui/sonner'; // sonner visual you used previously
import { AuthProvider } from '@/app/providers/AuthProvider';
// If you use a ToastProvider/Toaster elsewhere (e.g., sonner), include it here.

export default function Providers({ children }: { children: React.ReactNode }) {
  // ensure QueryClient is instantiated once on client
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* Visual toasters — place once per app */}
          <AppToaster />
          <SonnerToaster />
          {children}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
