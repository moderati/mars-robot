"use client";

import { useEffect, useRef } from "react";

const KIOSK_SOUNDS = {
  start: { src: "/sounds/start.wav", volume: 0.55 },
  stop: { src: "/sounds/stop.wav", volume: 0.45 },
} as const;

type KioskBleep = keyof typeof KIOSK_SOUNDS;

type AudioMap = Record<KioskBleep, HTMLAudioElement | null>;

export function useKioskSounds() {
  const audioRef = useRef<AudioMap>({
    start: null,
    stop: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextAudio: AudioMap = {
      start: null,
      stop: null,
    };

    for (const [name, config] of Object.entries(KIOSK_SOUNDS) as Array<
      [KioskBleep, (typeof KIOSK_SOUNDS)[KioskBleep]]
    >) {
      const audio = new Audio(config.src);
      audio.preload = "auto";
      audio.volume = config.volume;
      nextAudio[name] = audio;
    }

    audioRef.current = nextAudio;

    return () => {
      for (const audio of Object.values(audioRef.current)) {
        if (!audio) continue;
        audio.pause();
        audio.src = "";
      }
      audioRef.current = { start: null, stop: null };
    };
  }, []);

  function play(name: KioskBleep) {
    const audio = audioRef.current[name];
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore playback failures when browser autoplay/user-gesture policy blocks audio.
    });
  }

  return {
    playStart: () => play("start"),
    playStop: () => play("stop"),
  };
}
