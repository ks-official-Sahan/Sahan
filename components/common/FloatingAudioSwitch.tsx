"use client";
import React, { useEffect, useState } from 'react';
import Wave from 'react-wavify';
import { motion } from "framer-motion";
import { cn } from '@/lib/utils';

const FloatingAudioSwitch = () => {
  const [bgSound, setBgSound] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/aud/cts.mp3");
    audio.loop = true;
    audio.volume = 0.2;
    setBgSound(audio);
  }, []);

  const toggleAudio = () => {
    if (bgSound) {
      if (isPlaying) {
        bgSound.pause();
      } else {
        bgSound.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const glowVariants = {
    playing: { scale: 0.8, opacity: 0.5, transition: { repeat: Infinity, duration: 0.5, yoyo: Infinity } },
    paused: { scale: 1, opacity: 0.4 }
  };

  return (
    <div className='fixed bottom-8 right-10 z-[2000]'>
      <div className='flex items-center gap-4'>
        <motion.div className='text-[12px] font-medium opacity-80 '>
          AUDIO <motion.span className='text-lime-500'>{isPlaying ? "ON" : "OFF"}</motion.span>
        </motion.div>
        <div 
          onClick={toggleAudio} 
          className={cn(
            "cursor-pointer relative rounded-full overflow-hidden border backdrop-blur-sm hover:shadow-[inset_0_0_8px_4px_rgba(132,204,22,0.4)] hover:border-lime-500 hover:scale-[98%] transition-shadow duration-300",
            
          )}
        >
          {/* Motion div for the inner glow */}
          <motion.div
            variants={glowVariants}
            animate={isPlaying ? "playing" : "paused"}
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: isPlaying?'rgba(132,204,22,0.4)':"", 
            }}
          />
          <Wave 
            fill='#84cc16'
            paused={!isPlaying}
            style={{ display: 'flex', width: 40, height: 40, borderRadius: 100 }}
            options={{
              amplitude: 15,
              speed: 0.3,
              points: 3
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FloatingAudioSwitch;
