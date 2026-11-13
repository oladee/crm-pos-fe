function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--color-surface-2)] ${className}`} />;
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="pos-shell min-h-[100dvh]" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <Frame label="Loading sign in">
      <div className="grid min-h-[100dvh] place-items-center p-4 sm:p-8">
        <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
          <div className="space-y-4">
            <Bone className="h-16 w-56" />
            <Bone className="h-4 w-28" />
            <Bone className="h-10 w-64" />
            <Bone className="h-16 w-72" />
          </div>
          <div className="modal-shell space-y-3 rounded-[16px] p-5">
            <Bone className="h-6 w-40" />
            <Bone className="h-12 w-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => <Bone key={i} className="h-16" />)}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function ShiftSkeleton() {
  return (
    <Frame label="Loading shift">
      <div className="grid min-h-[100dvh] place-items-center p-5">
        <div className="modal-shell w-full max-w-md space-y-4 rounded-[16px] p-7">
          <Bone className="h-10 w-40" />
          <Bone className="mx-auto h-14 w-14" />
          <Bone className="mx-auto h-8 w-56" />
          <Bone className="h-24 w-full" />
          <Bone className="h-14 w-full" />
        </div>
      </div>
    </Frame>
  );
}

export function SellSkeleton() {
  return (
    <Frame label="Loading register">
      <div className="flex min-h-[100dvh] flex-col">
        <div className="pos-header flex items-center gap-3 px-4">
          <Bone className="h-10 w-28" />
          <Bone className="h-8 w-40" />
          <Bone className="ml-auto h-10 w-24" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex flex-1 flex-col gap-3 p-4">
            <Bone className="h-8 w-48" />
            <Bone className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-32" />)}
            </div>
          </div>
          <div className="hidden w-[360px] flex-col gap-3 border-l border-[var(--color-line)] p-4 md:flex">
            <Bone className="h-8 w-32" />
            <Bone className="h-12 w-full" />
            <Bone className="h-20 w-full" />
            <Bone className="mt-auto h-14 w-full" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function HistorySkeleton() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-10 sm:px-6" role="status" aria-busy="true" aria-label="Loading transactions">
      <header className="space-y-2 border-b border-[var(--color-line)] py-4">
        <Bone className="h-11 w-28" />
        <Bone className="h-8 w-44" />
        <Bone className="h-5 w-64 max-w-full" />
      </header>
      <Bone className="my-3 h-11 w-40" />
      <div className="my-5 grid gap-3 sm:grid-cols-[1fr_170px_190px]">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-1"><Bone className="h-5 w-28" /><Bone className="h-11 w-full" /></div>)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-28 w-full" />)}
      </div>
    </main>
  );
}

export function ReceiptSkeleton() {
  return (
    <main className="min-h-dvh bg-[var(--color-bg)] print:hidden" role="status" aria-busy="true" aria-label="Loading receipt">
      <section className="mx-auto w-full max-w-3xl pb-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] p-4">
          <Bone className="h-11 w-36" />
          <Bone className="h-11 w-24" />
          <div className="w-full"><Bone className="h-7 w-40" /></div>
        </header>
        <div className="mx-auto my-6 w-[58mm] bg-white py-5">
          <div className="mx-auto w-[48mm] space-y-3">
            <Bone className="mx-auto h-9 w-28" />
            {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="h-4 w-full" />)}
          </div>
        </div>
      </section>
    </main>
  );
}

export function SupervisorSkeleton() {
  return (
    <Frame label="Loading manager dashboard">
      <div className="flex min-h-[100dvh] flex-col">
        <div className="manager-header flex items-center gap-3 px-4">
          <Bone className="h-10 w-28" />
          <Bone className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => <Bone key={i} className="h-20" />)}
        </div>
        <div className="space-y-2 px-4">
          {Array.from({ length: 5 }).map((_, i) => <Bone key={i} className="h-14 w-full" />)}
        </div>
      </div>
    </Frame>
  );
}

export function SettingsSkeleton() {
  return (
    <Frame label="Loading settings">
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <Bone className="h-14 w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-10 w-28" />)}
        </div>
        {Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-24 w-full" />)}
      </div>
    </Frame>
  );
}
