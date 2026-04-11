// offscreen.js

async function startWakeWordDetection() {
  try {
    // 1. Mic permission lo
    await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Mic access granted to SARA's hidden listener.");

    // 2. Web Speech API use karo (Free, no API key needed)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      
      console.log("Heard:", transcript);

      if (transcript.includes("hey sara") || transcript.includes("sara wake up")) {
        console.log("Hey SARA Suna gaya!");
        // Background script ko batao ki wake word mil gaya
        chrome.runtime.sendMessage({ action: 'WAKE_WORD_DETECTED' });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      console.error("Speech recognition error", event.error);
    };

    recognition.onend = () => {
      // Keep listening continuously
      setTimeout(() => {
        try { recognition.start(); } catch(e){}
      }, 1000);
    };

    recognition.start();

  } catch (err) {
    console.error("SARA Mic Error:", err);
  }
}

// Chalu karo
startWakeWordDetection();
