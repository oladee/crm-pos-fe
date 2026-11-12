'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { TillProvider } from '@/contexts/till-context';
import { LiveTillProvider } from '@/contexts/live-till-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TillProvider><LiveTillProvider>{children}</LiveTillProvider></TillProvider>
    </ThemeProvider>
  );
}
