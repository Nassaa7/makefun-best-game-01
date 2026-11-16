// Best score and settings persistence. Everything is guarded: storage may be
// unavailable (private mode, sandboxed iframe) and the game must still play.

const BEST_KEY = 'emberwild-best-score';
const SETTINGS_KEY = 'emberwild-settings';

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  muted: false,
  screenShake: true,
  autoFire: false,
};

export function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const value = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch (error) {
    // Storage unavailable; the best score simply does not persist.
  }
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // Ignore: settings just won't persist.
  }
}
