'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Toaster } from 'sonner';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function subscribe(callback: () => void) {
  window.addEventListener('salesos-theme-change', callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'salesos-theme' || (event.newValue !== 'dark' && event.newValue !== 'light')) return;
    document.documentElement.dataset.theme = event.newValue;
    callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('salesos-theme-change', callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function getServerTheme(): Theme {
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0d0c' : '#f6f8f5');
  }, [theme]);

  const changeTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event('salesos-theme-change'));
    try { localStorage.setItem('salesos-theme', next); } catch { /* A restricted browser still gets this session's theme. */ }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: changeTheme }}>
      {children}
      <Toaster theme={theme} position="top-center" richColors />
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const { theme, setTheme } = context;
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`theme-toggle top-action inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-3 text-xs font-bold ${compact ? '' : 'sm:px-3.5'}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
