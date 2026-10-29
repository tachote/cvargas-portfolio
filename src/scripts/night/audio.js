import SCORE from '../../data/night-music.json' with { type: 'json' };

/** Original adaptive gothic score. One context, bounded voices, explicit opt-in. */
export function createAudio() {
  const MIX = SCORE.mix, voices = new Map(), lastCue = new Map();
  let context, master, musicBus, fxBus, reverb, noiseBuffer, timer, pending = Promise.resolve();
  let enabled = false, paused = false, disposed = false, volume = MIX.defaultVolume;
  let effectsVolume = MIX.defaultEffectsVolume;
  let sceneId = 'lobby', stageId = 'cathedral', quality = 'high', subdued = false;
  let step = 0, nextAt = 0, elapsed = 0, externalScene = false;
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const limit = () => quality === 'low' ? MIX.lowVoiceLimit : MIX.voiceLimit;
  const audible = () => enabled && !paused && !disposed && context?.state === 'running';

  function remove(source) {
    const voice = voices.get(source);
    if (!voice) return;
    voices.delete(source);
    for (const node of voice.nodes) node.disconnect();
  }
  function stopVoices(musicOnly = false) {
    for (const [source, voice] of voices) {
      if (musicOnly && voice.cue) continue;
      try { source.stop(); } catch { /* An ended source is already silent. */ }
      remove(source);
    }
  }
  function stopTransport() { clearInterval(timer); timer = undefined; stopVoices(); }
  function makeImpulse(seconds, seed) {
    const buffer = context.createBuffer(2, Math.floor(context.sampleRate * seconds), context.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = (seed / 0xffffffff * 2 - 1) * (1 - i / samples.length) ** 3;
      }
    }
    return buffer;
  }
  function build() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable.');
    context = new Audio();
    master = context.createGain(); musicBus = context.createGain(); fxBus = context.createGain();
    const compressor = context.createDynamicsCompressor(), lowpass = context.createBiquadFilter(), wet = context.createGain();
    for (const [key, value] of Object.entries(MIX.compressor)) compressor[key].value = value;
    lowpass.type = 'lowpass'; lowpass.frequency.value = 6500; lowpass.Q.value = .4;
    master.gain.value = MIX.masterGain;
    musicBus.gain.value = volume * (subdued ? MIX.subduedGain : 1);
    fxBus.gain.value = effectsVolume * MIX.effectsGain;
    reverb = context.createConvolver(); reverb.buffer = makeImpulse(MIX.reverbSeconds, 1729);
    wet.gain.value = MIX.wetGain;
    musicBus.connect(lowpass); lowpass.connect(master); lowpass.connect(reverb); reverb.connect(wet); wet.connect(master);
    fxBus.connect(master); master.connect(compressor); compressor.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    let seed = 8191;
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      noise[i] = seed / 0xffffffff * 2 - 1;
    }
  }
  function reserve(cue) {
    if (!audible()) return false;
    const cap = limit();
    if (!cue) return voices.size < cap - MIX.cueReserve;
    if (voices.size >= cap) {
      const oldestMusic = [...voices].find(([, voice]) => !voice.cue);
      if (!oldestMusic) return false;
      try { oldestMusic[0].stop(); } catch { /* Already ended. */ }
      remove(oldestMusic[0]);
    }
    return true;
  }
  function voice(source, at, duration, level, attack, pan, cue, filter) {
    const gain = context.createGain(), panner = context.createStereoPanner();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level), at + Math.min(attack, duration * .4));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const nodes = [source, gain, panner];
    if (filter) {
      const shaped = context.createBiquadFilter(); shaped.type = filter.type; shaped.frequency.value = filter.frequency; shaped.Q.value = .7;
      source.connect(shaped); shaped.connect(gain); nodes.push(shaped);
    } else source.connect(gain);
    gain.connect(panner); panner.connect(cue ? fxBus : musicBus);
    voices.set(source, { nodes, cue });
    source.onended = () => remove(source);
    source.start(at); source.stop(at + duration + .03);
  }
  function tone(midi, at, duration, type, level, options = {}) {
    const { cue = false, attack = .015, pan = 0, detune = 0, slide = 1 } = options;
    if (!level || !reserve(cue)) return;
    const source = context.createOscillator(), hz = frequency(midi);
    source.type = type; source.detune.value = detune;
    source.frequency.setValueAtTime(hz, at);
    if (slide !== 1) source.frequency.exponentialRampToValueAtTime(Math.max(20, hz * slide), at + duration);
    voice(source, at, duration, level, attack, pan, cue);
  }
  function noise(at, duration, level, type = 'highpass', hz = 3500, pan = 0) {
    if (!level || !reserve(false)) return;
    const source = context.createBufferSource(); source.buffer = noiseBuffer;
    voice(source, at, duration, level, .008, pan, false, { type, frequency: hz });
  }
  function arrange(at) {
    const section = SCORE.scenes[sceneId], length = section.beats * section.subdivisions;
    const position = step % length, barIndex = Math.floor(step / length) % section.bars.length;
    const bar = section.bars[barIndex], beatSeconds = 60 / section.bpm, transpose = SCORE.stages[stageId]?.transpose || 0;
    const layers = section.layers, chord = bar.chord.map(note => note + transpose), melodic = bar.melody[position];
    if (position === 0) {
      chord.forEach((midi, i) => tone(midi, at, beatSeconds * (section.beats + .8), 'triangle', layers.pad, { attack: .45, pan: (i - 1.5) * .3 }));
      chord.slice(1).forEach((midi, i) => {
        tone(midi + 12, at, beatSeconds * (section.beats + .4), 'sine', layers.choir, { attack: .7, pan: (i - 1) * .4, detune: i % 2 ? 5 : -5 });
        if (quality !== 'low') tone(midi + 12, at, beatSeconds * (section.beats + .4), 'sine', layers.choir * .45, { attack: .8, pan: (1 - i) * .4, detune: i % 2 ? -5 : 5 });
      });
    }
    if (position % 2 === 0) tone(chord[0] - 12, at, beatSeconds * 1.5, 'sine', layers.bass, { attack: .045 });
    if (layers.strings) {
      const midi = chord[section.ostinato[position % section.ostinato.length]];
      tone(midi + 12, at, beatSeconds * .62, 'triangle', layers.strings, { attack: .035, pan: position % 2 ? .35 : -.35 });
      if (sceneId === 'boss' && quality !== 'low') tone(midi + 24, at, beatSeconds * .42, 'sine', layers.strings * .25, { attack: .025, pan: position % 2 ? -.4 : .4 });
    }
    if (melodic != null) {
      tone(melodic + transpose, at, beatSeconds * 1.7, 'sine', layers.bell, { pan: position % 2 ? .24 : -.24 });
      tone(melodic + transpose + 12, at, beatSeconds * .78, 'sine', layers.bell * .16, { pan: position % 2 ? -.25 : .25, detune: 4 });
    }
    if (layers.drums && position % 2 === 0) {
      const accent = position === 0 ? 1 : position === 4 ? .8 : .48;
      tone(43, at, .43, 'sine', layers.drums * accent, { attack: .012, slide: .48 });
      if (position === 0 || position === 4) noise(at, .2, layers.drums * .12, 'bandpass', 260, position === 0 ? -.25 : .25);
    }
    if (layers.cymbal && quality !== 'low') noise(at, .09, layers.cymbal * (position % 2 ? .65 : 1), 'highpass', 4800, position % 2 ? -.3 : .3);
    if (sceneId === 'boss' && position === length - 1) tone(45 + transpose, at, .2, 'triangle', layers.drums * .32, { attack: .01, slide: .7 });
    step++;
    return beatSeconds / section.subdivisions;
  }
  function schedule() {
    if (!audible()) return;
    if (nextAt < context.currentTime - MIX.lookAhead) nextAt = context.currentTime + .035;
    let count = 0;
    while (nextAt < context.currentTime + MIX.lookAhead && count++ < MIX.maxCatchupSteps) nextAt += arrange(nextAt);
  }
  function sync() {
    if (!enabled || paused) stopTransport();
    pending = pending.then(async () => {
      if (disposed || !context || context.state === 'closed') return;
      if (enabled && !paused) {
        await context.resume();
        if (disposed) return;
        if (enabled && !paused) {
          if (!timer) { nextAt = context.currentTime + .035; schedule(); timer = setInterval(schedule, MIX.schedulerMs); }
        } else { stopTransport(); await context.suspend(); }
      } else await context.suspend();
    }).catch(() => { enabled = false; stopTransport(); });
    return pending;
  }
  function changeScene(id) {
    if (!SCORE.scenes[id] || sceneId === id) return;
    sceneId = id; step = 0; stopVoices(true);
    if (context) { nextAt = context.currentTime + .035; schedule(); }
  }
  return {
    async setEnabled(value) {
      if (disposed) return false;
      enabled = Boolean(value);
      if (enabled && !context) { try { build(); } catch { enabled = false; return false; } }
      await sync(); return enabled;
    },
    pause(value) {
      const next = Boolean(value);
      if (paused === next || disposed) return;
      paused = next;
      if (paused) step -= step % (SCORE.scenes[sceneId].beats * SCORE.scenes[sceneId].subdivisions);
      void sync();
    },
    setScene(scene = {}) {
      externalScene = true;
      const previousStage = stageId;
      if (typeof scene.stageId === 'string') stageId = scene.stageId;
      quality = scene.quality === 'low' ? 'low' : 'high';
      if (Number.isFinite(scene.time)) elapsed = Math.max(0, scene.time);
      const nextSubdued = ['upgrade', 'chest', 'arcana', 'merchant'].includes(scene.state);
      if (subdued !== nextSubdued) { subdued = nextSubdued; musicBus?.gain.setTargetAtTime(volume * (subdued ? MIX.subduedGain : 1), context.currentTime, .18); }
      const duration = Number.isFinite(scene.duration) && scene.duration > 0 ? scene.duration : MIX.defaultDuration;
      let next = sceneId;
      if (['menu', 'lobby'].includes(scene.state)) next = 'lobby';
      else if (scene.state === 'dead' || scene.state === 'defeat') next = 'defeat';
      else if (scene.state === 'won' || scene.state === 'victory') next = 'victory';
      else if (scene.state === 'playing' || nextSubdued) next = scene.boss ? 'boss' : elapsed / duration >= MIX.intenseAt ? 'intense' : 'hunt';
      changeScene(next);
      if (previousStage !== stageId) { step = 0; stopVoices(true); if (context) { nextAt = context.currentTime + .035; schedule(); } }
      return this.getTrack();
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return volume;
      volume = Math.max(0, Math.min(1, value));
      musicBus?.gain.setTargetAtTime(volume * (subdued ? MIX.subduedGain : 1), context.currentTime, .04);
      return volume;
    },
    setEffectsVolume(value) {
      if (!Number.isFinite(value)) return effectsVolume;
      effectsVolume = Math.max(0, Math.min(1, value));
      fxBus?.gain.setTargetAtTime(effectsVolume * MIX.effectsGain, context.currentTime, .04);
      return effectsVolume;
    },
    getTrack() { return { id: sceneId, title: SCORE.scenes[sceneId].title, subtitle: SCORE.stages[stageId]?.subtitle || SCORE.scenes[sceneId].subtitle, volume, effectsVolume }; },
    tick(dt) {
      if (!externalScene && enabled && !paused && Number.isFinite(dt)) { elapsed += Math.max(0, Math.min(.1, dt)); changeScene(elapsed >= MIX.defaultDuration * MIX.intenseAt ? 'intense' : 'hunt'); }
    },
    play(type) {
      if (type === 'win') changeScene('victory');
      else if (type === 'death') changeScene('defeat');
      else if (type === 'boss') changeScene('boss');
      if (!audible()) return;
      const now = context.currentTime;
      if (now - (lastCue.get(type) ?? -Infinity) < .1) return;
      lastCue.set(type, now);
      const at = now + .005, transpose = SCORE.stages[stageId]?.transpose || 0;
      const cue = (midi, duration, level, delay = 0, options = {}) => tone(midi + transpose, at + delay, duration, 'triangle', level, { cue: true, ...options });
      if (['level', 'evolution', 'union', 'rescue'].includes(type)) [62, 69, 74, 77].forEach((note, i) => cue(note, .65, .15 - i * .018, i * .075));
      else if (type === 'chest' || type === 'pickup') { cue(81, .24, .09); cue(86, .3, .065, .06); }
      else if (type === 'hit') cue(38, .13, .09, 0, { slide: .5 });
      else if (type === 'boss') { cue(38, 1.4, .2); cue(45, 1.4, .12); cue(50, 1.2, .08, .1); }
      else if (type === 'death') { cue(62, 1, .14, 0, { slide: .5 }); cue(50, 1.3, .12, .12); }
      else if (type === 'win') [62, 66, 69, 74].forEach((note, i) => cue(note, 2.2, .12, i * .12));
      else if (type === 'dash') cue(57, .15, .07, 0, { slide: 2 });
    },
    dispose() {
      disposed = true; enabled = false; stopTransport(); lastCue.clear();
      const old = context; context = undefined; master = undefined; musicBus = undefined; fxBus = undefined; reverb = undefined; noiseBuffer = undefined;
      old?.close().catch(() => {});
    }
  };
}
