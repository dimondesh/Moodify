/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/layout/AudioPlayer.tsx
import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "../stores/usePlayerStore";
import { webAudioService, useAudioSettingsStore } from "../lib/webAudio";
import { useAuthStore } from "@/stores/useAuthStore";
import { axiosInstance } from "@/lib/axios";
import { useMusicStore } from "@/stores/useMusicStore";
import { useOfflineStore } from "@/stores/useOfflineStore";

const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

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
  } = usePlayerStore();

  const { playbackRateEnabled, playbackRate } = useAudioSettingsStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  // --- ИЗМЕНЕНИЕ 1: Инициализация Web Audio API и плеера ---
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    // Инициализация AudioContext один раз
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      } else {
        console.error("Web Audio API is not supported in this browser.");
        return;
      }
    }
    const audioContext = audioContextRef.current;

    // Создаем мост между <audio> и Web Audio API
    if (!mediaSourceNodeRef.current) {
      mediaSourceNodeRef.current =
        audioContext.createMediaElementSource(audioEl);
      // Инициализируем наш сервис эффектов
      webAudioService.init(
        audioContext,
        mediaSourceNodeRef.current,
        audioContext.destination
      );
      console.log("AudioPlayer initialized with Web Audio API bridge.");
    }

    // Функция для "пробуждения" аудиоконтекста
    const resumeContext = () => {
      if (audioContext.state === "suspended") {
        audioContext
          .resume()
          .catch((e) => console.error("AudioContext resume failed:", e));
      }
    };

    // Вешаем обработчики для возобновления контекста
    document.addEventListener("click", resumeContext, { once: true });
    document.addEventListener("keydown", resumeContext, { once: true });
    document.addEventListener("touchstart", resumeContext, { once: true });

    return () => {
      document.removeEventListener("click", resumeContext);
      document.removeEventListener("keydown", resumeContext);
      document.removeEventListener("touchstart", resumeContext);
    };
  }, []);

  // --- ИЗМЕНЕНИЕ 2: Управление загрузкой нового трека ---
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !currentSong) {
      if (hlsRef.current) hlsRef.current.destroy();
      if (audioEl) audioEl.src = "";
      return;
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(currentSong.hlsPlaylistUrl);
      hls.attachMedia(audioEl);
    } else if (audioEl.canPlayType("application/vnd.apple.mpegurl")) {
      audioEl.src = currentSong.hlsPlaylistUrl;
    }

    listenRecordedRef.current = false;
  }, [currentSong]);

  // --- ИЗМЕНЕНИЕ 3: Централизованное управление Play/Pause ---
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !currentSong) return;

    if (isPlaying) {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Игнорируем AbortError, так как это ожидаемое поведение при смене трека
          if (error.name !== "AbortError") {
            console.error("Audio play failed:", error);
          }
        });
      }
    } else {
      audioEl.pause();
    }
  }, [isPlaying, currentSong]); // Зависимость от currentSong КЛЮЧЕВАЯ!

  // Управление громкостью, скоростью и повтором
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.volume = masterVolume / 100;
    audioEl.preservesPitch = false; // Включает режим "resample"
    audioEl.playbackRate = playbackRateEnabled ? playbackRate : 1.0;
    audioEl.loop = repeatMode === "one";
  }, [masterVolume, playbackRateEnabled, playbackRate, repeatMode]);

  // Перемотка
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && Math.abs(audioEl.currentTime - currentTime) > 1.5) {
      audioEl.currentTime = currentTime;
    }
  }, [seekVersion]); // Убрали currentTime из зависимостей, чтобы избежать конфликтов

  // Обновление состояния в сторе (события плеера)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => setCurrentTime(audioEl.currentTime, true);
    const handleDurationChange = () => {
      if (audioEl.duration && isFinite(audioEl.duration)) {
        setDuration(audioEl.duration);
      }
    };
    const handleEnded = () => {
      if (repeatMode !== "one") {
        playNext();
      }
    };

    audioEl.addEventListener("timeupdate", handleTimeUpdate);
    audioEl.addEventListener("durationchange", handleDurationChange);
    audioEl.addEventListener("ended", handleEnded);
    return () => {
      audioEl.removeEventListener("timeupdate", handleTimeUpdate);
      audioEl.removeEventListener("durationchange", handleDurationChange);
      audioEl.removeEventListener("ended", handleEnded);
    };
  }, [playNext, repeatMode, setCurrentTime, setDuration]);

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
        .then(() => useMusicStore.getState().fetchRecentlyListenedSongs())
        .catch((err) => {
          listenRecordedRef.current = false;
          console.error("Failed to record listen:", err);
        });
    }
  }, [currentTime, isPlaying, currentSong, user, isOffline]);

  return <audio ref={audioRef} crossOrigin="anonymous" playsInline />;
};

export default AudioPlayer;
