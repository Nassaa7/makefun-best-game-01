// All sound is synthesised live with WebAudio: no audio files, no network.
// Short blips for actions, a slow generative pad-and-pluck loop for music.

const NOTE_FREQUENCIES = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0,
};

// A wandering pentatonic line over a slow two-chord pad.
const MELODY = ['E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4', 'E4', 'G4', 'C5', 'E5', 'D4', 'E4', 'G4', 'A4'];
const PAD_CHORDS = [['C3', 'G3', 'E4'], ['A3', 'E4', 'C4'], ['G3', 'D4', 'G4'], ['A3', 'E4', 'A4']];

export class SoundEngine {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.unlocked = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      this.unlocked = true;
      return true;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      this.context = new AudioContextClass();
    } catch (error) {
      return false;
    }
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    this.applyVolumes();
    this.unlocked = true;
    return true;
  }

  applyVolumes() {
    if (!this.context) return;
    const muted = this.settings.muted;
    this.masterGain.gain.value = muted ? 0 : this.settings.masterVolume;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  setMuted(muted) {
    this.settings.muted = muted;
    this.applyVolumes();
  }

  tone(options) {
    if (!this.context || !this.unlocked) return;
    const { frequency, endFrequency, duration, type, volume, when, destination } = options;
    const start = when ?? this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination || this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  noiseBurst(options) {
    if (!this.context || !this.unlocked) return;
    const { duration, volume, filterFrequency, when } = options;
    const start = when ?? this.context.currentTime;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency || 1200;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(start);
  }

  play(name) {
    if (!this.context || !this.unlocked) return;
    const now = this.context.currentTime;
    switch (name) {
      case 'shoot':
        this.tone({ frequency: 880, endFrequency: 420, duration: 0.07, type: 'triangle', volume: 0.1 });
        break;
      case 'hit':
        this.tone({ frequency: 320, endFrequency: 180, duration: 0.06, type: 'square', volume: 0.07 });
        break;
      case 'die':
        this.tone({ frequency: 420, endFrequency: 60, duration: 0.22, type: 'sawtooth', volume: 0.12 });
        this.noiseBurst({ duration: 0.14, volume: 0.1, filterFrequency: 900 });
        break;
      case 'hurt':
        this.tone({ frequency: 160, endFrequency: 55, duration: 0.25, type: 'sawtooth', volume: 0.2 });
        break;
      case 'gem':
        this.tone({ frequency: 1180 + Math.random() * 240, duration: 0.09, type: 'sine', volume: 0.08 });
        break;
      case 'pickup':
        this.tone({ frequency: 523, duration: 0.1, type: 'sine', volume: 0.14 });
        this.tone({ frequency: 784, duration: 0.16, type: 'sine', volume: 0.14, when: now + 0.07 });
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((freq, i) => {
          this.tone({ frequency: freq, duration: 0.18, type: 'triangle', volume: 0.13, when: now + i * 0.07 });
        });
        break;
      case 'dash':
        this.noiseBurst({ duration: 0.16, volume: 0.12, filterFrequency: 2400 });
        break;
      case 'nova':
        this.tone({ frequency: 90, endFrequency: 34, duration: 0.5, type: 'sine', volume: 0.3 });
        this.noiseBurst({ duration: 0.4, volume: 0.16, filterFrequency: 700 });
        break;
      case 'wave':
        this.tone({ frequency: 392, duration: 0.14, type: 'triangle', volume: 0.12 });
        this.tone({ frequency: 523, duration: 0.2, type: 'triangle', volume: 0.12, when: now + 0.11 });
        break;
      case 'boss':
        this.tone({ frequency: 110, endFrequency: 55, duration: 0.7, type: 'sawtooth', volume: 0.2 });
        this.tone({ frequency: 165, endFrequency: 82, duration: 0.7, type: 'sawtooth', volume: 0.12, when: now + 0.08 });
        break;
      case 'victory':
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          this.tone({ frequency: freq, duration: 0.3, type: 'triangle', volume: 0.15, when: now + i * 0.12 });
        });
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((freq, i) => {
          this.tone({ frequency: freq, duration: 0.32, type: 'triangle', volume: 0.14, when: now + i * 0.18 });
        });
        break;
      case 'click':
        this.tone({ frequency: 660, duration: 0.05, type: 'sine', volume: 0.09 });
        break;
      case 'shield':
        this.tone({ frequency: 740, endFrequency: 1180, duration: 0.18, type: 'sine', volume: 0.12 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    if (!this.context || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.nextNoteTime = this.context.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    if (!this.context) return;
    const stepDuration = 0.42;
    while (this.nextNoteTime < this.context.currentTime + 0.35) {
      const step = this.musicStep;
      const when = this.nextNoteTime;
      if (step % 16 === 0) {
        const chord = PAD_CHORDS[Math.floor(step / 16) % PAD_CHORDS.length];
        for (const note of chord) {
          this.tone({
            frequency: NOTE_FREQUENCIES[note],
            duration: stepDuration * 16,
            type: 'sine',
            volume: 0.05,
            when,
            destination: this.musicGain,
          });
        }
      }
      if (step % 2 === 0) {
        const note = MELODY[(step / 2) % MELODY.length];
        this.tone({
          frequency: NOTE_FREQUENCIES[note],
          duration: 0.5,
          type: 'triangle',
          volume: 0.07,
          when,
          destination: this.musicGain,
        });
      }
      this.musicStep += 1;
      this.nextNoteTime += stepDuration;
    }
  }
}
