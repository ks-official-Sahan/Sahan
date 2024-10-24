"use client";
import { createContext, useState, useContext, useEffect } from "react";

type AudioContextType = {
  isPlaying: boolean;
  toggleAudio: () => void;
  bgSound: HTMLAudioElement | null;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [bgSound, setBgSound] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load audio state and currentTime from localStorage on mount
  useEffect(() => {
    const audio = new Audio("/aud/cts.mp3");
    audio.loop = true;
    audio.volume = 0.2;
    setBgSound(audio);

    const savedIsPlaying = localStorage.getItem("isPlaying");
    const savedCurrentTime = localStorage.getItem("currentTime");

    // Event listeners to handle audio play/pause and update the `isPlaying` state
    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    if (savedIsPlaying === "true") {
      const time = savedCurrentTime ? parseFloat(savedCurrentTime) : 0;
      audio.currentTime = time;

      // Attempt to play the audio and handle case where it doesn't work
      audio.play().catch(() => {
        // If the audio fails to play (e.g., due to browser restrictions), set the state to false
        setIsPlaying(false);
        localStorage.setItem("isPlaying", "false");
      });
    }

    // Clean up on component unmount
    return () => {
      // Store the current time and play state before unmounting
      if (audio) {
        localStorage.setItem("currentTime", audio.currentTime.toString());
        localStorage.setItem("isPlaying", isPlaying.toString());
        audio.pause();
      }
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  // Store the currentTime in localStorage whenever audio time updates
  useEffect(() => {
    if (bgSound) {
      const handleTimeUpdate = () => {
        localStorage.setItem("currentTime", bgSound.currentTime.toString());
      };
      bgSound.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        bgSound.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }
  }, [bgSound]);

  const toggleAudio = () => {
    if (bgSound) {
      if (isPlaying) {
        bgSound.pause();
        localStorage.setItem("isPlaying", "false");
      } else {
        bgSound.play().catch(() => {
          // Handle case where audio fails to play
        });
        localStorage.setItem("isPlaying", "true");
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <AudioContext.Provider value={{ isPlaying, toggleAudio, bgSound }}>
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
