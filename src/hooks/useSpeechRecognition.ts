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
  reason?: string;
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

export function useSpeechRecognition({
  onTurnComplete,
  endOfSpeechMs = 2000,
  noSpeechMs = 15000,
  maxTurnMs = 60000,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [liveCaption, setLiveCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);

  const captureActiveRef = useRef(false);
  const recognitionReadyRef = useRef(false);
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

      /* Combine finals + latest interim for the full turn text */
      const combined = [finalRef.current.trim(), interimRef.current.trim()]
        .filter(Boolean)
        .join(" ");

      if (sinceSpeech >= endOfSpeechMs) {
        if (combined) {
          completeTurn(combined, true);
        } else if (sinceStart >= noSpeechMs) {
          completeTurn("", false);
        }
      } else if (sinceStart >= maxTurnMs && combined) {
        completeTurn(combined, true);
      }
    }, 500);

    return () => window.clearInterval(watchdog);
  }, [endOfSpeechMs, noSpeechMs, maxTurnMs, completeTurn]);

  /** Open the WebSocket + mic pipeline. Call once after a user gesture. */
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
      recognitionReadyRef.current = false;

      return await new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          if (!recognitionReadyRef.current) {
            setError("Speech recognition timed out. Try again.");
            try { ws.close(); } catch { /* noop */ }
            resolve(false);
          }
        }, 10000);

        ws.onopen = async () => {
          try {
            ws.send(
              JSON.stringify({
                message: "StartRecognition",
                audio_format: {
                  type: "raw",
                  encoding: "pcm_s16le",
                  sample_rate: 16000,
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
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: false,
                autoGainControl: true,
              },
            });
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            if (audioCtx.state === "suspended") {
              await audioCtx.resume().catch(() => {});
            }

            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            /* Muted gain node — don't feed mic back to speakers */
            const muteGain = audioCtx.createGain();
            muteGain.gain.value = 0;
            muteGainRef.current = muteGain;

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
            processor.connect(muteGain);
            muteGain.connect(audioCtx.destination);

            setError(null);
            /* Don't resolve yet — wait for RecognitionStarted below */
          } catch (micErr) {
            clearTimeout(timeout);
            const msg =
              micErr instanceof Error
                ? micErr.message
                : "Microphone access denied.";
            setError(msg);
            try { ws.close(); } catch { /* noop */ }
            resolve(false);
          }
        };

        ws.onmessage = (event) => {
          try {
            if (typeof event.data !== "string") return;
            const msg: SpeechmaticsMessage = JSON.parse(event.data);

            /* Handle RecognitionStarted */
            if (msg.message === "RecognitionStarted") {
              clearTimeout(timeout);
              recognitionReadyRef.current = true;
              resolve(true);
              return;
            }

            /* Handle errors / warnings from Speechmatics */
            if (msg.message === "Error" || msg.message === "Warning") {
              const reason = msg.reason || msg.message;
              console.warn("[speechmatics]", msg.message, reason);
              if (msg.message === "Error") {
                setError(`Speech recognition error: ${reason}`);
                captureActiveRef.current = false;
                setIsListening(false);
              }
              return;
            }

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
              /* Show finals + latest interim combined in live caption */
              setLiveCaption(finalRef.current);
            }
          } catch { /* ignore malformed frames */ }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          setError("Speech recognition connection failed.");
          recognitionReadyRef.current = false;
          captureActiveRef.current = false;
          setIsListening(false);
          setSpeechActive(false);
          resolve(false);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          recognitionReadyRef.current = false;
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
    recognitionReadyRef.current = false;
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
        muteGainRef.current?.disconnect();
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
    muteGainRef.current = null;
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
    if (!recognitionReadyRef.current) {
      setError("Speech recognition is not ready yet. Try again.");
      return;
    }
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