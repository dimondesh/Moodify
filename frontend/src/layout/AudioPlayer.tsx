import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "../stores/usePlayerStore";
import {
  webAudioService,
  useAudioSettingsStore,
  resolvePlaybackRate,
} from "../lib/webAudio";
import { isIosDevice } from "@/lib/platform";
import { registerAudioBridge } from "@/lib/audioBridge";
import { useAuthStore } from "@/stores/useAuthStore";
import { axiosInstance } from "@/lib/axios";
import { invalidateListenHistory } from "@/lib/invalidateQueries";
import { useOfflineStore } from "@/stores/useOfflineStore";

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

  // Only media/metadata duration — never bufferedEnd: after seek, currentTime
  // often sits at the edge of the downloaded range and is not the track end.
  const effectiveDuration = getEffectiveDuration(audio, songDuration);
  if (
    effectiveDuration &&
    audio.currentTime >= effectiveDuration - END_TOLERANCE_SEC
  ) {
    return true;
  }

  return false;
}

function destroyHls(hlsRef: { current: Hls | null }) {
  if (!hlsRef.current) return;
  hlsRef.current.destroy();
  hlsRef.current = null;
}

const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(
    null,
  );
  const masterGainNodeRef = useRef<GainNode | null>(null);

  const loadGenRef = useRef(0);
  const listenRecordedRef = useRef(false);
  const fallbackTriggeredRef = useRef(false);
  const lastRecordedTimeRef = useRef<number>(0);
  const lastPlaybackTimeRef = useRef(0);
  const lastPlaybackProgressAtRef = useRef(Date.now());
  /** Suppress element→store sync while we drive play/pause from the store. */
  const appDrivenRef = useRef(false);
  /** True while a new HLS/src load is in flight — ignore spurious pause events. */
  const sourceLoadingRef = useRef(false);

  const songId = usePlayerStore((s) => s.currentSong?._id ?? null);
  const hlsUrl = usePlayerStore((s) => s.currentSong?.hlsUrl ?? null);
  const instrumentalUrl = usePlayerStore(
    (s) => s.currentSong?.instrumentalUrl ?? null,
  );
  const songDuration = usePlayerStore((s) => s.currentSong?.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const instrumentalMode = usePlayerStore((s) => s.instrumentalMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const masterVolume = usePlayerStore((s) => s.masterVolume);
  const seekVersion = usePlayerStore((s) => s.seekVersion);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setInstrumentalMode = usePlayerStore((s) => s.setInstrumentalMode);
  const currentPlaybackContext = usePlayerStore((s) => s.currentPlaybackContext);

  const { playbackRateEnabled, playbackRatePreset, playbackRate } =
    useAudioSettingsStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  const handleTrackEnd = useCallback((audio: HTMLAudioElement) => {
    if (fallbackTriggeredRef.current) return;
    fallbackTriggeredRef.current = true;

    const state = usePlayerStore.getState();
    const songIdBefore = state.currentSong?._id;

    if (state.repeatMode === "one") {
      fallbackTriggeredRef.current = false;
      audio.currentTime = 0;
      appDrivenRef.current = true;
      void audio.play().finally(() => {
        appDrivenRef.current = false;
      });
      return;
    }

    void state.playNext().finally(() => {
      if (usePlayerStore.getState().currentSong?._id === songIdBefore) {
        fallbackTriggeredRef.current = false;
      }
    });
  }, []);

  // Gesture unlock bridge — call unlockAudioElement() sync in store before awaits
  useEffect(() => {
    registerAudioBridge({
      unlock: () => {
        const audio = audioRef.current;
        if (!audio) return;
        appDrivenRef.current = true;
        void audio.play().finally(() => {
          // If store says paused, re-pause after unlock attempt
          if (!usePlayerStore.getState().isPlaying) {
            audio.pause();
          }
          appDrivenRef.current = false;
        });
      },
    });
    return () => registerAudioBridge(null);
  }, []);

  // Web Audio graph (desktop only — iOS/iPadOS stay on native <audio> volume)
  useEffect(() => {
    if (iosNativePlayback) return;

    const AudioContextClass =
      window.AudioContext || (window as CustomWindow).webkitAudioContext;
    if (!AudioContextClass) return;

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
        void audioContextRef.current.resume();
      }
    };
    document.addEventListener("click", resumeContext, { once: true });
    return () => document.removeEventListener("click", resumeContext);
  }, []);

  // --- Source reconciler: only song id / playback URL ---
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const songChanged = audioEl.dataset.moodifySongId !== (songId ?? "");
    if (songChanged) {
      if (usePlayerStore.getState().instrumentalMode) {
        setInstrumentalMode(false);
      }
      listenRecordedRef.current = false;
      fallbackTriggeredRef.current = false;
      lastRecordedTimeRef.current = 0;
      lastPlaybackTimeRef.current = 0;
      lastPlaybackProgressAtRef.current = Date.now();
    }

    // Never keep instrumental URL across a track change (mode flip is async).
    const effectiveUrl =
      !songChanged && instrumentalMode && instrumentalUrl
        ? instrumentalUrl
        : hlsUrl;

    if (!songId || !effectiveUrl) {
      loadGenRef.current += 1;
      sourceLoadingRef.current = false;
      destroyHls(hlsRef);
      audioEl.removeAttribute("src");
      audioEl.removeAttribute("data-moodify-url");
      audioEl.removeAttribute("data-moodify-song-id");
      audioEl.load();
      return;
    }

    const prevUrl = audioEl.dataset.moodifyUrl ?? "";
    if (!songChanged && prevUrl === effectiveUrl) {
      return;
    }

    const loadGen = ++loadGenRef.current;
    const resumeAt =
      !songChanged && prevUrl && prevUrl !== effectiveUrl
        ? audioEl.currentTime || 0
        : 0;

    audioEl.dataset.moodifySongId = songId;
    audioEl.dataset.moodifyUrl = effectiveUrl;
    sourceLoadingRef.current = true;

    destroyHls(hlsRef);

    const preferNative =
      (iosNativePlayback || !Hls.isSupported()) && canPlayNativeHls(audioEl);

    const afterReady = () => {
      if (loadGen !== loadGenRef.current) return;
      sourceLoadingRef.current = false;
      if (resumeAt > 0 && Number.isFinite(resumeAt)) {
        try {
          audioEl.currentTime = resumeAt;
        } catch {
          /* ignore seek-before-ready races */
        }
      }
      if (usePlayerStore.getState().isPlaying) {
        appDrivenRef.current = true;
        void audioEl.play().finally(() => {
          appDrivenRef.current = false;
        });
      }
    };

    if (preferNative) {
      if ("disableRemotePlayback" in audioEl) {
        (audioEl as HTMLAudioElement & { disableRemotePlayback: boolean })
          .disableRemotePlayback = false;
      }
      audioEl.src = effectiveUrl;
      audioEl.load();
      audioEl.addEventListener("loadedmetadata", afterReady, { once: true });
      return;
    }

    if (Hls.isSupported()) {
      // ManagedMediaSource on iOS 17+ requires this for stable MSE + AirPlay picker
      if ("disableRemotePlayback" in audioEl) {
        (audioEl as HTMLAudioElement & { disableRemotePlayback: boolean })
          .disableRemotePlayback = true;
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(effectiveUrl);
      hls.attachMedia(audioEl);

      hls.on(Hls.Events.MANIFEST_PARSED, afterReady);
      hls.on(Hls.Events.MEDIA_ENDED, () => {
        if (loadGen !== loadGenRef.current) return;
        handleTrackEnd(audioEl);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || loadGen !== loadGenRef.current) return;
        console.error("HLS Fatal Error:", data.details);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          usePlayerStore.setState({ isPlaying: false });
        }
      });
      return;
    }

    audioEl.src = effectiveUrl;
    audioEl.load();
    audioEl.addEventListener("loadedmetadata", afterReady, { once: true });
  }, [
    songId,
    hlsUrl,
    instrumentalUrl,
    instrumentalMode,
    handleTrackEnd,
    setInstrumentalMode,
  ]);

  // Cleanup hls on unmount
  useEffect(() => {
    return () => {
      loadGenRef.current += 1;
      destroyHls(hlsRef);
    };
  }, []);

  // --- Play / pause reconciler ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      appDrivenRef.current = true;
      void audio
        .play()
        .catch((e: unknown) => {
          const name =
            e && typeof e === "object" && "name" in e
              ? String((e as { name: string }).name)
              : "";
          console.error("Play command failed", e);
          if (name === "NotAllowedError" || name === "NotSupportedError") {
            usePlayerStore.setState({ isPlaying: false });
          }
        })
        .finally(() => {
          appDrivenRef.current = false;
        });
    } else {
      appDrivenRef.current = true;
      audio.pause();
      appDrivenRef.current = false;
    }
  }, [isPlaying]);

  // --- Seek reconciler: only seekVersion (ignore timeupdate echoes) ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = usePlayerStore.getState().currentTime;
    if (!Number.isFinite(target)) return;
    if (Math.abs(audio.currentTime - target) < 0.25) return;
    try {
      audio.currentTime = target;
    } catch {
      /* not ready */
    }
  }, [seekVersion]);

  // Volume / rate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const rate = resolvePlaybackRate(
      playbackRateEnabled,
      playbackRatePreset,
      playbackRate,
    );
    audio.preservesPitch = false;
    audio.playbackRate = rate;

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
    songId,
  ]);

  // Element → store sync + end-of-track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500;

    const syncPlayingFromElement = (playing: boolean) => {
      if (appDrivenRef.current) return;
      if (usePlayerStore.getState().isPlaying === playing) return;
      usePlayerStore.setState({ isPlaying: playing });
    };

    const onPlay = () => syncPlayingFromElement(true);
    const onPlaying = () => syncPlayingFromElement(true);
    const onPause = () => {
      // Ignore pause that is part of ended / source reload
      if (audio.ended || sourceLoadingRef.current) return;
      syncPlayingFromElement(false);
    };
    const onError = () => {
      console.error("Audio element error", audio.error);
      if (!appDrivenRef.current) {
        usePlayerStore.setState({ isPlaying: false });
      }
    };

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

    const handleDurationChange = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d, d);
      } else if (songDuration && songDuration > 0) {
        setDuration(songDuration, songDuration);
      }
    };

    const handleEnded = () => handleTrackEnd(audio);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [setCurrentTime, setDuration, handleTrackEnd, songDuration]);

  // Listen recording
  useEffect(() => {
    if (
      isPlaying &&
      user &&
      !user.isAnonymous &&
      songId &&
      currentTime >= (songDuration || 0) / 3 &&
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
          .post(`/songs/${songId}/listen`, requestData)
          .then(() => {
            void invalidateListenHistory();
          })
          .catch((e) => {
            listenRecordedRef.current = false;
            console.error("Failed to record listen", e);
          });
      }
    }

    if (
      songId &&
      currentTime < (songDuration || 0) / 3 &&
      listenRecordedRef.current
    ) {
      listenRecordedRef.current = false;
      lastRecordedTimeRef.current = 0;
    }
  }, [
    currentTime,
    isPlaying,
    songId,
    songDuration,
    user,
    isOffline,
    currentPlaybackContext,
    repeatMode,
  ]);

  return (
    <audio
      ref={audioRef}
      data-moodify-player
      playsInline
      style={{ display: "none" }}
      {...(!iosNativePlayback && { crossOrigin: "anonymous" })}
    />
  );
};

export default AudioPlayer;
