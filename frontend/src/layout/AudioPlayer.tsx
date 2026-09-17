import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "../stores/usePlayerStore";
import {
  webAudioService,
  useAudioSettingsStore,
  resolvePlaybackRate,
} from "../lib/webAudio";
import { isIosDevice } from "@/lib/platform";
import { useAuthStore } from "@/stores/useAuthStore";
import { axiosInstance } from "@/lib/axios";
import { invalidateListenHistory } from "@/lib/invalidateQueries";
import { useOfflineStore } from "@/stores/useOfflineStore";
import type { Song } from "../types";

interface CustomWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const iosNativePlayback = isIosDevice();

const END_TOLERANCE_SEC = 0.25;
const STALL_NEAR_END_SEC = 2;
const STALL_TIMEOUT_MS = 1500;

function canPlayNativeHls(audio: HTMLAudioElement): boolean {
  return Boolean(audio.canPlayType("application/vnd.apple.mpegurl"));
}

function getEffectiveDuration(
  audio: HTMLAudioElement,
  songDuration?: number,
): number | null {
  const mediaDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const metadataDuration = songDuration && songDuration > 0 ? songDuration : 0;

  if (mediaDuration > 0 && metadataDuration > 0) {
    return Math.min(mediaDuration, metadataDuration + 1);
  }
  if (mediaDuration > 0) return mediaDuration;
  if (metadataDuration > 0) return metadataDuration;
  return null;
}

function isAtEndOfTrack(
  audio: HTMLAudioElement,
  songDuration?: number,
): boolean {
  if (audio.ended) return true;

  const effectiveDuration = getEffectiveDuration(audio, songDuration);
  if (
    effectiveDuration &&
    audio.currentTime >= effectiveDuration - END_TOLERANCE_SEC
  ) {
    return true;
  }

  if (audio.buffered.length > 0) {
    const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
    if (
      bufferedEnd > 0 &&
      audio.currentTime >= bufferedEnd - END_TOLERANCE_SEC
    ) {
      return true;
    }
  }

  return false;
}
// -------------------------------------------------------------------------

const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(
    null,
  );
  const masterGainNodeRef = useRef<GainNode | null>(null);

  const lastSongIdRef = useRef<string | null>(null);
  const lastPlaybackUrlRef = useRef<string | null>(null);
  const listenRecordedRef = useRef(false);
  const fallbackTriggeredRef = useRef(false);
  const lastRecordedTimeRef = useRef<number>(0);
  const loadGenRef = useRef(0);
  const lastPlaybackTimeRef = useRef(0);
  const lastPlaybackProgressAtRef = useRef(Date.now());

  const {
    currentSong,
    isPlaying,
    repeatMode,
    masterVolume,
    setCurrentTime,
    setDuration,
    currentTime,
    seekVersion,
    currentPlaybackContext,
    instrumentalMode,
    setInstrumentalMode,
  } = usePlayerStore();

  const { playbackRateEnabled, playbackRatePreset, playbackRate } =
    useAudioSettingsStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  const enrichSongWithLyricsIfNeeded = useCallback(
    async (song: Song) => {
      if (song.lyrics || isOffline) {
        return;
      }
      // Lyrics уже должны быть в объекте песни
    },
    [isOffline],
  );

  const handleTrackEnd = useCallback((audio: HTMLAudioElement) => {
    if (fallbackTriggeredRef.current) return;
    fallbackTriggeredRef.current = true;

    const state = usePlayerStore.getState();
    const songIdBefore = state.currentSong?._id;

    if (state.repeatMode === "one") {
      fallbackTriggeredRef.current = false;
      audio.currentTime = 0;
      void audio.play();
      return;
    }

    void state.playNext().finally(() => {
      if (usePlayerStore.getState().currentSong?._id === songIdBefore) {
        fallbackTriggeredRef.current = false;
      }
    });
  }, []);

  // Web Audio Graph
  useEffect(() => {
    if (iosNativePlayback) return;

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
        context.destination,
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

    const playIfNeeded = (loadGen: number) => {
      if (loadGen !== loadGenRef.current) return;
      if (!usePlayerStore.getState().isPlaying) return;
      void audioEl.play().catch((e) => {
        console.error("Play command failed", e);
      });
    };

    if (!currentSong?.hlsUrl) {
      loadGenRef.current += 1;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audioEl.removeAttribute("src");
      audioEl.load();
      lastSongIdRef.current = null;
      lastPlaybackUrlRef.current = null;
      return;
    }

    const songChanged = lastSongIdRef.current !== currentSong._id;
    const useInstrumental =
      !songChanged &&
      instrumentalMode &&
      Boolean(currentSong.instrumentalUrl);
    const playbackUrl = useInstrumental
      ? currentSong.instrumentalUrl!
      : currentSong.hlsUrl;

    const urlChanged = lastPlaybackUrlRef.current !== playbackUrl;

    if (songChanged || urlChanged) {
      const resumeAt =
        urlChanged && !songChanged ? audioEl.currentTime || 0 : 0;
      const loadGen = ++loadGenRef.current;

      if (songChanged) {
        if (instrumentalMode) setInstrumentalMode(false);
        listenRecordedRef.current = false;
        fallbackTriggeredRef.current = false;
        lastRecordedTimeRef.current = 0;
        lastPlaybackTimeRef.current = 0;
        lastPlaybackProgressAtRef.current = Date.now();
      }

      lastSongIdRef.current = currentSong._id;
      lastPlaybackUrlRef.current = playbackUrl;

      enrichSongWithLyricsIfNeeded(currentSong);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // iOS (and Safari): native HLS is more stable across track skips than hls.js MSE.
      const useNativeHls =
        (iosNativePlayback || !Hls.isSupported()) && canPlayNativeHls(audioEl);

      if (useNativeHls) {
        audioEl.src = playbackUrl;
        audioEl.load();

        const onReady = () => {
          if (loadGen !== loadGenRef.current) return;
          if (resumeAt > 0) {
            audioEl.currentTime = resumeAt;
          }
          playIfNeeded(loadGen);
        };
        audioEl.addEventListener("loadedmetadata", onReady, { once: true });
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(audioEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (loadGen !== loadGenRef.current) return;
          if (resumeAt > 0) {
            audioEl.currentTime = resumeAt;
          }
          playIfNeeded(loadGen);
        });

        hls.on(Hls.Events.MEDIA_ENDED, () => {
          if (loadGen !== loadGenRef.current) return;
          handleTrackEnd(audioEl);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data.details);
          }
        });
      }

      if (!isPlaying) {
        audioEl.pause();
      }
      return;
    }

    if (isPlaying) {
      playIfNeeded(loadGenRef.current);
    } else {
      audioEl.pause();
    }
  }, [
    currentSong,
    isPlaying,
    instrumentalMode,
    enrichSongWithLyricsIfNeeded,
    handleTrackEnd,
    setInstrumentalMode,
  ]);

  // Управление перемоткой
  useEffect(() => {
    if (
      audioRef.current &&
      Math.abs(audioRef.current.currentTime - currentTime) > 1.5
    ) {
      audioRef.current.currentTime = currentTime;
    }
  }, [seekVersion, currentTime]);

  // Управление звуком и скоростью
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentRate = resolvePlaybackRate(
      playbackRateEnabled,
      playbackRatePreset,
      playbackRate,
    );
    audio.preservesPitch = false;
    audio.playbackRate = currentRate;

    if (iosNativePlayback) {
      audio.volume = 1;
      return;
    }

    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = masterVolume / 100;
    }
  }, [
    masterVolume,
    playbackRate,
    playbackRatePreset,
    playbackRateEnabled,
    currentSong,
  ]);

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
        !listenRecordedRef.current ||
        (repeatMode === "one" && currentTime < lastRecordedTimeRef.current);

      if (shouldRecordListen) {
        listenRecordedRef.current = true;
        lastRecordedTimeRef.current = currentTime;

        const playbackContext = currentPlaybackContext;
        const validContextTypes = ["album", "playlist", "artist"];
        const isValidContext =
          playbackContext?.type &&
          validContextTypes.includes(playbackContext.type);
        const requestData = isValidContext ? { playbackContext } : {};

        axiosInstance
          .post(`/songs/${currentSong._id}/listen`, requestData)
          .then(() => {
            console.log(
              `Listen recorded for ${currentSong.title}${
                isValidContext
                  ? ` from ${playbackContext.type}`
                  : " (no context)"
              }${repeatMode === "one" && currentTime < lastRecordedTimeRef.current ? " (repeat)" : ""}`,
            );
            void invalidateListenHistory();
          })
          .catch((e) => {
            listenRecordedRef.current = false;
            console.error("Failed to record listen", e);
          });
      }
    }

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

  // End-of-track + progress (same path on iOS and desktop — avoids double playNext)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500;

    const handleTimeUpdate = () => {
      const now = Date.now();
      const playbackTime = audio.currentTime;
      const { currentSong: song, isPlaying: playing } =
        usePlayerStore.getState();

      if (
        !fallbackTriggeredRef.current &&
        isAtEndOfTrack(audio, song?.duration)
      ) {
        handleTrackEnd(audio);
        return;
      }

      if (
        !fallbackTriggeredRef.current &&
        playing &&
        !audio.paused &&
        song?.duration &&
        playbackTime >= song.duration - STALL_NEAR_END_SEC &&
        playbackTime === lastPlaybackTimeRef.current &&
        now - lastPlaybackProgressAtRef.current >= STALL_TIMEOUT_MS
      ) {
        handleTrackEnd(audio);
        return;
      }

      if (playbackTime !== lastPlaybackTimeRef.current) {
        lastPlaybackTimeRef.current = playbackTime;
        lastPlaybackProgressAtRef.current = now;
      }

      if (now - lastUpdateTime < UPDATE_INTERVAL) return;
      lastUpdateTime = now;
      setCurrentTime(playbackTime, true);
    };

    const handleDurationChange = () =>
      setDuration(audio.duration, audio.duration);

    const handleEnded = () => {
      handleTrackEnd(audio);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [setCurrentTime, setDuration, handleTrackEnd]);

  return (
    <audio
      ref={audioRef}
      playsInline
      style={{ display: "none" }}
      {...(!iosNativePlayback && { crossOrigin: "anonymous" })}
    />
  );
};

export default AudioPlayer;
