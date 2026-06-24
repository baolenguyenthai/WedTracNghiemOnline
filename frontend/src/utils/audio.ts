// Khởi tạo AudioContext (chỉ khởi tạo khi cần để tránh bị browser block nếu chưa tương tác)
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playPop() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

export function playTing() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
  osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Slide up

  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

export function playBuzzer() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, ctx.currentTime);

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

export function playTickTock() {
  const ctx = getAudioContext();
  
  // Tick
  const oscTick = ctx.createOscillator();
  const gainTick = ctx.createGain();
  oscTick.type = "square";
  oscTick.frequency.setValueAtTime(800, ctx.currentTime);
  gainTick.gain.setValueAtTime(0.1, ctx.currentTime);
  gainTick.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  oscTick.connect(gainTick);
  gainTick.connect(ctx.destination);
  oscTick.start();
  oscTick.stop(ctx.currentTime + 0.05);

  // Tock (sau 0.5s)
  const oscTock = ctx.createOscillator();
  const gainTock = ctx.createGain();
  oscTock.type = "square";
  oscTock.frequency.setValueAtTime(400, ctx.currentTime + 0.5);
  gainTock.gain.setValueAtTime(0.1, ctx.currentTime + 0.5);
  gainTock.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
  oscTock.connect(gainTock);
  gainTock.connect(ctx.destination);
  oscTock.start(ctx.currentTime + 0.5);
  oscTock.stop(ctx.currentTime + 0.55);
}

export function playWin() {
  const ctx = getAudioContext();
  
  // Hợp âm chiến thắng (C Major arpeggio)
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.1 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 1);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + i * 0.1 + 1);
  });
}

// ═══════════════════════════════════════════════
// TEXT-TO-SPEECH
// ═══════════════════════════════════════════════
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  
  stopSpeaking(); // Dừng nếu đang đọc dở

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN"; // Tiếng Việt
  // Chọn giọng nữ nếu có, nếu không fallback
  const availableVoices = window.speechSynthesis.getVoices();
  const femaleVoice = availableVoices.find(v => v.lang.startsWith("vi") && /female|woman|girl|nữ|cô|chị/i.test(v.name));
  if (femaleVoice) utterance.voice = femaleVoice;
  // Tốc độ nhanh, giọng cao hơn để giống voice review phim
  utterance.rate = 1.6; // nhanh hơn (1.0 = chuẩn)
  utterance.pitch = 1.3; // giọng cao hơn

  
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}
