// app/layout.tsx
import './globals.css'; // ensure your Tailwind globals are here
import Providers from '@/app/providers/Providers';
import { Inter, Roboto, Poppins, Montserrat, Lato, Merriweather_Sans, Lora, Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], variable: '--font-roboto', weight: ['300','400','500','700'], display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', weight: ['300','400','500','600','700'], display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', weight: ['300','400','500','600','700'], display: 'swap' });
const lato = Lato({ subsets: ['latin'], variable: '--font-lato', weight: ['300','400','700','900'], display: 'swap' });
const merriweatherSans = Merriweather_Sans({ subsets: ['latin'], variable: '--font-merriweather-sans', display: 'swap' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['300','400','500','600','700'], display: 'swap' });
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta-sans', weight: ['200','300','400','500','600','700','800'], display: 'swap' });

export const metadata = {
  title: 'inFrame - AI-Native Campaign Builder',
  description: 'Build marketing campaigns, ads, and visuals with AI. Brand-consistent, multi-format, image-to-video.',
  icons: {
    icon: '/logooo2.png',
    shortcut: '/logooo2.png',
    apple: '/logooo2.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.cdnfonts.com/css/satoshi" rel="stylesheet" />
      </head>
      <body className="font-sans" style={{ fontFamily: "'Satoshi', sans-serif" }}>
        {/* Providers is a client component that mounts QueryClientProvider, Toasters, TooltipProvider, etc. */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
