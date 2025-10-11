// app/not-found.tsx
import React from 'react';

export default function NotFound() {
  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground mt-2">The page you were looking for does not exist.</p>
      </div>
    </div>
  );
}
