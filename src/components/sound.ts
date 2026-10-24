"use client";

// Synthesised game sounds — no audio assets needed.

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem("kaniup-muted") === "1") return null;
  } catch {}
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "square", volume = 0.08) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  gain.gain.setValueAtTime(volume, a.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + duration);
}

/** Classic two-note coin pickup. */
export function playCoin() {
  tone(988, 0, 0.08);
  tone(1319, 0.08, 0.35);
}

/** Cash register-ish burst for big XP payouts. */
export function playCash() {
  [1319, 1568, 1976, 2637].forEach((f, i) => tone(f, i * 0.06, 0.25, "square", 0.06));
  tone(2093, 0.3, 0.5, "triangle", 0.07);
}

export function playLevelUp() {
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.09));
}

export function playBlip() {
  tone(660, 0, 0.06, "sine", 0.06);
}

export function playWhoosh() {
  tone(300, 0, 0.12, "sawtooth", 0.03);
  tone(600, 0.05, 0.12, "sine", 0.04);
}

export function isMuted() {
  try {
    return localStorage.getItem("kaniup-muted") === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem("kaniup-muted", muted ? "1" : "0");
  } catch {}
}
