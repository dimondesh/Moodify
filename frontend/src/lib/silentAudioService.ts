// frontend/src/lib/silentAudioService.ts

class SilentAudioService {
  private audio: HTMLAudioElement | null = null;
  private isInitialized = false;

  init(element: HTMLAudioElement) {
    if (this.isInitialized) return;
    this.audio = element;
    this.isInitialized = true;
    console.log("SilentAudioService initialized.");
  }

  play() {
    if (!this.audio || this.audio.paused === false) return;

    console.log("SilentAudioService: Attempting to play silent audio...");
    const playPromise = this.audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn("SilentAudioService: play() was interrupted.", error);
      });
    }
  }

  pause() {
    if (!this.audio || this.audio.paused) return;

    console.log("SilentAudioService: Pausing silent audio.");
    this.audio.pause();
  }
}

export const silentAudioService = new SilentAudioService();
