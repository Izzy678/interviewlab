import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ── Types ─────────────────────────────────────────────── */

export type CheckState = "checking" | "ready" | "error";

export interface MicResult {
  state: CheckState;
  quiet?: boolean;
  error?: string;
}

export interface NetworkResult {
  state: CheckState;
  error?: string;
}

export interface JoinChecks {
  mic: MicResult;
  network: NetworkResult;
  /** True while at least one probe is still running */
  checking: boolean;
  /** Re-run all probes */
  recheck: () => void;
}

/* ── Options ────────────────────────────────────────────── */

interface UseJoinChecksOptions {
  /** When false the hook is disabled (e.g. phase left idle) */
  enabled: boolean;
  /** When false the mic probe is skipped (text mode) */
  includeMic: boolean;
}

/* ── Constants ─────────────────────────────────────────── */

/** RMS threshold below which we warn the mic might be muted. */
const RMS_SILENT_THRESHOLD = 0.002;
/** How long to collect audio levels (ms). */
const PROBE_DURATION_MS = 1200;

/* ── Network probe ─────────────────────────────────────── */

async function probeNetwork(): Promise<NetworkResult> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      /* status 0 typically signals a transport/network failure in supabase-js */
      if (error.status === 0 || /fetch|network|failed|abort/i.test(error.message)) {
        return {
          state: "error",
          error:
            "Can't reach InterviewLab's servers. Check your internet connection and try again.",
        };
      }
      return {
        state: "error",
        error: "Your session may have expired. Please sign out and sign in again.",
      };
    }

    if (!data?.user) {
      return {
        state: "error",
        error: "You're not signed in. Open the sidebar and sign in again.",
      };
    }

    return { state: "ready" };
  } catch (err) {
    return {
      state: "error",
      error:
        err instanceof Error && err.name === "AbortError"
          ? "Network check timed out. Try again."
          : "Network check failed unexpectedly. Try again.",
    };
  }
}

/* ── Mic probe ─────────────────────────────────────────── */

async function probeMic(): Promise<MicResult> {
  /* 1. Browser support */
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      state: "error",
      error: "This browser doesn't support microphone access. Switch to text mode.",
    };
  }

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;

  try {
    /* 2. Acquire the mic */
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    /* 3. AudioContext level analysis (best-effort) */
    audioCtx = new AudioContext();

    if (audioCtx.state !== "running") {
      try {
        await audioCtx.resume();
      } catch {
        /* Autoplay policy can block resume without a user gesture — skip analysis */
      }
    }

    let quiet: boolean | undefined;

    if (audioCtx.state === "running") {
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const data = new Float32Array(analyser.fftSize);
      let peakRms = 0;
      const start = performance.now();

      await new Promise<void>((resolve) => {
        const read = () => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
          }
          const rms = Math.sqrt(sum / data.length);
          if (rms > peakRms) peakRms = rms;
          if (performance.now() - start >= PROBE_DURATION_MS) {
            resolve();
          } else {
            requestAnimationFrame(read);
          }
        };
        read();
      });

      quiet = peakRms < RMS_SILENT_THRESHOLD;
      source.disconnect();
      analyser.disconnect();
    }

    return { state: "ready", quiet };
  } catch (err) {
    const message =
      err instanceof DOMException
        ? err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone access was denied. Allow access in your browser or system settings, then re-check."
          : err.name === "NotFoundError"
            ? "No microphone found. Plug one in or switch to text mode."
            : `Microphone error: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Microphone check failed.";

    return { state: "error", error: message };
  } finally {
    /* Always release the mic so begin() can re-acquire it cleanly */
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
    }
  }
}

/* ── Hook ──────────────────────────────────────────────── */

export function useJoinChecks({
  enabled,
  includeMic,
}: UseJoinChecksOptions): JoinChecks {
  const [mic, setMic] = useState<MicResult>({ state: "checking" });
  const [network, setNetwork] = useState<NetworkResult>({ state: "checking" });
  const runIdRef = useRef(0);

  const run = useCallback(() => {
    if (!enabled) return;

    const runId = ++runIdRef.current;
    setMic({ state: "checking" });
    setNetwork({ state: "checking" });

    if (includeMic) {
      probeMic().then((result) => {
        if (runId !== runIdRef.current) return;
        setMic(result);
      });
    } else {
      /* Text mode — mic is not needed, mark as ready so it never blocks Join */
      setMic({ state: "ready" });
    }

    probeNetwork().then((result) => {
      if (runId !== runIdRef.current) return;
      setNetwork(result);
    });
  }, [enabled, includeMic]);

  useEffect(() => {
    run();
    return () => {
      /* Invalidate any in-flight probes when deps change or on unmount */
      runIdRef.current += 1;
    };
  }, [run]);

  const checking = mic.state === "checking" || network.state === "checking";
  const recheck = useCallback(() => run(), [run]);

  return { mic, network, checking, recheck };
}