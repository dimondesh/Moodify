// src/layout/AudioPlayer.tsx

import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "../stores/usePlayerStore";
import { webAudioService, useAudioSettingsStore } from "../lib/webAudio";
import { useAuthStore } from "@/stores/useAuthStore";
import { axiosInstance } from "@/lib/axios";
import { useMusicStore } from "@/stores/useMusicStore";
import { useOfflineStore } from "@/stores/useOfflineStore";
import type { Song } from "../types";

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
  const fallbackTriggeredRef = useRef(false);
  const lastRecordedTimeRef = useRef<number>(0);

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
    currentPlaybackContext,
  } = usePlayerStore();

  const { playbackRateEnabled, playbackRate } = useAudioSettingsStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  const enrichSongWithLyricsIfNeeded = useCallback(
    async (song: Song) => {
      if (song.lyrics || isOffline) {
        return;
      }

      // Lyrics уже должны быть в объекте песни
      // Не делаем дополнительный запрос, чтобы избежать 404 ошибок
    },
    [isOffline]
  );

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
      webAudioService.applySettingsToGraph();
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

  // Управление HLS и воспроизведением
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (!currentSong || !currentSong.hlsUrl) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audioEl.src = "";
      lastSongIdRef.current = null;
      return;
    }

    if (lastSongIdRef.current !== currentSong._id) {
      listenRecordedRef.current = false;
      fallbackTriggeredRef.current = false; // Reset fallback trigger for new song
      lastRecordedTimeRef.current = 0; // Reset recorded time for new song
      lastSongIdRef.current = currentSong._id;

      // Загружаем lyrics для новой песни
      enrichSongWithLyricsIfNeeded(currentSong);

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
            audioEl
              .play()
              .catch((e) => console.error("Autoplay failed on new track", e));
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data.details);
          }
        });
      } else if (audioEl.canPlayType("application/vnd.apple.mpegurl")) {
        audioEl.src = currentSong.hlsUrl;
      }
    }

    if (isPlaying) {
      audioEl.play().catch((e) => console.error("Play command failed", e));
    } else {
      audioEl.pause();
    }
  }, [currentSong, isPlaying, enrichSongWithLyricsIfNeeded]);

  // Управление перемоткой
  useEffect(() => {
    if (
      audioRef.current &&
      Math.abs(audioRef.current.currentTime - currentTime) > 1.5
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
      audioRef.current.preservesPitch = false;

      audioRef.current.playbackRate = currentRate;
    }
  }, [masterVolume, playbackRate, playbackRateEnabled, currentSong]); // Добавил currentSong для применения скорости к новой песне

  // Запись прослушивания
  useEffect(() => {
    if (
      isPlaying &&
      user &&
      !user.isAnonymous &&
      currentSong &&
      currentSong._id &&
      currentTime >= (currentSong.duration || 0) / 3 &&
      !isOffline
    ) {
      const shouldRecordListen =
        !listenRecordedRef.current || // Первое прослушивание
        (repeatMode === "one" && currentTime < lastRecordedTimeRef.current); // Повторное прослушивание в режиме "one"

      if (shouldRecordListen) {
        listenRecordedRef.current = true;
        lastRecordedTimeRef.current = currentTime;

        // Подготавливаем контекст воспроизведения
        const playbackContext = currentPlaybackContext;

        // Валидируем контекст воспроизведения
        const validContextTypes = [
          "album",
          "playlist",
          "generated-playlist",
          "mix",
          "artist",
        ];

        const isValidContext =
          playbackContext &&
          playbackContext.type &&
          validContextTypes.includes(playbackContext.type);

        // Отправляем запрос с контекстом только если он валидный
        const requestData = isValidContext ? { playbackContext } : {};

        axiosInstance
          .post(`/songs/${currentSong._id}/listen`, requestData)
          .then(() => {
            console.log(
              `Listen recorded for ${currentSong.title}${
                isValidContext
                  ? ` from ${playbackContext.type}`
                  : " (no context)"
              }${
                repeatMode === "one" &&
                currentTime < lastRecordedTimeRef.current
                  ? " (repeat)"
                  : ""
              }`
            );
            useMusicStore.getState().fetchRecentlyListenedSongs();
          })
          .catch((e) => {
            listenRecordedRef.current = false;
            console.error("Failed to record listen", e);
          });
      }
    }

    // Сброс флага прослушивания если время меньше 1/3 трека
    if (
      currentSong &&
      currentTime < (currentSong.duration || 0) / 3 &&
      listenRecordedRef.current
    ) {
      listenRecordedRef.current = false;
      lastRecordedTimeRef.current = 0;
    }
  }, [
    currentTime,
    isPlaying,
    currentSong,
    user,
    isOffline,
    currentPlaybackContext,
    repeatMode,
  ]);

  // Event Listeners для <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500; // Обновляем не чаще чем раз в 100мс

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_INTERVAL) {
        return; // Пропускаем обновление если прошло меньше 100мс
      }
      lastUpdateTime = now;

      setCurrentTime(audio.currentTime, true);

      // Fallback: Check if we're very close to the end and the ended event didn't fire
      if (
        audio.duration &&
        audio.currentTime >= audio.duration - 0.1 &&
        !fallbackTriggeredRef.current
      ) {
        fallbackTriggeredRef.current = true;
        const state = usePlayerStore.getState();
        if (state.repeatMode === "one") {
          audio.currentTime = 0;
          audio.play();
        } else {
          state.playNext();
        }
      }
    };
    const handleDurationChange = () =>
      setDuration(audio.duration, audio.duration);
    const handleEnded = () => {
      const state = usePlayerStore.getState();
      fallbackTriggeredRef.current = false; // Reset fallback trigger
      if (state.repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        state.playNext();
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [setCurrentTime, setDuration, playNext, repeatMode]);

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
