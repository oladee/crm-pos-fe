'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { TillProvider } from '@/contexts/till-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TillProvider>{children}</TillProvider>
    </ThemeProvider>
  );
}
