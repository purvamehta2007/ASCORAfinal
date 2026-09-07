import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export function useVoice() {
  const recognitionRef = useRef(null);
  const isStartingRef = useRef(false);
  const mountedRef = useRef(true);

  const [supported, setSupported] = useState(Boolean(SpeechRecognition));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Initialize speech recognition
  // --------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (!SpeechRecognition) {
      setSupported(false);
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setSupported(true);

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!mountedRef.current) return;

      isStartingRef.current = false;
      setListening(true);
      setError("");
    };

    recognition.onresult = (event) => {
      if (!mountedRef.current) return;

      let finalText = "";
      let interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];

        if (result[0]) {
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
      }

      const text = `${finalText} ${interimText}`.trim();

      if (text) {
        setTranscript(text);
      }
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) return;

      console.error(
        "Speech recognition error:",
        event.error
      );

      isStartingRef.current = false;
      setListening(false);

      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          setError(
            "Microphone permission was denied. Please allow microphone access in Chrome."
          );
          break;

        case "no-speech":
          setError(
            "I didn't hear anything. Please try again."
          );
          break;

        case "audio-capture":
          setError(
            "No microphone was detected."
          );
          break;

        case "network":
          setError(
            "Speech recognition needs a network connection."
          );
          break;

        case "aborted":
          // Aborted is normally caused by stopping recognition.
          break;

        default:
          setError(
            `Voice error: ${event.error}`
          );
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;

      isStartingRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      mountedRef.current = false;
      isStartingRef.current = false;

      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      recognitionRef.current = null;

      // BUG FIX: cancel any in-flight speech synthesis on
      // unmount so the browser doesn't keep talking (or hold
      // a dangling utterance) after this component is gone.
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore - nothing to cancel.
        }
      }
    };
  }, []);

  // --------------------------------------------------
  // Start listening
  // --------------------------------------------------

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError(
        "Speech recognition is not supported in this browser."
      );
      return;
    }

    if (listening || isStartingRef.current) {
      return;
    }

    setTranscript("");
    setError("");

    try {
      isStartingRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      isStartingRef.current = false;

      console.log(
        "Speech recognition could not be started:",
        err
      );
    }
  }, [listening]);

  // --------------------------------------------------
  // Stop listening
  // --------------------------------------------------

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    isStartingRef.current = false;

    try {
      recognitionRef.current.stop();
    } catch {
      // Recognition may already be stopped.
    }
  }, []);

  // --------------------------------------------------
  // Clear transcript
  // --------------------------------------------------

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  // --------------------------------------------------
  // Text-to-speech
  //
  // BUG FIX: speak() now returns a Promise that resolves
  // only when the utterance has ACTUALLY finished playing
  // (onend), so callers can await real TTS completion
  // instead of guessing with a fixed timer. If synthesis
  // is unavailable or errors out, the promise still
  // resolves (rather than hanging forever) so a caller
  // awaiting it can move on gracefully - the error state
  // is still surfaced via `error` for the UI.
  // --------------------------------------------------

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (!text || !text.trim()) {
        resolve({ ok: false, reason: "empty-text" });
        return;
      }

      if (!("speechSynthesis" in window)) {
        setError(
          "Text-to-speech is not supported in this browser."
        );
        resolve({ ok: false, reason: "unsupported" });
        return;
      }

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(text);

      utterance.lang = "en-IN";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      let settled = false;

      const settle = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      utterance.onstart = () => {
        if (mountedRef.current) {
          setError("");
        }
      };

      utterance.onend = () => {
        settle({ ok: true });
      };

      utterance.onerror = (event) => {
        // "interrupted"/"canceled" happen when we (or a new
        // speak() call) intentionally cancel this utterance -
        // that's not a real failure, so don't surface it as one.
        const benign =
          event.error === "interrupted" ||
          event.error === "canceled";

        if (!benign && mountedRef.current) {
          console.error(
            "Speech synthesis error:",
            event.error
          );

          setError("Unable to play the voice response.");
        }

        settle({
          ok: benign,
          reason: event.error,
        });
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error(
          "Speech synthesis failed to start:",
          err
        );

        if (mountedRef.current) {
          setError("Unable to play the voice response.");
        }

        settle({ ok: false, reason: "start-failed" });
      }
    });
  }, []);

  // --------------------------------------------------
  // Stop speaking
  // --------------------------------------------------

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // --------------------------------------------------
  // Return API
  // --------------------------------------------------

  return {
    supported,
    listening,
    transcript,
    error,

    startListening,
    stopListening,
    clearTranscript,

    speak,
    stopSpeaking,
  };
}