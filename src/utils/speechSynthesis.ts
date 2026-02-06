export const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Optional: functionality to select a preferred voice
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices.find(voice => voice.lang.includes('en')) || null;

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
};
