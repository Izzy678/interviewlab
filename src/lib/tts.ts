/**
 * Text-to-speech helper built on the browser's speechSynthesis API.
 *
 * This keeps the voice interview fully functional with zero backend cost and
 * no additional secrets. To upgrade to a premium voice provider later, replace
 * `speak` with a call to an Edge Function that returns audio (e.g. ElevenLabs)
 * and play the returned audio element — no other code needs to change.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

export function ttsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length
    ? cachedVoices
    : ttsSupported()
      ? window.speechSynthesis.getVoices()
      : [];
  if (!voices.length) return null;

  const english = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("en")
  );
  const pool = english.length ? english : voices;

  // Prefer voices that sound the most natural
  const preferredNames = [
    "google us english",
    "natural",
    "neural",
    "aria",
    "jenny",
    "samantha",
    "zira",
    "daniel",
    "alex",
    "karen",
    "moira",
    "sonia",
    "tessa",
    "libby",
  ];
  for (const name of preferredNames) {
    const found = pool.find((v) => v.name.toLowerCase().includes(name));
    if (found) return found;
  }
  return pool.find((v) => v.default) ?? pool[0] ?? null;
}

/** Immediately stop any in-progress speech. */
export function stopSpeaking() {
  if (ttsSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak the given text aloud.
 * Resolves when playback finishes (or fails/errors) so callers can chain
 * "AI speaks → then start listening".
 */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.volume = 1;

    let settled = false;
    let kicker: number | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (kicker !== undefined) clearInterval(kicker);
      resolve();
    };

    // Chrome sometimes pauses long utterances mid-way; nudge it back.
    kicker = window.setInterval(() => {
      if (!settled && synth.speaking && synth.paused) {
        synth.resume();
      }
    }, 400);

    utterance.onend = finish;
    utterance.onerror = finish;

    synth.speak(utterance);
  });
}