'use client';

import { TillProvider } from '@/contexts/till-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TillProvider>{children}</TillProvider>;
}
