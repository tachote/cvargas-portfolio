/** An original slow minor-key score. Audio nodes exist only after explicit opt-in. */
export function createAmbience(score, onChange) {
  let context, master, bus, timer, nextAt = 0, beat = 0;
  let enabled = false, blocked = false, disposed = false, failed = false;
  let volume = score.defaultVolume, pending = Promise.resolve();
  const voices = new Set();
  const seconds = 60 / score.tempo;
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const notify = () => onChange({ enabled, playing: enabled && !blocked && context?.state === 'running', blocked, volume, failed });

  function stopVoices() {
    clearInterval(timer); timer = undefined;
    for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } voice.disconnect(); }
    voices.clear();
  }

  function build() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable.');
    context = new Audio();
    master = context.createGain(); bus = context.createGain();
    const compressor = context.createDynamicsCompressor(), reverb = context.createConvolver(), wet = context.createGain();
    compressor.threshold.value = -20; compressor.ratio.value = 3;
    master.gain.value = volume / 100 * score.maxGain;
    wet.gain.value = .25;
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * score.reverbSeconds), context.sampleRate);
    let seed = 419;
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = (seed / 0xffffffff * 2 - 1) * (1 - i / samples.length) ** 3;
      }
    }
    reverb.buffer = impulse;
    bus.connect(master); bus.connect(reverb); reverb.connect(wet); wet.connect(master);
    master.connect(compressor); compressor.connect(context.destination);
    context.addEventListener('statechange', notify);
  }

  function note(midi, at, duration, level, type, pan = 0, attack = .02, multiplier = 1) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    const panner = context.createStereoPanner();
    oscillator.type = type; oscillator.frequency.value = frequency(midi) * multiplier;
    panner.pan.value = pan;
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(panner); panner.connect(bus);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); panner.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .03);
  }

  function schedule() {
    if (!enabled || blocked || context?.state !== 'running') return;
    while (nextAt < context.currentTime + .15) {
      const bar = score.bars[Math.floor(beat / score.beatsPerBar) % score.bars.length], index = beat % score.beatsPerBar;
      if (index === 0) bar.chord.forEach((midi, i) => {
        note(midi, nextAt, seconds * (score.beatsPerBar + .7), .055, 'triangle', (i - 1.5) * .3, .65);
        note(midi + 12, nextAt, seconds * score.beatsPerBar, .018, 'sine', (1.5 - i) * .3, .8);
      });
      if (index % 2 === 0) note(bar.chord[0] - 12, nextAt, seconds * 1.8, .14, 'sine', 0, .08);
      if (bar.melody[index] != null) {
        note(bar.melody[index], nextAt, seconds * 1.7, .07, 'sine', index % 2 ? .32 : -.32);
        note(bar.melody[index], nextAt, seconds * .8, .012, 'sine', 0, .01, 2.01);
      }
      nextAt += seconds; beat++;
    }
  }

  function sync() {
    if (!enabled || blocked) stopVoices();
    pending = pending.then(async () => {
      if (disposed || !context) return;
      if (enabled && !blocked) {
        await context.resume();
        if (disposed) return;
        if (enabled && !blocked) {
          if (!timer) { nextAt = context.currentTime + .06; schedule(); timer = setInterval(schedule, 100); }
        } else { stopVoices(); await context.suspend(); }
      } else if (context.state !== 'closed') await context.suspend();
      notify();
    }).catch(() => { failed = true; enabled = false; stopVoices(); notify(); });
    return pending;
  }

  return {
    toggle() {
      if (disposed) return Promise.resolve();
      failed = false; enabled = !enabled;
      if (enabled && !context) {
        try { build(); } catch { enabled = false; failed = true; notify(); return Promise.resolve(); }
      }
      notify(); return sync();
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.max(0, Math.min(100, value));
      master?.gain.setTargetAtTime(volume / 100 * score.maxGain, context.currentTime, .04);
      notify();
    },
    setBlocked(value) { if (blocked === value || disposed) return; blocked = value; notify(); return sync(); },
    dispose() {
      disposed = true; enabled = false; stopVoices();
      context?.close().catch(() => {});
    }
  };
}
