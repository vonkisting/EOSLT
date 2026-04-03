"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { StreamLogoRowUi } from "@/components/stream/streamObsLogoTypes";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

type UseObsConnectionLogosArgs = {
  emailNormalized: string;
  trimmedConnection: string;
  connected: boolean;
  obsCredentials: ObsCredentials | null;
  logos: StreamLogoRowUi[];
  onSaveProfile: () => Promise<void>;
};

/**
 * Convex logo upload + OBS image source wiring for the connection card.
 */
export function useObsConnectionLogos({
  emailNormalized,
  trimmedConnection,
  connected,
  obsCredentials,
  logos,
  onSaveProfile,
}: UseObsConnectionLogosArgs) {
  const generateUploadUrl = useMutation(api.streamObsLogos.generateStreamLogoUploadUrl);
  const appendLogo = useMutation(api.streamObsLogos.appendStreamLogo);
  const updateObsName = useMutation(api.streamObsLogos.updateStreamLogoObsImageSourceName);
  const removeLogo = useMutation(api.streamObsLogos.removeStreamLogo);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [wiringId, setWiringId] = useState<string | null>(null);
  const [wireErrorById, setWireErrorById] = useState<Record<string, string | null>>({});
  const [nameById, setNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    setNameById((prev) => {
      const next = { ...prev };
      for (const L of logos) {
        if (next[L.id] === undefined) next[L.id] = L.obsImageSourceName;
      }
      return next;
    });
  }, [logos]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!trimmedConnection) return;
      setUploadError(null);
      setUploading(true);
      try {
        const postUrl = await generateUploadUrl({
          email: emailNormalized,
          connectionName: trimmedConnection,
        });
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        const json = (await res.json()) as { storageId?: string };
        if (!res.ok || !json.storageId) throw new Error("Upload failed");
        await appendLogo({
          email: emailNormalized,
          connectionName: trimmedConnection,
          storageId: json.storageId as Id<"_storage">,
          fileName: file.name,
          logoId: crypto.randomUUID(),
        });
        await onSaveProfile();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Upload failed — try saving the connection profile first.";
        setUploadError(msg);
      } finally {
        setUploading(false);
      }
    },
    [appendLogo, emailNormalized, generateUploadUrl, onSaveProfile, trimmedConnection]
  );

  const wireLogo = useCallback(
    async (logo: StreamLogoRowUi) => {
      if (!obsCredentials || !connected || !trimmedConnection) return;
      const inputName = (nameById[logo.id] ?? logo.obsImageSourceName).trim();
      if (!inputName) {
        setWireErrorById((s) => ({ ...s, [logo.id]: "OBS image source name is required." }));
        return;
      }
      const fileUrl = logo.url;
      if (!fileUrl) {
        setWireErrorById((s) => ({ ...s, [logo.id]: "File URL is not available yet." }));
        return;
      }
      setWiringId(logo.id);
      setWireErrorById((s) => ({ ...s, [logo.id]: null }));
      try {
        await onSaveProfile();
        await updateObsName({
          email: emailNormalized,
          connectionName: trimmedConnection,
          logoId: logo.id,
          obsImageSourceName: inputName,
        });
        const res = await fetch("/api/stream/obs/set-image-source-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            host: obsCredentials.host,
            port: obsCredentials.port,
            password: obsCredentials.password,
            inputName,
            file: fileUrl,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
      } catch (err) {
        setWireErrorById((s) => ({
          ...s,
          [logo.id]: err instanceof Error ? err.message : "Could not update OBS.",
        }));
      } finally {
        setWiringId(null);
      }
    },
    [
      connected,
      emailNormalized,
      nameById,
      obsCredentials,
      onSaveProfile,
      trimmedConnection,
      updateObsName,
    ]
  );

  const removeLogoById = useCallback(
    async (logoId: string) => {
      if (!trimmedConnection) return;
      try {
        await removeLogo({
          email: emailNormalized,
          connectionName: trimmedConnection,
          logoId,
        });
      } catch {
        /* query reconciles */
      }
    },
    [emailNormalized, removeLogo, trimmedConnection]
  );

  return {
    uploading,
    uploadError,
    wiringId,
    wireErrorById,
    nameById,
    setNameById,
    uploadFile,
    wireLogo,
    removeLogoById,
  };
}
