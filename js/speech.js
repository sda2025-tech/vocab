function pickVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /karen/i.test(v.name) && /^en/i.test(v.lang)) ||
    voices.find((v) => /samantha|moira|tessa|kathy|susan|victoria|fiona/i.test(v.name) && /^en/i.test(v.lang)) ||
    voices.find((v) => v.lang.toLowerCase() === "en-au") ||
    voices.find((v) => v.lang.toLowerCase() === "en-gb") ||
    voices.find((v) => v.lang.toLowerCase() === "en-us") ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    null
  );
}

export function speak(text, { rate = 0.9 } = {}) {
  if (!text || typeof speechSynthesis === "undefined") return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-AU";
    u.rate = rate;
    const voice = pickVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || "en-AU";
    }
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function stopSpeak() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
