'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPinToken } from '@/lib/remote';
import { useTill } from './till-context';

export type TillActivity = 'idle' | 'building-cart' | 'selecting-customer' | 'checking-out' | 'awaiting-payment';
type Notice = { id: string; kind: string; title: string; reference?: string; createdAt: string };
const enabled = process.env.NEXT_PUBLIC_POS_LIVE_ENABLED === 'true';
const api = process.env.NEXT_PUBLIC_POS_API_URL || 'http://localhost:3478';
const soundPreference = 'pos.notification-sound';
const LiveTillContext = createContext({
  enabled, connected: false, sound: false, toggleSound: async () => {},
  setActivity: (_activity: TillActivity) => {}, notices: [] as Notice[],
});

let seenDb: Promise<IDBDatabase> | undefined;
async function claimNotice(key: string): Promise<boolean> {
  seenDb ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('fudfarmer-pos-live', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('seen');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Notification storage is blocked'));
  });
  const db = await seenDb;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('seen', 'readwrite');
    const request = transaction.objectStore('seen').add(Date.now(), key);
    let duplicate = false;
    request.onerror = () => { duplicate = request.error?.name === 'ConstraintError'; };
    transaction.oncomplete = () => resolve(true);
    transaction.onabort = () => duplicate ? resolve(false) : reject(transaction.error);
  });
}

function mergeNotices(snapshot: Notice[], live: Notice[]) {
  const items = new Map([...snapshot, ...live].map(item => [item.id, item]));
  return [...items.values()].sort((left, right) =>
    (right.createdAt || '').localeCompare(left.createdAt || '') || right.id.localeCompare(left.id),
  ).slice(0, 50);
}

function tone(audio: AudioContext) {
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(650, now);
  oscillator.frequency.setValueAtTime(880, now + 0.09);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.23);
}

export function LiveTillProvider({ children }: { children: React.ReactNode }) {
  const { cashier, store, online } = useTill();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [sound, setSound] = useState(false);
  const [noticeState, setNoticeState] = useState<{ key: string; items: Notice[] }>();
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  const activity = useRef<TillActivity>('idle');
  const sendActivity = useRef<() => void>(() => {});
  const deviceId = store?.deviceId;
  const userId = cashier?.id;
  const viewerKey = `${userId}:${deviceId}`;

  useEffect(() => {
    const mute = (event: StorageEvent) => {
      if (event.key === soundPreference && event.newValue === 'muted') {
        soundRef.current = false;
        setSound(false);
      }
    };
    window.addEventListener('storage', mute);
    return () => window.removeEventListener('storage', mute);
  }, []);

  useEffect(() => {
    if (!enabled || !online || !userId || !deviceId || !getPinToken()) return;
    let disposed = false, authenticated = false, seq = 0, retries = 0, lastAck = 0;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let baseline: Notice[] | undefined;
    let live: Notice[] = [];
    const visualSeen = new Set<string>();
    const keyFor = (item: Notice) => `${item.kind === 'personal' ? `user:${userId}` : `till:${deviceId}`}:${item.id}`;
    const heartbeat = () => {
      if (authenticated && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'heartbeat', seq: ++seq, activity: activity.current }));
      }
    };
    sendActivity.current = heartbeat;
    const recover = (items: Notice[]) => {
      const buffered = baseline ? [] : live;
      baseline = items;
      setNoticeState({ key: viewerKey, items: mergeNotices(items, live) });
      for (const item of items) {
        const key = keyFor(item);
        visualSeen.add(key);
        void claimNotice(`visual:${key}`).catch(() => undefined);
        void claimNotice(`tone:${key}`).catch(() => undefined);
      }
      const recoveredIds = new Set(items.map(item => item.id));
      for (const item of buffered) if (!recoveredIds.has(item.id)) void receive(item);
    };
    const receive = async (item: Notice) => {
      live = mergeNotices(live, [item]);
      if (!baseline) return;
      setNoticeState({ key: viewerKey, items: mergeNotices(baseline, live) });
      const key = keyFor(item);
      if (visualSeen.has(key)) return;
      visualSeen.add(key);
      if (item.kind === 'payment-confirmed' && soundRef.current && audio.current?.state === 'running') {
        const currentAudio = audio.current;
        void claimNotice(`tone:${key}`).then(claimed => {
          if (claimed && !disposed && soundRef.current) tone(currentAudio);
        }).catch(() => undefined);
      }
      // The in-memory claim above still prevents duplicate notices in this tab
      // when the browser disallows persistent storage.
      if (!(await claimNotice(`visual:${key}`).catch(() => true)) || disposed) return;
      const reference = item.kind === 'payment-confirmed' ? item.reference : undefined;
      toast(item.title, {
        id: reference ? `payment:${reference}` : item.id,
        action: reference ? { label: 'View receipt', onClick: () => router.push('/history/' + encodeURIComponent(reference)) } : undefined,
      });
    };
    const connect = () => {
      const token = getPinToken();
      if (disposed || !token) return;
      const url = new URL('/pos/live', api);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      baseline = undefined; live = [];
      socket = new WebSocket(url);
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'authenticate', kind: 'till', token }));
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(String(data));
        if (message.type === 'authenticated') {
          authenticated = true; retries = 0; seq = 0;
          lastAck = Date.now();
          setConnected(message.transportReady === true);
          heartbeat();
        } else if (message.type === 'heartbeat' || message.type === 'transport') {
          lastAck = Date.now();
          setConnected(message.transportReady === true);
        } else if (message.type === 'notifications') {
          recover(message.items);
        } else if (message.type === 'notification') {
          void receive(message.item);
        } else if (message.type === 'refresh' && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'snapshot' }));
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        authenticated = false; setConnected(false);
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retries++));
      };
    };
    connect();
    const timer = setInterval(heartbeat, 15_000);
    const watchdog = setInterval(() => {
      if (!authenticated || Date.now() - lastAck < 45_000) return;
      authenticated = false; setConnected(false); socket?.close();
    }, 5000);
    return () => {
      disposed = true; setConnected(false); setNoticeState(undefined);
      clearInterval(timer); clearInterval(watchdog); clearTimeout(retry); socket?.close();
      sendActivity.current = () => {};
    };
  }, [userId, deviceId, online, router, viewerKey]);

  const setActivity = useCallback((next: TillActivity) => {
    if (activity.current === next) return;
    activity.current = next;
    sendActivity.current();
  }, []);
  const toggleSound = async () => {
    if (soundRef.current) {
      soundRef.current = false; setSound(false);
      try { localStorage.setItem(soundPreference, 'muted'); } catch { /* This tab remains muted. */ }
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      soundRef.current = audio.current.state === 'running';
      setSound(soundRef.current);
      if (soundRef.current) localStorage.setItem(soundPreference, 'enabled');
    } catch { toast.info('Notification sound is unavailable on this device'); }
  };
  const notices = noticeState?.key === viewerKey ? noticeState.items : [];
  return <LiveTillContext.Provider value={{ enabled, connected, sound, toggleSound, setActivity, notices }}>{children}</LiveTillContext.Provider>;
}

export const useLiveTill = () => useContext(LiveTillContext);
