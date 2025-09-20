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
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
  const listenRecordedRef = useRef(false);

  // --- ИЗМЕНЕНИЕ: Инициализация Web Audio API ---
  // Этот useEffect выполняется один раз при монтировании компонента.
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    // Создаем AudioContext только если его еще нет.
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

    // Создаем источник звука из нашего <audio> элемента.
    // Это ключевой шаг для связи HTML-плеера с Web Audio API.
    if (!mediaSourceNodeRef.current) {
      mediaSourceNodeRef.current =
        audioContext.createMediaElementSource(audioEl);
    }

    // Инициализируем наш сервис эффектов, передавая ему контекст,
    // источник звука (наш <audio> элемент) и конечную точку (динамики).
    webAudioService.init(
      audioContext,
      mediaSourceNodeRef.current,
      audioContext.destination
    );
    console.log("AudioPlayer initialized with Web Audio API bridge.");

    // Возобновляем контекст при первом взаимодействии пользователя
    const resumeContext = () => {
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      document.removeEventListener("click", resumeContext);
      document.removeEventListener("keydown", resumeContext);
    };
    document.addEventListener("click", resumeContext);
    document.addEventListener("keydown", resumeContext);
  }, []);
  // --- КОНЕЦ ИЗМЕНЕНИЯ ---

  // Управление загрузкой и воспроизведением HLS
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (currentSong?.hlsPlaylistUrl) {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(currentSong.hlsPlaylistUrl);
        hls.attachMedia(audioEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying)
            audioEl.play().catch((e) => console.error("Autoplay failed", e));
        });
      } else if (audioEl.canPlayType("application/vnd.apple.mpegurl")) {
        audioEl.src = currentSong.hlsPlaylistUrl;
        if (isPlaying)
          audioEl.play().catch((e) => console.error("Autoplay failed", e));
      }
    } else {
      if (hlsRef.current) hlsRef.current.destroy();
      audioEl.src = "";
    }

    listenRecordedRef.current = false;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSong]);

  // Управление состоянием Play/Pause
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.play().catch((e) => console.error("Play failed:", e));
    } else {
      audioEl.pause();
    }
  }, [isPlaying]);

  // Управление громкостью, скоростью и повтором
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.volume = masterVolume / 100;

    // --- ИЗМЕНЕНИЕ: Добавляем preservesPitch ---
    audioEl.preservesPitch = false; // Это включает режим "resample"
    audioEl.playbackRate = playbackRateEnabled ? playbackRate : 1.0;
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    audioEl.loop = repeatMode === "one";
  }, [masterVolume, playbackRateEnabled, playbackRate, repeatMode]);

  // Перемотка
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && Math.abs(audioEl.currentTime - currentTime) > 1.5) {
      // Увеличил порог для HLS
      audioEl.currentTime = currentTime;
    }
  }, [seekVersion, currentTime]);

  // Обновление состояния в сторе
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
