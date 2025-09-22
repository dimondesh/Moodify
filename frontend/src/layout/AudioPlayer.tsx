// src/layout/AudioPlayer.tsx

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "../stores/usePlayerStore";
import { webAudioService, useAudioSettingsStore } from "../lib/webAudio";
import { useAuthStore } from "@/stores/useAuthStore";
import { axiosInstance } from "@/lib/axios";
import { useMusicStore } from "@/stores/useMusicStore";
import { useOfflineStore } from "@/stores/useOfflineStore";

// Расширяем интерфейс Window для поддержки webkitAudioContext
interface CustomWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(
    null
  );
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const listenRecordedRef = useRef(false);

  const {
    currentSong,
    isPlaying,
    playNext,
    repeatMode,
    masterVolume,
    setCurrentTime,
    setDuration,
    currentTime,
    seekVersion,
    togglePlay,
  } = usePlayerStore();

  const { playbackRateEnabled, playbackRate } = useAudioSettingsStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  // Инициализация Web Audio API
  useEffect(() => {
    const AudioContextClass =
      window.AudioContext || (window as CustomWindow).webkitAudioContext;
    if (!AudioContextClass) {
      console.error("Web Audio API is not supported.");
      return;
    }

    if (!audioContextRef.current) {
      const context = new AudioContextClass();
      audioContextRef.current = context;
      masterGainNodeRef.current = context.createGain();
      webAudioService.init(
        context,
        masterGainNodeRef.current,
        context.destination
      );
    }

    const audioEl = audioRef.current;
    if (audioEl && audioContextRef.current && !mediaElementSourceRef.current) {
      mediaElementSourceRef.current =
        audioContextRef.current.createMediaElementSource(audioEl);
      if (masterGainNodeRef.current) {
        mediaElementSourceRef.current.connect(masterGainNodeRef.current);
      }
    }

    const resumeContext = () => {
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }
    };
    document.addEventListener("click", resumeContext, { once: true });

    return () => {
      document.removeEventListener("click", resumeContext);
    };
  }, []);

  // Управление HLS потоком при смене трека
  useEffect(() => {
    if (!audioRef.current) return;

    const audioEl = audioRef.current;

    if (currentSong && currentSong.hlsUrl) {
      if (lastSongIdRef.current === currentSong._id) return;
      lastSongIdRef.current = currentSong._id;

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(currentSong.hlsUrl);
        hls.attachMedia(audioEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (usePlayerStore.getState().isPlaying) {
            audioEl.play().catch((e) => console.error("Autoplay failed", e));
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data.details);
          }
        });
      } else if (audioEl.canPlayType("application/vnd.apple.mpegurl")) {
        audioEl.src = currentSong.hlsUrl;
        if (usePlayerStore.getState().isPlaying) {
          audioEl.play().catch((e) => console.error("Autoplay failed", e));
        }
      }
      listenRecordedRef.current = false;
    } else {
      lastSongIdRef.current = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audioEl.src = "";
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSong]);

  // Управление Play/Pause
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (isPlaying) {
      audioEl.play().catch((e) => console.error("Play command failed", e));
    } else {
      audioEl.pause();
    }
  }, [isPlaying]);

  // Управление перемоткой
  useEffect(() => {
    if (
      audioRef.current &&
      Math.abs(audioRef.current.currentTime - currentTime) > 1
    ) {
      audioRef.current.currentTime = currentTime;
    }
  }, [seekVersion, currentTime]);

  // Управление громкостью и скоростью
  useEffect(() => {
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = masterVolume / 100;
    }
    if (audioRef.current) {
      const currentRate = playbackRateEnabled ? playbackRate : 1.0;
      audioRef.current.playbackRate = currentRate;
    }
  }, [masterVolume, playbackRate, playbackRateEnabled]);

  // Запись прослушивания
  useEffect(() => {
    if (
      isPlaying &&
      user &&
      !user.isAnonymous &&
      currentSong &&
      currentSong._id &&
      currentTime >= (currentSong.duration || 0) / 3 &&
      !listenRecordedRef.current &&
      !isOffline
    ) {
      listenRecordedRef.current = true;
      axiosInstance
        .post(`/songs/${currentSong._id}/listen`)
        .then(() => {
          console.log(`Listen recorded for ${currentSong.title}`);
          useMusicStore.getState().fetchRecentlyListenedSongs();
        })
        .catch((e) => {
          listenRecordedRef.current = false;
          console.error("Failed to record listen", e);
        });
    }
  }, [currentTime, isPlaying, currentSong, user, isOffline]);

  // Event Listeners для <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime, true);
    const handleDurationChange = () =>
      setDuration(audio.duration, audio.duration);
    const handleEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };
    const handlePlay = () =>
      !usePlayerStore.getState().isPlaying && togglePlay();
    const handlePause = () =>
      usePlayerStore.getState().isPlaying && togglePlay();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("playing", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("playing", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [setCurrentTime, setDuration, playNext, repeatMode, togglePlay]);

  return (
    <audio
      ref={audioRef}
      playsInline
      style={{ display: "none" }}
      crossOrigin="anonymous"
    />
  );
};

export default AudioPlayer;
