"use client";
import { createContext, useState, useContext, useEffect, useRef } from "react";

type AudioContextType = {
  isPlaying: boolean;
  toggleAudio: () => void;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Storage can throw (site data blocked, some private modes). The audio state
// is a nicety, and this provider wraps the whole site, so a storage failure
// must never break rendering.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; playback itself is unaffected.
  }
}

/** timeupdate fires about four times a second; persist the position less often. */
const SAVE_POSITION_EVERY_MS = 5_000;

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  // The element is mutable (currentTime, play/pause), so it lives in a ref,
  // not state. Created in the effect below: browser-only, never during SSR.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Create the element, restore playback state from localStorage, and wire
  // up play/pause/timeupdate listeners.
  useEffect(() => {
    const audio = new Audio("/aud/cts.mp3");
    audio.loop = true;
    audio.volume = 0.2;
    audioRef.current = audio;

    const savedIsPlaying = readStorage("isPlaying");
    const savedCurrentTime = readStorage("currentTime");

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    let lastSaved = 0;
    const savePosition = () => writeStorage("currentTime", audio.currentTime.toString());
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaved < SAVE_POSITION_EVERY_MS) return;
      lastSaved = now;
      savePosition();
    };
    // Unmount cleanup does not run when the tab closes; pagehide does.
    const handlePageHide = () => {
      savePosition();
      writeStorage("isPlaying", isPlayingRef.current.toString());
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    window.addEventListener("pagehide", handlePageHide);

    if (savedIsPlaying === "true") {
      audio.currentTime = savedCurrentTime ? parseFloat(savedCurrentTime) : 0;

      // Autoplay can be blocked by the browser; fall back to paused.
      audio.play().catch(() => {
        setIsPlaying(false);
        writeStorage("isPlaying", "false");
      });
    }

    return () => {
      // Store the current time and play state before unmounting
      writeStorage("currentTime", audio.currentTime.toString());
      writeStorage("isPlaying", isPlayingRef.current.toString());
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      window.removeEventListener("pagehide", handlePageHide);
      audioRef.current = null;
    };
  }, []);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      writeStorage("isPlaying", "false");
    } else {
      audio.play().catch(() => {
        // Handle case where audio fails to play
      });
      writeStorage("isPlaying", "true");
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <AudioContext.Provider value={{ isPlaying, toggleAudio }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
