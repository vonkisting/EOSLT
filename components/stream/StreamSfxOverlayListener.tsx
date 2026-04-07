"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { streamSfxMaxPlayMs, streamSfxPlayApiUrl } from "@/lib/stream-sfx-basename";

type StreamSfxOverlayListenerProps = {
  overlayKey: string;
};

/**
 * Subscribes to Convex sound cues and plays matching files from `/public/stream-sfx/` via the play API.
 */
export function StreamSfxOverlayListener({ overlayKey }: StreamSfxOverlayListenerProps) {
  const cue = useQuery(api.streamObsProfiles.getSfxCueByOverlayKey, {
    key: overlayKey.trim(),
  });
  /** `undefined` = not initialized; `null` = profile has no cue yet; number = last seen seq */
  const prevSeqRef = useRef<number | null | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAfterMsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stopAfterMsRef.current) {
      clearTimeout(stopAfterMsRef.current);
      stopAfterMsRef.current = null;
    }

    if (cue === undefined) return;

    if (cue === null) {
      if (prevSeqRef.current === undefined) prevSeqRef.current = null;
      return;
    }

    const { soundId, seq } = cue;
    const prevSeq = prevSeqRef.current;

    let shouldPlay = false;
    if (prevSeq === undefined) {
      prevSeqRef.current = seq;
      shouldPlay = false;
    } else if (prevSeq === null) {
      shouldPlay = true;
      prevSeqRef.current = seq;
    } else if (seq > prevSeq) {
      shouldPlay = true;
      prevSeqRef.current = seq;
    } else {
      prevSeqRef.current = seq;
    }

    if (!shouldPlay) return;

    const path = streamSfxPlayApiUrl(soundId);
    if (!path) return;

    const el = audioRef.current;
    if (!el) return;
    el.src = path;
    el.currentTime = 0;
    void el.play().catch(() => {});

    const maxMs = streamSfxMaxPlayMs(soundId);
    if (maxMs != null) {
      stopAfterMsRef.current = setTimeout(() => {
        stopAfterMsRef.current = null;
        el.pause();
        el.currentTime = 0;
      }, maxMs);
    }

    return () => {
      if (stopAfterMsRef.current) {
        clearTimeout(stopAfterMsRef.current);
        stopAfterMsRef.current = null;
      }
    };
  }, [cue]);

  return <audio ref={audioRef} preload="auto" className="hidden" aria-hidden playsInline />;
}
