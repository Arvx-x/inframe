// app/layout.tsx
import './globals.css'; // ensure your Tailwind globals are here
import Providers from '@/app/providers/Providers';

export const metadata = {
  title: 'Frame / Inframe',
  description: 'AI-native creative canvas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Providers is a client component that mounts QueryClientProvider, Toasters, TooltipProvider, etc. */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
