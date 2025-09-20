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

  // Инициализация Web Audio API с <audio> элементом
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const audioContext = webAudioService.getAudioContext();
    if (audioContext && !mediaSourceNodeRef.current) {
      mediaSourceNodeRef.current =
        audioContext.createMediaElementSource(audioEl);
      webAudioService.init(
        audioContext,
        mediaSourceNodeRef.current,
        audioContext.destination
      );
    }
  }, []);

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
    audioEl.playbackRate = playbackRateEnabled ? playbackRate : 1.0;
    audioEl.loop = repeatMode === "one";
  }, [masterVolume, playbackRateEnabled, playbackRate, repeatMode]);

  // Перемотка
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && Math.abs(audioEl.currentTime - currentTime) > 1) {
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
