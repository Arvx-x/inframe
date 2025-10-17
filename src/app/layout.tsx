// app/layout.tsx
import './globals.css'; // ensure your Tailwind globals are here
import Providers from '@/app/providers/Providers';
import { Inter, Roboto, Poppins, Montserrat, Lato } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], variable: '--font-roboto', weight: ['300','400','500','700'], display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', weight: ['300','400','500','600','700'], display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', weight: ['300','400','500','600','700'], display: 'swap' });
const lato = Lato({ subsets: ['latin'], variable: '--font-lato', weight: ['300','400','700','900'], display: 'swap' });

export const metadata = {
  title: 'Frame / Inframe',
  description: 'AI-native creative canvas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${roboto.variable} ${poppins.variable} ${montserrat.variable} ${lato.variable}`}>
        {/* Providers is a client component that mounts QueryClientProvider, Toasters, TooltipProvider, etc. */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
