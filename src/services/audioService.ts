// Simple audio service for managing game sound effects
class AudioService {
  private audioContext: AudioContext | null = null;
  private soundBuffers: { [key: string]: AudioBuffer } = {};
  private gainNode: GainNode | null = null;

  // Initialize audio context on first user interaction
  initialize() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.setVolume(0.5); // Default volume
    }
  }

  // Load a sound file and store it in the buffer
  async loadSound(name: string, url: string) {
    if (!this.audioContext) return;
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.soundBuffers[name] = audioBuffer;
    } catch (error) {
      console.error(`Failed to load sound: ${name}`, error);
    }
  }

  // Play a loaded sound
  playSound(name: string) {
    if (!this.audioContext || !this.gainNode) return;
    
    const buffer = this.soundBuffers[name];
    if (!buffer) {
      console.warn(`Sound not loaded: ${name}`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start(0);
  }

  // Set master volume (0.0 to 1.0)
  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Resume audio context if it was suspended
  resume() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// Export a singleton instance
export const audioService = new AudioService(); 