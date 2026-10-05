/**
 * Client-Side Web Audio & Voice Synthesizer for Test Conductor
 * Implements deterministic browser audio cues without external assets or cloud dependencies.
 * Complies with browser autoplay policies: AudioContext initialized upon user gesture ("Start Test").
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8; // 0.0 to 1.0

  /**
   * Initializes or resumes the AudioContext on an explicit user interaction.
   */
  public async init(): Promise<{ success: boolean; error?: string }> {
    try {
      if (typeof window === "undefined") {
        return { success: false, error: "Audio is only available in browser environments." };
      }

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        return { success: false, error: "Web Audio API is not supported in this browser." };
      }

      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Audio initialization failed: ${msg}` };
    }
  }

  public isReady(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Plays a synthesized beep tone with smooth attack and decay envelopes to avoid audio clicks.
   */
  public playTone(frequency: number, durationSec: number, type: OscillatorType = "sine"): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      // Smooth envelope (5ms attack, 20ms release)
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(1.0, now + 0.005);
      gain.gain.setValueAtTime(1.0, now + durationSec - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + durationSec);
    } catch {
      // Audio context might be temporarily busy or suspended; ignore non-fatal synthesis errors
    }
  }

  /**
   * Countdown beeps for 3, 2, 1 (440 Hz standard pitch)
   */
  public playCountdownTone(): void {
    this.playTone(440, 0.15, "sine");
  }

  /**
   * High crisp start beep for beginning of shuttle ("Go!"): 880 Hz
   */
  public playStartTone(): void {
    this.playTone(880, 0.35, "sine");
  }

  /**
   * Distinct double-beep for halfway turnaround at 20m
   */
  public playTurnaroundTone(): void {
    this.playTone(660, 0.08, "sine");
    setTimeout(() => {
      this.playTone(660, 0.08, "sine");
    }, 120);
  }

  /**
   * Shuttle finish beep: 587 Hz (D5)
   */
  public playShuttleEndTone(): void {
    this.playTone(587, 0.25, "sine");
  }

  /**
   * Recovery countdown warning tone (e.g. at 5s, 3s, 2s, 1s)
   */
  public playRecoveryWarningTone(): void {
    this.playTone(523.25, 0.1, "triangle");
  }

  /**
   * Ascending triad chord celebrating speed level increment (C5 -> E5 -> G5)
   */
  public playLevelChangeTone(): void {
    this.playTone(523.25, 0.12, "sine");
    setTimeout(() => this.playTone(659.25, 0.12, "sine"), 120);
    setTimeout(() => this.playTone(783.99, 0.25, "sine"), 240);
  }

  /**
   * Optional voice prompt using browser SpeechSynthesis
   */
  public speak(text: string, lang: string = "fr-FR"): void {
    if (this.isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel(); // cancel pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = this.volume;
      utterance.rate = 1.1; // slightly brisk for timing
      utterance.lang = lang.startsWith("ar") ? "ar-SA" : "fr-FR";
      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis may fail or be restricted; non-fatal
    }
  }

  public close(): void {
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

// Global singleton instance for the browser session
export const audioEngine = new AudioEngine();
