import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VoxEmotion AI - Multilingual Expressive TTS Studio',
  description:
    'Next-generation multilingual AI text-to-speech studio featuring realistic emotional inflections, dual-speaker screenplays, vocal bursts, and cinematic voice direction.',
  openGraph: {
    title: 'VoxEmotion AI - Multilingual Expressive TTS Studio',
    description:
      'Next-generation multilingual AI text-to-speech studio featuring realistic emotional inflections, dual-speaker screenplays, vocal bursts, and cinematic voice direction.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoxEmotion AI - Multilingual Expressive TTS Studio',
    description:
      'Next-generation multilingual AI text-to-speech studio featuring realistic emotional inflections, dual-speaker screenplays, vocal bursts, and cinematic voice direction.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
