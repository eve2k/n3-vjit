// Text-to-Speech utility for Japanese language
// Uses Web Speech API with ja-JP language

let currentUtterance = null;

/**
 * Speak Japanese text using Web Speech API
 * @param {string} text - Japanese text to speak
 * @param {number} rate - Speech rate (0.5 to 2.0, default 0.9)
 * @param {Function} onEnd - Callback when speech ends
 */
export const speakJapanese = (text, rate = 0.9, onEnd = null) => {
  if (!window.speechSynthesis) {
    console.warn('Web Speech API is not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Try to find a Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find(v => v.lang === 'ja-JP') ||
                        voices.find(v => v.lang.startsWith('ja'));
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
  }

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
};

/**
 * Stop any currently playing speech
 */
export const stopSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
};

/**
 * Check if speech synthesis is currently speaking
 * @returns {boolean}
 */
export const isSpeaking = () => {
  return window.speechSynthesis ? window.speechSynthesis.speaking : false;
};

/**
 * Preload voices (should be called on app init)
 */
export const preloadVoices = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    // Some browsers need the onvoiceschanged event
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }
};
