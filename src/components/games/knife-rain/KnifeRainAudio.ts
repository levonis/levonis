/**
 * Knife Rain - Web Audio API Sound Effects
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", vol = 0.15) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function playNoise(duration: number, vol = 0.08) {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2000;
  source.connect(filter).connect(gain).connect(c.destination);
  source.start();
}

export function playThrow() {
  playNoise(0.12, 0.06);
  playTone(800, 0.08, "sine", 0.05);
}

export function playStick() {
  playTone(220, 0.15, "triangle", 0.2);
  playTone(440, 0.08, "square", 0.05);
}

export function playHitKnife() {
  playTone(150, 0.3, "sawtooth", 0.15);
  playTone(100, 0.4, "square", 0.1);
  playNoise(0.15, 0.12);
}

export function playStageClear() {
  const c = getCtx();
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.2, "sine", 0.12), i * 80);
  });
}

export function playBossDefeat() {
  const c = getCtx();
  [440, 554, 659, 880, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, "triangle", 0.15), i * 100);
  });
}
