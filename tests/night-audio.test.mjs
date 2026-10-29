import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/scripts/night/audio.js';
import SCORE from '../src/data/night-music.json' with { type: 'json' };

class Param {
  value = 0; events = [];
  setValueAtTime(value, time) { this.value = value; this.events.push({ value, time }); }
  exponentialRampToValueAtTime(value, time) { this.events.push({ value, time }); }
  setTargetAtTime(value, time) { this.value = value; this.events.push({ value, time }); }
}
class Node {
  constructor(context) { this.context = context; this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}
class Source extends Node {
  frequency = new Param(); detune = new Param();
  start(time = this.context.currentTime) { this.at = time; this.context.started.push(this); this.context.active.add(this); this.context.peak = Math.max(this.context.peak, this.context.active.size); }
  stop(time) {
    if (time != null && time > this.context.currentTime) this.endAt = time;
    else this.end();
  }
  end() { this.context.active.delete(this); this.onended?.(); }
}
class Audio {
  static instances = [];
  sampleRate = 8000; currentTime = 0; state = 'suspended'; started = []; active = new Set(); peak = 0;
  destination = new Node(this); gains = [];
  constructor() { Audio.instances.push(this); }
  createGain() { const node = new Node(this); node.gain = new Param(); this.gains.push(node); return node; }
  createOscillator() { return new Source(this); }
  createBufferSource() { return new Source(this); }
  createStereoPanner() { const node = new Node(this); node.pan = new Param(); return node; }
  createBiquadFilter() { const node = new Node(this); node.frequency = new Param(); node.Q = new Param(); return node; }
  createDynamicsCompressor() { const node = new Node(this); for (const key of ['threshold','knee','ratio','attack','release']) node[key] = new Param(); return node; }
  createConvolver() { return new Node(this); }
  createBuffer(channels, length) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { numberOfChannels: channels, getChannelData: channel => data[channel] }; }
  async resume() { if (this.state !== 'closed') this.state = 'running'; }
  async suspend() { if (this.state !== 'closed') this.state = 'suspended'; }
  async close() { this.state = 'closed'; for (const source of [...this.active]) source.end(); }
  advance(dt) { this.currentTime += dt; for (const source of [...this.active]) if (source.endAt <= this.currentTime) source.end(); }
}

async function withAudio(run) {
  const original = { AudioContext: globalThis.AudioContext, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  const timers = new Map(); let nextTimer = 1;
  Audio.instances = [];
  globalThis.AudioContext = Audio;
  globalThis.setInterval = callback => { const id = nextTimer++; timers.set(id, callback); return id; };
  globalThis.clearInterval = id => timers.delete(id);
  const advance = dt => { for (const context of Audio.instances) context.advance(dt); for (const callback of [...timers.values()]) callback(); };
  try { await run({ timers, advance }); }
  finally { Object.assign(globalThis, original); }
}

test('music is opt-in, menu transport runs without combat ticks, and mute/exit release audio', async () => withAudio(async ({ timers, advance }) => {
  const audio = createAudio();
  audio.setScene({ state: 'menu', stageId: 'cathedral' }); audio.setVolume(.3);
  assert.equal(Audio.instances.length, 0);
  assert.equal(await audio.setEnabled(true), true);
  const context = Audio.instances[0];
  assert.equal(context.state, 'running'); assert.equal(timers.size, 1);
  const initial = context.started.length;
  for (let i = 0; i < 30; i++) advance(.15);
  assert.ok(context.started.length > initial + 5, 'lobby score continues without tick()');
  assert.ok(context.started.some(source => source.type === 'triangle'));
  assert.ok(context.started.some(source => source.detune.value !== 0), 'choir has detuned layers');
  assert.equal(await audio.setEnabled(false), false);
  assert.equal(context.state, 'suspended'); assert.equal(timers.size, 0); assert.equal(context.active.size, 0);
  assert.equal(await audio.setEnabled(true), true);
  assert.equal(Audio.instances.length, 1, 'toggle reuses the same context');
  audio.dispose();
  assert.equal(context.state, 'closed'); assert.equal(timers.size, 0); assert.equal(context.active.size, 0);
  assert.equal(await audio.setEnabled(true), false, 'disposed audio cannot reopen');
}));

test('stage pitch, boss percussion and progression produce different actual arrangements', async () => withAudio(async ({ advance }) => {
  const audio = createAudio();
  audio.setScene({ state: 'playing', stageId: 'cathedral', time: 1, duration: 600 });
  await audio.setEnabled(true);
  const context = Audio.instances[0], cathedralFirst = context.started[0].frequency.value;
  assert.equal(audio.getTrack().id, 'hunt');
  const before = context.started.length;
  audio.setScene({ state: 'playing', stageId: 'foundry', time: 1, duration: 600 });
  const foundryFirst = context.started[before].frequency.value;
  assert.ok(Math.abs(foundryFirst / cathedralFirst - 2 ** (2 / 12)) < .00001, 'stage transposition reaches oscillator frequencies');
  audio.setScene({ state: 'playing', stageId: 'void', time: 400, duration: 600 });
  assert.equal(audio.getTrack().id, 'intense');
  audio.setScene({ state: 'playing', stageId: 'void', time: 400, duration: 600, boss: true });
  assert.equal(audio.getTrack().id, 'boss');
  assert.ok(context.started.some(source => source.buffer), 'percussion is a shaped noise source');
  for (let i = 0; i < 60; i++) advance(.1);
  assert.ok(context.started.filter(source => source.type === 'triangle').length > 20, 'ostinato has scheduled musical notes');
  audio.play('win'); assert.equal(audio.getTrack().id, 'victory');
  audio.play('death'); assert.equal(audio.getTrack().id, 'defeat');
  audio.dispose();
}));

test('cue bursts and catch-up scheduling stay bounded in both quality modes', async () => withAudio(async ({ timers, advance }) => {
  for (const quality of ['high', 'low']) {
    const audio = createAudio(); audio.setScene({ state: 'playing', boss: true, quality });
    await audio.setEnabled(true);
    const context = Audio.instances.at(-1), cap = quality === 'low' ? SCORE.mix.lowVoiceLimit : SCORE.mix.voiceLimit;
    for (let i = 0; i < 150; i++) {
      for (const cue of ['level','evolution','union','rescue','chest','pickup','hit','dash']) audio.play(cue);
      advance(.11);
      assert.ok(context.active.size <= cap);
    }
    assert.ok(context.peak <= cap, 'cap holds even while cues replace music voices');
    const count = context.started.length; advance(5000);
    assert.ok(context.started.length - count < cap, 'background catch-up cannot replay hours of notes');
    audio.pause(true); await audio.setEnabled(true);
    assert.equal(context.state, 'suspended'); assert.equal(context.active.size, 0); assert.equal(timers.size, 0);
    const pausedCount = context.started.length; audio.play('boss'); advance(5); assert.equal(context.started.length, pausedCount);
    audio.pause(false); await audio.setEnabled(true); assert.equal(context.state, 'running');
    audio.dispose();
  }
}));

test('volume and quiet overlays change the signal path without creating another context', async () => withAudio(async () => {
  const audio = createAudio(); audio.setVolume(2); assert.equal(audio.getTrack().volume, 1);
  audio.setVolume(NaN); assert.equal(audio.getTrack().volume, 1);
  await audio.setEnabled(true);
  const context = Audio.instances[0];
  audio.setVolume(0); assert.equal(context.gains[1].gain.value, 0);
  assert.equal(context.gains[0].gain.value, SCORE.mix.masterGain);
  audio.setVolume(.4); assert.equal(context.gains[1].gain.value, .4);
  audio.setScene({ state: 'upgrade', time: 20, duration: 600 });
  assert.equal(context.gains[1].gain.value, .4 * SCORE.mix.subduedGain);
  audio.setScene({ state: 'playing', time: 20, duration: 600 });
  assert.equal(context.gains[1].gain.value, .4);
  assert.equal(Audio.instances.length, 1);
  audio.dispose();
}));

test('music and combat effects retain independent audible signal paths', async () => withAudio(async ({ advance }) => {
  const audio = createAudio();
  audio.setVolume(0); audio.setEffectsVolume(.65);
  await audio.setEnabled(true);
  const context = Audio.instances[0], musicBus = context.gains[1], fxBus = context.gains[2];
  assert.equal(musicBus.gain.value, 0);
  assert.equal(fxBus.gain.value, .65 * SCORE.mix.effectsGain);
  const beforeCue = context.started.length;
  audio.play('level');
  const cue = context.started[beforeCue];
  assert.ok(cue, 'combat cue still has a source with music muted');
  assert.equal(cue.connections[0].connections[0].connections[0], fxBus, 'cue reaches its own unmuted bus');
  audio.setEffectsVolume(0); audio.setVolume(.55);
  assert.equal(fxBus.gain.value, 0);
  assert.equal(musicBus.gain.value, .55);
  const beforeScore = context.started.length;
  for (let i = 0; i < 8; i++) advance(.15);
  const musical = context.started.slice(beforeScore).find(source => source.connections[0]?.connections[0]?.connections[0] === musicBus);
  assert.ok(musical, 'score keeps reaching its own audible bus with effects muted');
  audio.setEffectsVolume(2); assert.equal(audio.getTrack().effectsVolume, 1);
  audio.setEffectsVolume(NaN); assert.equal(audio.getTrack().effectsVolume, 1);
  audio.setEffectsVolume(-1); assert.equal(audio.getTrack().effectsVolume, 0);
  assert.equal(Audio.instances.length, 1);
  audio.dispose();
}));

test('unsupported audio fails closed and scene metadata remains usable', async () => withAudio(async () => {
  globalThis.AudioContext = undefined;
  const audio = createAudio();
  assert.equal(await audio.setEnabled(true), false);
  assert.equal(audio.setScene({ state: 'menu', stageId: 'unknown' }).id, 'lobby');
  audio.pause(true); audio.play('boss'); audio.dispose();
  assert.equal(Audio.instances.length, 0);
}));
