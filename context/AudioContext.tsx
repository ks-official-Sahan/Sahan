"use client";
import { createContext, useState, useContext, useEffect, useRef } from "react";

type AudioContextType = {
  isPlaying: boolean;
  toggleAudio: () => void;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

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

    const savedIsPlaying = localStorage.getItem("isPlaying");
    const savedCurrentTime = localStorage.getItem("currentTime");

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      localStorage.setItem("currentTime", audio.currentTime.toString());
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    if (savedIsPlaying === "true") {
      audio.currentTime = savedCurrentTime ? parseFloat(savedCurrentTime) : 0;

      // Autoplay can be blocked by the browser; fall back to paused.
      audio.play().catch(() => {
        setIsPlaying(false);
        localStorage.setItem("isPlaying", "false");
      });
    }

    return () => {
      // Store the current time and play state before unmounting
      localStorage.setItem("currentTime", audio.currentTime.toString());
      localStorage.setItem("isPlaying", isPlayingRef.current.toString());
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audioRef.current = null;
    };
  }, []);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      localStorage.setItem("isPlaying", "false");
    } else {
      audio.play().catch(() => {
        // Handle case where audio fails to play
      });
      localStorage.setItem("isPlaying", "true");
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
