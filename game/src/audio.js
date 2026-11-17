// Synthesised sound: every sound and the music loop are generated with WebAudio.
// No audio files, no network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let enabled = true;
  let musicStep = 0;

  // A short original bassline + hats loop (A minor-ish, 112 BPM, 8 steps a bar).
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    const stepDur = 60 / 112 / 2;
    musicTimer = window.setInterval(() => {
      if (!enabled || document.hidden) return;
      const freq = BASS[musicStep % BASS.length];
      if (freq) tone(freq, stepDur * 1.8, 'triangle', 0.16);
      if (musicStep % 4 === 2) tone(880, 0.06, 'sine', 0.05);
      musicStep += 1;
    }, stepDur * 1000);
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    resume,
    startMusic,
    stopMusic,
    setEnabled(value) {
      enabled = value;
      if (master) master.gain.value = value ? 0.5 : 0;
    },
    gunshot() {
      noise(0.14, 0.5, 1800);
      tone(140, 0.1, 'square', 0.25);
    },
    punch() {
      noise(0.08, 0.4, 500);
      tone(90, 0.09, 'sine', 0.4);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.3);
      tone(990, 0.18, 'sine', 0.3, 0.1);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, i * 0.11));
    },
    wantedUp() {
      tone(220, 0.15, 'square', 0.2);
      tone(185, 0.25, 'square', 0.2, 0.14);
    },
    busted() {
      [330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.2, i * 0.18));
    },
    crash() {
      noise(0.25, 0.5, 900);
    },
    carDoor() {
      noise(0.07, 0.25, 1200);
    },
    setEngine(speed01, driving) {
      if (!ensure()) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },
    setSiren(on, time) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(time * 4) > 0 ? 950 : 650, ctx.currentTime, 0.05);
    },
  };
}
