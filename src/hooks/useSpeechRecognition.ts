import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ── Speechmatics WebSocket message types ───────────────── */

interface SpeechmaticsAlternative {
  content: string;
  confidence?: number;
}

interface SpeechmaticsResult {
  alternatives: SpeechmaticsAlternative[];
  start_time: number;
  end_time: number;
  type: "word" | "punctuation";
}

interface SpeechmaticsMessage {
  message: string;
  results?: SpeechmaticsResult[];
  channel?: string;
}

/* ── Hook options ───────────────────────────────────────── */

interface UseSpeechRecognitionOptions {
  /** Called when the candidate's turn ends (silence detected). */
  onTurnComplete: (text: string, hadSpeech: boolean) => void;
  /** Silence after the last word that ends the turn (ms). */
  endOfSpeechMs?: number;
  /** No speech at all for this long → emit an empty turn (ms). */
  noSpeechMs?: number;
  /** Hard cap for a single candidate turn (ms). */
  maxTurnMs?: number;
}

/* ── Hook ───────────────────────────────────────────────── */

/**
 * Real-time speech recognition via Speechmatics.
 *
 * The WebSocket + mic session is opened once (`startSession`) and stays open
 * for the whole interview. Audio is only fed to Speechmatics while
 * `startCapture` is active, which lets the AI interviewer speak without being
 * transcribed. Turn-taking is handled with silence detection: when no new
 * words arrive for `endOfSpeechMs`, the accumulated transcript is handed to
 * `onTurnComplete`.
 */
export function useSpeechRecognition({
  onTurnComplete,
  endOfSpeechMs = 2000,
  noSpeechMs = 15000,
  maxTurnMs = 60000,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false); // capture active
  const [speechActive, setSpeechActive] = useState(false); // words detected
  const [liveCaption, setLiveCaption] = useState(""); // current turn text
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const captureActiveRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const lastSpeechAtRef = useRef(0);
  const turnStartedAtRef = useRef(0);
  const onTurnCompleteRef = useRef(onTurnComplete);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    onTurnCompleteRef.current = onTurnComplete;
  }, [onTurnComplete]);

  const completeTurn = useCallback((text: string, hadSpeech: boolean) => {
    captureActiveRef.current = false;
    setIsListening(false);
    setSpeechActive(false);
    finalRef.current = "";
    interimRef.current = "";
    setLiveCaption("");
    onTurnCompleteRef.current(text, hadSpeech);
  }, []);

  /* Silence watchdog — checks every 500ms while capturing */
  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (!captureActiveRef.current) return;
      const now = Date.now();
      const sinceSpeech = now - lastSpeechAtRef.current;
      const sinceStart = now - turnStartedAtRef.current;

      if (sinceSpeech >= endOfSpeechMs) {
        const final = finalRef.current.trim();
        if (final) {
          completeTurn(final, true);
        } else if (sinceStart >= noSpeechMs) {
          completeTurn("", false);
        }
      } else if (sinceStart >= maxTurnMs && finalRef.current.trim()) {
        completeTurn(finalRef.current.trim(), true);
      }
    }, 500);

    return () => window.clearInterval(watchdog);
  }, [endOfSpeechMs, noSpeechMs, maxTurnMs, completeTurn]);

  /** Open the WebSocket + mic pipeline. Call once per session (after a user gesture). */
  const startSession = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError("Voice input is not available in this browser.");
      return false;
    }
    await endSessionRef.current();

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) {
        setError("You must be signed in to use voice input.");
        return false;
      }

      const tokenRes = await supabase.functions.invoke("speechmatics-token", {
        method: "POST",
      });

      if (tokenRes.error || !tokenRes.data?.token) {
        setError(
          tokenRes.error?.message || "Failed to get a speech token. Try again.",
        );
        return false;
      }

      const { token } = tokenRes.data as { token: string };
      const ws = new WebSocket(`wss://eu.rt.speechmatics.com/v2?jwt=${token}`);
      wsRef.current = ws;

      return await new Promise<boolean>((resolve) => {
        ws.onopen = async () => {
          try {
            ws.send(
              JSON.stringify({
                message: "StartRecognition",
                audio_format: {
                  type: "raw",
                  encoding: "pcm_s16le",
                  sample_rate: 16000,
                  channels: 1,
                },
                transcription_config: {
                  language: "en",
                  max_delay: 1.5,
                  enable_partials: true,
                },
              }),
            );

            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                sampleRate: 48000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
              },
            });
            streamRef.current = stream;

            const audioCtx = new AudioContext({ sampleRate: 48000 });
            audioCtxRef.current = audioCtx;
            if (audioCtx.state === "suspended") {
              await audioCtx.resume().catch(() => {});
            }

            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (event) => {
              if (!captureActiveRef.current) return;
              const input = event.inputBuffer.getChannelData(0);
              const inputLen = input.length;
              const inputRate = audioCtx.sampleRate;
              const targetSampleRate = 16000;
              const ratio = inputRate / targetSampleRate;
              const outputLen = Math.floor(inputLen / ratio);
              const output = new Float32Array(outputLen);

              for (let i = 0; i < outputLen; i++) {
                const srcIdx = Math.round(i * ratio);
                output[i] = input[Math.min(srcIdx, inputLen - 1)];
              }

              const pcm = new Int16Array(outputLen);
              for (let i = 0; i < outputLen; i++) {
                const s = Math.max(-1, Math.min(1, output[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(pcm.buffer);
              }
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);

            setError(null);
            resolve(true);
          } catch (micErr) {
            const msg =
              micErr instanceof Error
                ? micErr.message
                : "Microphone access denied.";
            setError(msg);
            try {
              ws.close();
            } catch { /* noop */ }
            resolve(false);
          }
        };

        ws.onmessage = (event) => {
          try {
            if (typeof event.data !== "string") return;
            const msg: SpeechmaticsMessage = JSON.parse(event.data);
            if (!captureActiveRef.current) return;

            if (msg.message === "AddPartialTranscript" && msg.results) {
              const text = msg.results
                .filter((r) => r.type !== "punctuation")
                .map((r) => r.alternatives?.[0]?.content || "")
                .join(" ");
              if (text.trim()) {
                lastSpeechAtRef.current = Date.now();
                setSpeechActive(true);
              }
              interimRef.current = text;
              setLiveCaption(
                finalRef.current
                  ? `${finalRef.current} ${text}`.trim()
                  : text,
              );
            } else if (msg.message === "AddTranscript" && msg.results) {
              const text = msg.results
                .filter((r) => r.type !== "punctuation")
                .map((r) => r.alternatives?.[0]?.content || "")
                .join(" ");
              if (text.trim()) {
                lastSpeechAtRef.current = Date.now();
                finalRef.current +=
                  (finalRef.current ? " " : "") + text;
                setSpeechActive(true);
              }
              interimRef.current = "";
              setLiveCaption(finalRef.current);
            }
          } catch { /* ignore malformed frames */ }
        };

        ws.onerror = () => {
          setError("Speech recognition connection failed.");
          captureActiveRef.current = false;
          setIsListening(false);
          setSpeechActive(false);
          resolve(false);
        };

        ws.onclose = () => {
          captureActiveRef.current = false;
          setIsListening(false);
          setSpeechActive(false);
        };
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start speech recognition.";
      setError(msg);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  /** Tear down the WebSocket + mic pipeline. */
  const endSession = useCallback(async () => {
    captureActiveRef.current = false;
    setIsListening(false);
    setSpeechActive(false);

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ message: "EndOfStream", last_seq_no: null }),
          );
        }
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    if (processorRef.current && sourceRef.current) {
      try {
        processorRef.current.disconnect();
        sourceRef.current.disconnect();
      } catch { /* already disconnected */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    processorRef.current = null;
    sourceRef.current = null;
    finalRef.current = "";
    interimRef.current = "";
    setLiveCaption("");
  }, []);

  const endSessionRef = useRef(endSession);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  /** Begin feeding mic audio + start turn detection. */
  const startCapture = useCallback(() => {
    if (!wsRef.current || !audioCtxRef.current) return;
    audioCtxRef.current.resume().catch(() => {});
    captureActiveRef.current = true;
    finalRef.current = "";
    interimRef.current = "";
    lastSpeechAtRef.current = Date.now();
    turnStartedAtRef.current = Date.now();
    setLiveCaption("");
    setSpeechActive(false);
    setError(null);
    setIsListening(true);
  }, []);

  /** Stop feeding mic audio (e.g. mute, or AI is speaking). */
  const pauseCapture = useCallback(() => {
    captureActiveRef.current = false;
    setIsListening(false);
    setSpeechActive(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      void endSession();
    };
  }, [endSession]);

  return {
    supported,
    error,
    isListening,
    speechActive,
    liveCaption,
    startSession,
    endSession,
    startCapture,
    pauseCapture,
    clearError,
  };
}