export function speak(text, { rate = 0.92 } = {}) {
  if (!text || typeof speechSynthesis === "undefined") return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    const voices = speechSynthesis.getVoices();
    const en =
      voices.find((v) => v.lang.toLowerCase() === "en-us") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (en) u.voice = en;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function stopSpeak() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
