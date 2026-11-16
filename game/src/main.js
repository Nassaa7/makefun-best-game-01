// Emberwild boot: wires canvas, input, sound, screens and the fixed-step
// loop together, and handles every button and screen-level key.

import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { InputTracker } from './input.js';
import { SoundEngine } from './audio.js';
import { ParticleSystem, FloatingTexts } from './particles.js';
import { EmberwildGame } from './game.js';
import { createGarden } from './world.js';
import { drawFrame, syncScreens } from './render.js';
import { loadSettings, saveSettings } from './storage.js';
import { markShotReady, shotSceneFromUrl, stageShotScene } from './shots.js';

const STEP = 1 / 60;

function boot() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const settings = loadSettings();
  const input = new InputTracker(canvas);
  const sound = new SoundEngine(settings);
  const particles = new ParticleSystem();
  const floaters = new FloatingTexts();
  const game = new EmberwildGame(input, sound, particles, floaters, settings);
  const garden = createGarden(20261116);

  wireButtons(game, sound, settings);
  wireSettingsPanel(settings, sound);
  wireUpgradeCards(game);

  // First gesture unlocks audio and starts the music.
  const unlockAudio = () => {
    if (sound.ensure()) sound.startMusic();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  const shot = shotSceneFromUrl();
  if (shot) {
    stageShotScene(game, shot.scene, shot.seed);
    syncScreens(game);
    drawFrame(ctx, game, garden);
    requestAnimationFrame(() => {
      syncScreens(game);
      drawFrame(ctx, game, garden);
      markShotReady();
    });
    return;
  }

  let lastTime = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    handleScreenKeys(game, input, sound);
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 4) {
      game.update(STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 4) accumulator = 0;
    // Ambient motion continues on menus; gameplay time only advances in play.
    if (game.screen !== 'playing') game.time += elapsed;
    particles.update(elapsed);
    floaters.update(elapsed);
    syncScreens(game);
    drawFrame(ctx, game, garden);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function handleScreenKeys(game, input, sound) {
  if (input.wasPressed('KeyM')) {
    game.settings.muted = !game.settings.muted;
    sound.setMuted(game.settings.muted);
    saveSettings(game.settings);
    syncMuteButton(game.settings.muted);
  }
  if (game.screen === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      startRun(game, sound);
    }
    return;
  }
  if (game.screen === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) game.pause();
    return;
  }
  if (game.screen === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter')) game.resume();
    return;
  }
  if (game.screen === 'upgrade') {
    if (input.wasPressed('Digit1')) game.chooseUpgrade(0);
    if (input.wasPressed('Digit2')) game.chooseUpgrade(1);
    if (input.wasPressed('Digit3')) game.chooseUpgrade(2);
    return;
  }
  if (game.screen === 'victory' || game.screen === 'defeat') {
    if (input.wasPressed('KeyR') || input.wasPressed('Enter')) {
      startRun(game, sound);
    }
    if (game.screen === 'victory' && input.wasPressed('KeyE')) {
      game.continueEndless();
    }
  }
}

function startRun(game, sound) {
  sound.ensure();
  sound.startMusic();
  sound.play('click');
  game.newRun((Date.now() % 2147483647) + 1);
}

function wireButtons(game, sound, settings) {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      sound.ensure();
      if (action === 'start') startRun(game, sound);
      else if (action === 'resume') { sound.play('click'); game.resume(); }
      else if (action === 'restart') startRun(game, sound);
      else if (action === 'quit-title') { sound.play('click'); game.toTitle(); }
      else if (action === 'endless') { sound.play('click'); game.continueEndless(); }
      else if (action === 'howto') { sound.play('click'); openPanel('panel-howto'); }
      else if (action === 'settings') { sound.play('click'); openPanel('panel-settings'); }
      else if (action === 'close-panel') { sound.play('click'); closePanels(); }
      else if (action === 'mute') {
        settings.muted = !settings.muted;
        sound.setMuted(settings.muted);
        saveSettings(settings);
        syncMuteButton(settings.muted);
      }
    });
  });
  syncMuteButton(settings.muted);
}

function wireUpgradeCards(game) {
  const container = document.getElementById('upgrade-cards');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-upgrade-index]');
    if (!card) return;
    game.chooseUpgrade(parseInt(card.dataset.upgradeIndex, 10));
  });
}

function openPanel(id) {
  closePanels();
  const panel = document.getElementById(id);
  if (panel) panel.classList.add('open');
}

function closePanels() {
  document.querySelectorAll('.side-panel').forEach((panel) => panel.classList.remove('open'));
}

function syncMuteButton(muted) {
  const button = document.querySelector('[data-action="mute"]');
  if (button) button.textContent = muted ? 'Sound: Off' : 'Sound: On';
}

function wireSettingsPanel(settings, sound) {
  const bindRange = (id, key, apply) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = String(Math.round(settings[key] * 100));
    element.addEventListener('input', () => {
      settings[key] = parseInt(element.value, 10) / 100;
      apply();
      saveSettings(settings);
    });
  };
  bindRange('setting-master', 'masterVolume', () => sound.applyVolumes());
  bindRange('setting-music', 'musicVolume', () => sound.applyVolumes());
  bindRange('setting-sfx', 'sfxVolume', () => sound.applyVolumes());
  const bindCheck = (id, key) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.checked = Boolean(settings[key]);
    element.addEventListener('change', () => {
      settings[key] = element.checked;
      saveSettings(settings);
    });
  };
  bindCheck('setting-shake', 'screenShake');
  bindCheck('setting-autofire', 'autoFire');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { GAME_WIDTH, GAME_HEIGHT };
