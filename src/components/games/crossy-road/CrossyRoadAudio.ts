const AUDIO_BASE = '/games/crossy-road/audio';

const SOUNDS = {
  hop: Array.from({ length: 12 }, (_, i) => `${AUDIO_BASE}/buck${i + 1}.wav`),
  carHorn: `${AUDIO_BASE}/car-horn.wav`,
  carHit: `${AUDIO_BASE}/carhit.mp3`,
  trainAlarm: `${AUDIO_BASE}/Train_Alarm.wav`,
  trainPass: `${AUDIO_BASE}/train_pass_shorter.wav`,
  death: `${AUDIO_BASE}/chickendeath.wav`,
  coin: `${AUDIO_BASE}/coin.mp3`,
  water: `${AUDIO_BASE}/watersplashlow.mp3`,
};

class CrossyRoadAudio {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private hopIndex = 0;

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const all = [
      ...SOUNDS.hop,
      SOUNDS.carHorn, SOUNDS.carHit,
      SOUNDS.trainAlarm, SOUNDS.trainPass,
      SOUNDS.death, SOUNDS.coin, SOUNDS.water,
    ];
    await Promise.all(all.map(url => this.load(url)));
  }

  private async load(url: string) {
    if (!this.ctx || this.buffers.has(url)) return;
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const audio = await this.ctx.decodeAudioData(buf);
      this.buffers.set(url, audio);
    } catch { /* silent */ }
  }

  private play(url: string, volume = 0.5) {
    if (!this.ctx) return;
    const buf = this.buffers.get(url);
    if (!buf) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  playHop() {
    const url = SOUNDS.hop[this.hopIndex % SOUNDS.hop.length];
    this.hopIndex++;
    this.play(url, 0.4);
  }

  playCarHorn() { this.play(SOUNDS.carHorn, 0.3); }
  playCarHit() { this.play(SOUNDS.carHit, 0.6); }
  playTrainAlarm() { this.play(SOUNDS.trainAlarm, 0.4); }
  playTrainPass() { this.play(SOUNDS.trainPass, 0.3); }
  playDeath() { this.play(SOUNDS.death, 0.6); }
  playCoin() { this.play(SOUNDS.coin, 0.5); }
  playWater() { this.play(SOUNDS.water, 0.5); }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
    this.buffers.clear();
  }
}

export default CrossyRoadAudio;
