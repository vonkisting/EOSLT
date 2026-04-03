"use client";

import { useRef, type ChangeEvent } from "react";
import { ObsConnectionLogoRow } from "@/components/stream/ObsConnectionLogoRow";
import type { StreamLogoRowUi } from "@/components/stream/streamObsLogoTypes";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { useObsConnectionLogos } from "@/components/stream/useObsConnectionLogos";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsConnectionLogosSectionProps = {
  emailNormalized: string;
  connectionName: string;
  connected: boolean;
  obsCredentials: ObsCredentials | null;
  logos: StreamLogoRowUi[];
  onSaveProfile: () => Promise<void>;
};

/**
 * Import logos to Convex storage and wire each to an OBS Image Source on the program scene.
 */
export function ObsConnectionLogosSection({
  emailNormalized,
  connectionName,
  connected,
  obsCredentials,
  logos,
  onSaveProfile,
}: ObsConnectionLogosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trimmedConnection = connectionName.trim();
  const {
    uploading,
    uploadError,
    wiringId,
    wireErrorById,
    nameById,
    setNameById,
    uploadFile,
    wireLogo,
    removeLogoById,
  } = useObsConnectionLogos({
    emailNormalized,
    trimmedConnection,
    connected,
    obsCredentials,
    logos,
    onSaveProfile,
  });

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadFile(file);
  }

  return (
    <div className="space-y-3 border-t border-white/10 pt-4" aria-label="Stream logo files">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {labelTitleCase("Logo files")}
        </h3>
        <button
          type="button"
          disabled={!trimmedConnection || uploading}
          title={
            !trimmedConnection
              ? "Set a connection name and save the profile before importing"
              : undefined
          }
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-lg font-medium text-slate-100 transition hover:border-white/35 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Import logo file"
        >
          +
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept="*/*"
        onChange={onFileChange}
      />
      {uploadError ? (
        <p className="text-xs text-red-300" role="alert">
          {uploadError}
        </p>
      ) : null}
      {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}

      <ul className="space-y-3">
        {logos.map((logo) => (
          <ObsConnectionLogoRow
            key={logo.id}
            logo={logo}
            connected={connected}
            obsReady={Boolean(obsCredentials)}
            inputName={nameById[logo.id] ?? logo.obsImageSourceName ?? ""}
            onInputNameChange={(value) => setNameById((s) => ({ ...s, [logo.id]: value }))}
            onWire={() => void wireLogo(logo)}
            onRemove={() => void removeLogoById(logo.id)}
            wiring={wiringId === logo.id}
            wireError={wireErrorById[logo.id] ?? null}
          />
        ))}
      </ul>
    </div>
  );
}
