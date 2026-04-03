"use client";

type StreamObsPageHeaderProps = {
  connected: boolean;
  userEmail: string;
  userName: string | null;
};

export function StreamObsPageHeader({ connected, userEmail, userName }: StreamObsPageHeaderProps) {
  return (
    <header className={`border-b border-white/10 pb-6 ${connected ? "mb-8" : "mb-6"}`}>
      <p className="text-xs font-semibold text-purple-400/90">Stream Control</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
        OBS Dashboard
      </h1>
      {connected ? (
        <p className="mt-3 text-xs text-slate-500">
          Signed In As <span className="font-medium text-slate-400">{userName || userEmail}</span>
        </p>
      ) : null}
    </header>
  );
}
