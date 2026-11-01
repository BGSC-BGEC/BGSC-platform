"use client"

/**
 * Nimbus UI · Liquid Navbar — "Waterline" (Customized for BGSC)
 * A pill of water with rich orange accent, fluid droplet physics, caustics, and meniscus.
 * Compact vertical layout: Icon on top, label on bottom, matching mobile/dock aesthetic.
 */

import * as React from "react"

export type NimbusFx = "plane" | "drop" | "spin" | "glow" | "wave" | "pop" | "none"

export type LiquidNavItem = {
  label: string
  href?: string
  icon?: React.ReactNode
  /** the little scene the icon plays when tapped */
  fx?: NimbusFx
}

export type LiquidNavbarProps = {
  items?: LiquidNavItem[]
  defaultActive?: number
  active?: number
  onChange?: (index: number, item: LiquidNavItem) => void
  /** "light" water for bright backgrounds, "dark" for dark ones */
  tone?: "light" | "dark"
  /** icons only */
  compact?: boolean
  /** soft synthesized "plip" on tap (no audio files) */
  sound?: boolean
  className?: string
  style?: React.CSSProperties
}

/* ---------- Icons ---------- */
const I = (d: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="19"
    height="19"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
)

export const NimbusIcons = {
  home: I(
    <>
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M6 9.6V20h12V9.6" />
      <path className="nv-door" d="M10 20v-5h4v5Z" />
    </>
  ),
  flights: I(
    <path d="M21 12.2 3.6 5.4l2.7 6.8-2.7 6.4L21 12.2Zm-14.7 0H13" />
  ),
  plane: I(
    <path d="M21 12.2 3.6 5.4l2.7 6.8-2.7 6.4L21 12.2Zm-14.7 0H13" />
  ),
  status: I(
    <>
      <path d="M12 2C8.5 2 5.5 5 5.5 9.2c0 5 6.5 10.8 6.5 10.8s6.5-5.8 6.5-10.8C18.5 5 15.5 2 12 2Z" />
      <circle cx="12" cy="8.8" r="2.2" />
      <path d="M7 19.5c2.8 1.4 7.2 1.4 10 0" />
    </>
  ),
  profile: I(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" />
    </>
  ),
  user: I(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" />
    </>
  ),
  globe: I(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17" />
    </>
  ),
  drop: I(
    <path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z" />
  ),
  events: I(
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  auction: I(
    <>
      <path d="m14 13 5 5" />
      <path d="m3 21 8-8" />
      <path d="m9.5 7 5 5-2.5 2.5-5-5Z" />
      <path d="m3 3 5 5" />
    </>
  ),
  trophy: I(
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
      <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
}

export const DEFAULT_ITEMS: LiquidNavItem[] = [
  { label: "Home", icon: NimbusIcons.home, fx: "glow" },
  { label: "Flights", icon: NimbusIcons.flights, fx: "plane" },
  { label: "Status", icon: NimbusIcons.status, fx: "drop" },
  { label: "Profile", icon: NimbusIcons.profile, fx: "wave" },
]

export const BGSC_PLATFORM_ITEMS: LiquidNavItem[] = [
  { label: "Home", icon: NimbusIcons.home, fx: "glow", href: "/" },
  { label: "Events", icon: NimbusIcons.events, fx: "pop", href: "/events" },
  { label: "Auction", icon: NimbusIcons.auction, fx: "drop", href: "/auction" },
  { label: "Leaderboard", icon: NimbusIcons.trophy, fx: "spin", href: "/leaderboard" },
  { label: "Profile", icon: NimbusIcons.profile, fx: "wave", href: "/login" },
]

const PAD = 14 // canvas bleed around the pill, for shadows and ripples

/* ---------- Styles: Compact Vertical Layout with Orange Water Accent ---------- */
const NIMBUS_CSS = `
.nimbus-nav {
  --n-tint: rgba(255, 255, 255, 0.88);
  --n-fg: #0f172a;
  --n-fg-soft: rgba(30, 41, 59, 0.65);
  --n-rim: rgba(255, 255, 255, 0.95);
  --n-glow: rgba(249, 115, 22, 0.35);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 6px;
  border-radius: 9999px;
  isolation: isolate;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.18), 0 4px 14px -2px rgba(0, 0, 0, 0.08);
}
.nimbus-nav[data-tone="dark"] {
  --n-tint: rgba(12, 18, 34, 0.82);
  --n-fg: #f8fafc;
  --n-fg-soft: rgba(241, 245, 249, 0.65);
  --n-rim: rgba(255, 255, 255, 0.22);
  --n-glow: rgba(249, 115, 22, 0.45);
  box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.6), 0 4px 16px -2px rgba(0, 0, 0, 0.35);
}
.nimbus-glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -2;
  overflow: hidden;
  background: var(--n-tint);
  -webkit-backdrop-filter: blur(16px) saturate(1.4) brightness(1.06);
  backdrop-filter: blur(16px) saturate(1.4) brightness(1.06);
  box-shadow: inset 0 1px 1.5px var(--n-rim), inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}
.nimbus-nav[data-refract="on"] .nimbus-glass {
  -webkit-backdrop-filter: url(#nimbus-refract) blur(3px) saturate(1.3) brightness(1.06);
  backdrop-filter: url(#nimbus-refract) blur(3px) saturate(1.3) brightness(1.06);
}
.nimbus-water {
  position: absolute;
  left: ${-PAD}px;
  top: ${-PAD}px;
  z-index: -1;
  pointer-events: none;
}
.nimbus-nav[data-gl="off"] .nimbus-water {
  display: none;
}
.nimbus-drop {
  display: none;
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  border-radius: 9999px;
  z-index: -1;
  pointer-events: none;
  will-change: transform, width;
  background: linear-gradient(135deg, #fb923c 0%, #ea580c 100%);
  box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.65), inset 0 -2px 6px rgba(194, 65, 12, 0.4), 0 6px 18px -4px rgba(234, 88, 12, 0.55);
}
.nimbus-nav[data-gl="off"] .nimbus-drop {
  display: block;
}

/* Compact Vertical Item: Icon on top, Label on bottom */
.nimbus-item {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 52px;
  min-width: 66px;
  padding: 5px 12px;
  border: 0;
  border-radius: 9999px;
  background: none;
  color: var(--n-fg-soft);
  font-family: inherit;
  font-weight: 500;
  font-size: 11px;
  line-height: 1;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.nimbus-item:hover {
  color: var(--n-fg);
}
.nimbus-item:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Active State: Icon & Text become white over the orange liquid drop */
.nimbus-item[aria-current="page"] {
  color: #ffffff !important;
  font-weight: 600;
}
.nimbus-item[aria-current="page"] .nv-ico svg {
  stroke: #ffffff !important;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  transform: translateY(-1px) scale(1.08);
}
.nimbus-item[aria-current="page"] .nimbus-label {
  color: #ffffff !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.nv-ico {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.nv-ico svg {
  transition: transform 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.nimbus-label {
  white-space: nowrap;
  transition: color 0.2s ease;
}

.nv-door {
  fill: transparent;
}
.nv-ico[data-fx="pop"] svg {
  animation: nvPop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
@keyframes nvPop {
  0% { transform: scale(0.72); }
  60% { transform: scale(1.2); }
  100% { transform: translateY(-1px) scale(1.08); }
}

.nv-ico[data-fx="plane"] svg {
  animation: nvPlane 1.15s cubic-bezier(0.55, 0, 0.3, 1) both;
}
@keyframes nvPlane {
  0% { transform: none; }
  12% { transform: translate(-3px, 2px) rotate(7deg); }
  42% { transform: translate(64px, -26px) rotate(-24deg) scale(0.9); opacity: 0; }
  43% { transform: translate(-60px, 16px) rotate(-12deg) scale(0.9); opacity: 0; }
  58% { opacity: 1; }
  80% { transform: translate(3px, -1px) rotate(2deg); }
  100% { transform: translateY(-1px) scale(1.08); }
}
.nv-ico[data-fx="plane"]::after {
  content: "";
  position: absolute;
  left: 55%;
  top: 48%;
  height: 2px;
  width: 46px;
  border-radius: 2px;
  transform-origin: 0 50%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.95));
  animation: nvTrail 1.15s ease-out both;
  pointer-events: none;
}
@keyframes nvTrail {
  0%, 8% { opacity: 0; transform: rotate(-22deg) scaleX(0); }
  30% { opacity: 0.9; transform: rotate(-22deg) scaleX(1); }
  55%, 100% { opacity: 0; transform: rotate(-22deg) translateX(30px) scaleX(0.2); }
}

.nv-ico[data-fx="drop"] svg {
  animation: nvDrop 0.95s cubic-bezier(0.4, 0, 0.3, 1) both;
  transform-origin: 50% 100%;
}
@keyframes nvDrop {
  0% { transform: translateY(-1px); }
  26% { transform: translateY(-12px) scale(0.88, 1.12); }
  46% { transform: translateY(3px) scale(1.25, 0.72); }
  62% { transform: translateY(-3px) scale(0.94, 1.06); }
  80% { transform: translateY(0) scale(1.03, 0.97); }
  100% { transform: translateY(-1px) scale(1.08); }
}
.nv-ico[data-fx="drop"]::before,
.nv-ico[data-fx="drop"]::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: #fbbf24;
  opacity: 0;
  pointer-events: none;
}
.nv-ico[data-fx="drop"]::before {
  animation: nvSplashL 0.95s ease-out both;
}
.nv-ico[data-fx="drop"]::after {
  animation: nvSplashR 0.95s ease-out both;
}
@keyframes nvSplashL {
  0%, 44% { opacity: 0; transform: none; }
  50% { opacity: 0.9; transform: translate(-5px, -6px); }
  75%, 100% { opacity: 0; transform: translate(-11px, 1px) scale(0.4); }
}
@keyframes nvSplashR {
  0%, 44% { opacity: 0; transform: none; }
  50% { opacity: 0.9; transform: translate(5px, -7px); }
  75%, 100% { opacity: 0; transform: translate(12px, 1px) scale(0.4); }
}

.nv-ico[data-fx="spin"] svg {
  animation: nvSpin 1s cubic-bezier(0.2, 0.75, 0.25, 1) both;
}
@keyframes nvSpin {
  0% { transform: perspective(80px) rotateY(0); }
  100% { transform: perspective(80px) rotateY(360deg) translateY(-1px) scale(1.08); }
}

.nv-ico[data-fx="glow"] svg {
  animation: nvHop 0.8s cubic-bezier(0.3, 1.4, 0.5, 1) both;
  transform-origin: 50% 100%;
}
@keyframes nvHop {
  0% { transform: none; }
  30% { transform: translateY(-5px) scale(1.04, 0.96); }
  55% { transform: translateY(0) scale(1.12, 0.88); }
  75% { transform: translateY(-2px) scale(0.98, 1.04); }
  100% { transform: translateY(-1px) scale(1.08); }
}
.nv-ico[data-fx="glow"] .nv-door {
  animation: nvDoor 1.3s ease both;
}
@keyframes nvDoor {
  0% { fill: transparent; }
  30% { fill: #fef08a; }
  100% { fill: rgba(251, 146, 60, 0.8); }
}

.nv-ico[data-fx="wave"] svg {
  animation: nvWave 0.9s ease-in-out both;
  transform-origin: 50% 92%;
}
@keyframes nvWave {
  0% { transform: none; }
  20% { transform: rotate(-15deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(4deg); }
  100% { transform: translateY(-1px) scale(1.08); }
}

.nimbus-nav[data-compact="true"] .nimbus-item {
  min-width: 48px;
  padding: 5px 8px;
}
.nimbus-nav[data-compact="true"] .nimbus-label {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .nv-ico svg,
  .nv-ico::before,
  .nv-ico::after,
  .nv-door {
    animation: none !important;
    transition: none !important;
  }
}
`

/* ---------- WebGL Shaders with Warm Orange Accent ---------- */
const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`

const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec4 uPill;
uniform vec4 uBlob[6];
uniform float uSy[6];
uniform vec4 uRip[6];
uniform vec3 uMouse;
uniform float uDark;
uniform float uAmb;

float sdRB(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}

float sdCap(vec2 p, vec4 B, float sy){
  p -= B.xy;
  p.y /= sy;
  p.x = max(abs(p.x) - B.z, 0.);
  return (length(p) - B.w) * min(1., sy);
}

float smin(float a, float b, float k){
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

float dropD(vec2 p){
  float d = 1e4;
  for(int i = 0; i < 6; i++){
    if(uBlob[i].w > .5){
      d = smin(d, sdCap(p, uBlob[i], uSy[i]), 13.);
    }
  }
  return d;
}

float pillD(vec2 p){
  vec2 h = uPill.zw * .5;
  return sdRB(p - uPill.xy - h, h, h.y);
}

float lens(float d, float w){
  float t = clamp(-d / w, 0., 1.);
  return sqrt(1. - (1. - t) * (1. - t));
}

float waves(vec2 p){
  float w = 0.;
  for(int i = 0; i < 6; i++){
    vec4 R = uRip[i];
    if(R.w > 0.){
      float x = length(p - R.xy) - R.z * 240.;
      w += R.w * exp(-R.z * 1.7) * sin(x * .3) * exp(-x * x / 700.);
    }
  }
  vec2 m = p - uMouse.xy;
  w += uMouse.z * 3.6 * exp(-dot(m, m) / 1000.);
  w += uAmb * (sin(p.x * .05 + uTime * 1.2) * .45 + sin(p.x * .13 - uTime * .85 + p.y * .2) * .25);
  return w;
}

float H(vec2 p){
  float dp = pillD(p);
  return lens(dp, uPill.w * .36) * 2.4 + lens(dropD(p), 11.) * 7.5 + waves(p) * smoothstep(0., 7., -dp);
}

float caus(vec2 p, float t){
  vec2 q = p;
  float c = 0.;
  for(int i = 0; i < 3; i++){
    q += vec2(sin(q.y * 1.1 + t), cos(q.x * 1.3 - t * .7)) * .6;
    c += 1. / (1. + 16. * abs(sin(q.x) * sin(q.y)));
  }
  return c / 3.;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  float dp = pillD(p);
  float dd = dropD(p);

  float h0 = H(p);
  vec3 n = normalize(vec3(h0 - H(p + vec2(1., 0.)), h0 - H(p + vec2(0., 1.)), 1.));
  vec3 V = vec3(0., 0., 1.);

  float spec = pow(max(dot(reflect(-normalize(vec3(-.45, -.8, .85)), n), V), 0.), 70.);
  float spec2 = pow(max(dot(reflect(-normalize(vec3(.6, .75, .7)), n), V), 0.), 22.) * .3;
  float fres = clamp((1. - n.z) * 4., 0., 1.);

  // Orange solar/amber spectrum replacing rainbow iridescence
  vec3 orangeLow = vec3(0.98, 0.40, 0.08); // #fa6614
  vec3 orangeHigh = vec3(1.0, 0.76, 0.26); // #ffc242
  vec3 orangeDeep = vec3(0.90, 0.24, 0.04); // #e63d0a
  float wave = 0.5 + 0.5 * sin(fres * 2.8 + p.x * 0.005 + uTime * 1.1);
  vec3 orangeAcc = mix(mix(orangeLow, orangeHigh, wave), orangeDeep, fres * 0.35);

  float pm = smoothstep(1., -1., dp);
  float dm = smoothstep(1., -1., dd) * smoothstep(1., -2., dp);

  // Warm amber shadow under active drop
  float sh = smoothstep(9., -9., dropD(p - vec2(0., 5.))) * (1. - dm) * pm * (.14 + .08 * uDark);
  vec3 c = vec3(0.35, 0.12, 0.02) * sh;
  float a = sh;

  float pa = clamp(pm * (fres * .5 + spec * .9 + spec2), 0., 1.);
  c = mix(vec3(1.), orangeAcc, .5 * fres) * pa + c * (1. - pa);
  a = pa + a * (1. - pa);

  float th = lens(dd, 11.);
  float cs = caus((p + n.xy * th * 18.) * .085, uTime * .9);

  // Warm orange liquid body
  vec3 tint = mix(vec3(1.0, 0.94, 0.88), vec3(0.98, 0.58, 0.18), uDark);
  float rim = dm * (1. - smoothstep(0., 8., -dd));
  float cres = dm * smoothstep(.12, .55, dot(n.xy, normalize(vec2(.55, .85)))) * smoothstep(0., 3., -dd);
  float body = .5 + .5 * clamp(-n.y * 3., -1., 1.);

  // Rich, high-density orange capsule matching the reference image
  float da = dm * (0.90 + 0.10 * body);
  vec3 dc = mix(vec3(0.93, 0.35, 0.05), vec3(0.99, 0.56, 0.14), body * 0.65);

  // Specular, caustics, and rim reflections
  float la = rim * 0.32;
  vec3 lc = mix(vec3(0.92, 0.38, 0.06), vec3(0.98, 0.55, 0.14), uDark);
  dc = lc * la + dc * da * (1. - la);
  da = la + da * (1. - la);

  la = clamp(cres * 0.75 + smoothstep(0.6, 1.0, cs) * 0.32 * th * dm, 0., 1.);
  dc = mix(dc, vec3(1.0, 0.96, 0.90), la * 0.7);
  da = la + da * (1. - la);

  la = clamp(dm * (spec * 1.3 + spec2 * 0.5), 0., 1.);
  dc = mix(dc, vec3(1.0), la * 0.82);
  da = la + da * (1. - la);

  la = dm * smoothstep(-2., 0., dd) * 0.45;
  dc = mix(dc, orangeAcc, 0.35) * la + dc * (1. - la);
  da = la + da * (1. - la);

  c = dc + c * (1. - da);
  a = da + a * (1. - da);

  gl_FragColor = vec4(c, a);
}`

type Body = { x: number; v: number }
type Sat = { x: number; y: number; vx: number; vy: number; r: number; k: number }
type Rip = { x: number; y: number; age: number; amp: number }

function makeState() {
  return {
    a: { x: 0, v: 0 } as Body,
    b: { x: 0, v: 0 } as Body,
    sy: { s: 1, v: 0 },
    lead: 0 as 0 | 1,
    lagFrom: 0,
    sats: [] as Sat[],
    rips: [] as Rip[],
    t: { x: 0, cy: 0, q: 0, r: 21 },
    q: 0,
    mouse: { x: 0, y: 0, s: 0, on: false },
    moving: false,
    split: false,
    ready: false,
    w: 0,
    h: 0,
    visible: true,
    reduce: false,
    raf: 0,
    last: 0,
    time: 0,
    glc: null as null | { gl: WebGLRenderingContext; u: Record<string, WebGLUniformLocation | null> },
  }
}

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null
  if (!gl) return null
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = sh(gl.VERTEX_SHADER, VERT)
  const fs = sh(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
  gl.useProgram(p)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(p, "a")
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u: Record<string, WebGLUniformLocation | null> = {}
  for (const n of ["uRes", "uDpr", "uTime", "uPill", "uBlob", "uSy", "uRip", "uMouse", "uDark", "uAmb"]) {
    u[n] = gl.getUniformLocation(p, n)
  }
  return { gl, u }
}

function supportsRefraction() {
  if (typeof window === "undefined" || typeof CSS === "undefined") return false
  const ua = navigator.userAgent
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua) && !!(CSS as any).supports?.("backdrop-filter", "url(#a)")
}

export function LiquidNavbar({
  items = DEFAULT_ITEMS,
  defaultActive = 0,
  active,
  onChange,
  tone = "light",
  compact,
  sound = false,
  className,
  style,
}: LiquidNavbarProps) {
  const [inner, setInner] = React.useState(defaultActive)
  const current = active ?? inner
  const navRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const dropRef = React.useRef<HTMLSpanElement>(null)
  const itemRefs = React.useRef<(HTMLElement | null)[]>([])
  const iconRefs = React.useRef<(HTMLSpanElement | null)[]>([])
  const audio = React.useRef<AudioContext | null>(null)
  const st = React.useRef(makeState())

  const [gl, setGl] = React.useState<"on" | "off">("on")
  const [refract, setRefract] = React.useState(false)
  const [fx, setFx] = React.useState({ i: -1, n: 0 })
  const dark = tone === "dark" ? 1 : 0
  const darkRef = React.useRef(dark)
  darkRef.current = dark

  /* ---- drawing ---- */
  const draw = React.useCallback(() => {
    const s = st.current
    const T = s.t
    const sep = Math.abs(s.a.x - s.b.x)
    const thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1)
    const r = T.r * (1 - 0.3 * thin)
    if (s.glc) {
      const { gl: g, u } = s.glc
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight)
      g.uniform2f(u.uRes, s.w + PAD * 2, s.h + PAD * 2)
      g.uniform1f(u.uDpr, dpr)
      g.uniform1f(u.uTime, s.time)
      g.uniform4f(u.uPill, PAD, PAD, s.w, s.h)
      const blobs = new Float32Array(24)
      const sy = new Float32Array(6).fill(1)
      const head = s.lead === 0 ? s.a : s.b
      const tail = s.lead === 0 ? s.b : s.a
      blobs.set([
        head.x,
        T.cy,
        s.q * (1 - 0.25 * thin),
        T.r * (1 - 0.12 * thin),
        tail.x,
        T.cy,
        s.q * (1 - 0.8 * thin),
        T.r * (1 - 0.5 * thin),
      ], 0)
      sy[0] = sy[1] = s.sy.s
      s.sats.slice(0, 4).forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4))
      g.uniform4fv(u.uBlob, blobs)
      g.uniform1fv(u.uSy, sy)
      const rips = new Float32Array(24)
      s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4))
      g.uniform4fv(u.uRip, rips)
      g.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s)
      g.uniform1f(u.uDark, darkRef.current)
      g.uniform1f(u.uAmb, s.reduce ? 0 : 1)
      g.clearColor(0, 0, 0, 0)
      g.clear(g.COLOR_BUFFER_BIT)
      g.drawArrays(g.TRIANGLES, 0, 3)
    } else if (dropRef.current) {
      const left = Math.min(s.a.x, s.b.x) - s.q - r - PAD
      const width = sep + 2 * (s.q + r)
      dropRef.current.style.width = `${width}px`
      dropRef.current.style.transform = `translateX(${left}px) scaleY(${s.sy.s})`
    }
  }, [])

  /* ---- physics ---- */
  const step = React.useCallback((dt: number, now: number) => {
    const s = st.current
    const T = s.t
    s.time += dt
    s.q += (T.q - s.q) * Math.min(1, dt * 12)
    const bodies = [s.a, s.b]
    let still = true
    if (s.reduce) {
      s.a.x = s.b.x = T.x
      s.a.v = s.b.v = 0
      s.sy.s = 1
      s.sats = []
    } else {
      bodies.forEach((B, i) => {
        const lead = i === s.lead
        const k = lead ? 210 : 72
        const c = lead ? 25 : 13
        const f = !lead && now < s.lagFrom ? 0.08 : 1
        B.v += (k * (T.x - B.x) - c * B.v) * dt * f
        B.x += B.v * dt
        const lo = PAD + 6 + s.q + T.r - 3
        const hi = PAD + s.w - 6 - s.q - T.r + 3
        if (B.x < lo || B.x > hi) {
          s.sy.v -= Math.min(Math.abs(B.v), 900) * 0.0016
          B.x = Math.max(lo, Math.min(hi, B.x))
          B.v *= -0.25
        }
        if (Math.abs(T.x - B.x) > 0.3 || Math.abs(B.v) > 3) still = false
      })
      const L = bodies[s.lead]
      const syT = 1 - 0.2 * Math.min(Math.abs(L.v) / 1500, 1)
      s.sy.v += (280 * (syT - s.sy.s) - 9 * s.sy.v) * dt
      s.sy.s += s.sy.v * dt
      if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) still = false

      // Break the neck: spawn droplets on long leaps
      const sep = Math.abs(s.a.x - s.b.x)
      const r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1))
      if (!s.split && s.moving && sep - 2 * T.q - 2 * r > -6) {
        s.split = true
        const lo = bodies[1 - s.lead]
        const hi = bodies[s.lead]
        ;[0.3, 0.5, 0.72].forEach((t, j) => {
          s.sats.push({
            x: lo.x + (hi.x - lo.x) * t + (Math.random() - 0.5) * 6,
            y: T.cy + (Math.random() - 0.5) * 10,
            vx: (lo.v + hi.v) * 0.45,
            vy: (Math.random() - 0.5) * 60,
            r: 5 + Math.random() * 3 - j * 0.5,
            k: 70 + Math.random() * 90,
          })
        })
      }
      s.sats = s.sats.filter((d) => {
        d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt
        d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + s.w - 8 - d.r, d.x))
        d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y))
        if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26
        return d.r > 0.6
      })
      if (s.sats.length) still = false
    }
    if (s.moving && still) {
      s.moving = false
      if (s.split || !s.reduce) s.rips.push({ x: T.x, y: T.cy, age: 0, amp: s.split ? 1.2 : 0.7 })
    }
    s.rips.forEach((p) => (p.age += dt))
    s.rips = s.rips.filter((p) => p.age < 2.4)
    const target = s.mouse.on ? 1 : 0
    s.mouse.s += (target - s.mouse.s) * Math.min(1, dt * 7)
  }, [])

  const loop = React.useCallback(() => {
    const s = st.current
    if (s.raf) return
    s.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30)
      s.last = now
      step(dt, now)
      draw()
      const busy = s.moving || s.rips.length || s.sats.length || s.mouse.s > 0.01
      if (s.visible && (!s.reduce || busy)) s.raf = requestAnimationFrame(tick)
      else s.raf = 0
    }
    s.raf = requestAnimationFrame(tick)
  }, [draw, step])

  /* ---- measurement ---- */
  const measure = React.useCallback(() => {
    const nav = navRef.current
    const el = itemRefs.current[current]
    if (!nav || !el) return
    const s = st.current
    s.w = nav.offsetWidth
    s.h = nav.offsetHeight
    const T = s.t
    T.r = el.offsetHeight / 2
    T.q = Math.max(0, el.offsetWidth / 2 - T.r)
    T.cy = PAD + el.offsetTop + el.offsetHeight / 2
    const nx = PAD + el.offsetLeft + el.offsetWidth / 2
    if (!s.ready) {
      s.a.x = s.b.x = nx
      s.q = T.q
      s.ready = true
    } else if (Math.abs(nx - T.x) > 0.5) {
      s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1
      s.lagFrom = performance.now() + 70
      s.moving = true
      s.split = false
    }
    T.x = nx
    const cv = canvasRef.current
    if (cv) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = s.w + PAD * 2
      const Hh = s.h + PAD * 2
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(Hh * dpr)
        cv.style.width = `${W}px`
        cv.style.height = `${Hh}px`
      }
    }
    loop()
  }, [current, loop])

  React.useEffect(() => {
    setRefract(supportsRefraction())
    const s = st.current
    s.reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const cv = canvasRef.current
    s.glc = cv ? initGL(cv) : null
    if (!s.glc) setGl("off")
    const lost = (e: Event) => {
      e.preventDefault()
      s.glc = null
      setGl("off")
    }
    cv?.addEventListener("webglcontextlost", lost)
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting
      if (s.visible) loop()
    })
    if (navRef.current) io.observe(navRef.current)
    const vis = () => {
      s.visible = document.visibilityState === "visible"
      if (s.visible) loop()
    }
    document.addEventListener("visibilitychange", vis)
    return () => {
      cv?.removeEventListener("webglcontextlost", lost)
      io.disconnect()
      document.removeEventListener("visibilitychange", vis)
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [loop])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, items.length, compact])

  const measureRef = React.useRef(measure)
  measureRef.current = measure
  React.useEffect(() => {
    let lastW = -1
    const ro = new ResizeObserver(() => {
      const w = navRef.current?.offsetWidth ?? 0
      if (w !== lastW) {
        lastW = w
        st.current.ready = false
        measureRef.current()
      }
    })
    if (navRef.current) ro.observe(navRef.current)
    return () => ro.disconnect()
  }, [])

  React.useEffect(() => {
    loop()
  }, [tone, loop])

  /* ---- interactions ---- */
  const local = (clientX: number, clientY: number) => {
    const r = navRef.current!.getBoundingClientRect()
    return { x: clientX - r.left + PAD, y: clientY - r.top + PAD }
  }
  const ripple = (x: number, y: number, amp: number) => {
    const s = st.current
    if (s.reduce) return
    s.rips.push({ x, y, age: 0, amp })
    loop()
  }
  const iconCenter = (i: number) => {
    const el = iconRefs.current[i]
    if (!el) return null
    const b = el.getBoundingClientRect()
    return local(b.left + b.width / 2, b.top + b.height / 2)
  }
  const plip = () => {
    if (!sound) return
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      const ctx = (audio.current ||= new AC())
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(440 + Math.random() * 80, t)
      o.frequency.exponentialRampToValueAtTime(1550, t + 0.07)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.18)
    } catch {
      /* Audio playback not permitted or unavailable */
    }
  }

  const select = (i: number) => {
    const kind = items[i]?.fx ?? (items[i]?.icon ? "pop" : "none")
    setFx((f) => ({ i, n: f.n + 1 }))
    plip()
    const c = iconCenter(i)
    if (c && kind === "drop") setTimeout(() => ripple(c.x, st.current.t.cy, 1.4), 430)
    if (c && kind === "plane") ripple(c.x, c.y, 0.6)
    if (i !== current) {
      if (active === undefined) setInner(i)
      onChange?.(i, items[i])
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const n = (current + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length
    select(n)
    itemRefs.current[n]?.focus()
  }

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    const p = local(e.clientX, e.clientY)
    const s = st.current
    s.mouse.x = p.x
    s.mouse.y = p.y
    s.mouse.on = true
    loop()
  }

  return (
    <nav
      ref={navRef as any}
      className={["nimbus-nav", className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-gl={gl}
      data-compact={compact === undefined ? undefined : String(compact)}
      data-refract={refract ? "on" : "off"}
      aria-label="Main navigation"
      onKeyDown={onKeyDown}
      onPointerMove={onMove}
      onPointerLeave={() => {
        st.current.mouse.on = false
        loop()
      }}
      onPointerDown={(e) => {
        const p = local(e.clientX, e.clientY)
        ripple(p.x, p.y, 0.8)
      }}
      style={style}
    >
      <style dangerouslySetInnerHTML={{ __html: NIMBUS_CSS }} />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="nimbus-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="60" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span className="nimbus-glass" aria-hidden="true" />
      <canvas className="nimbus-water" ref={canvasRef} aria-hidden="true" />
      <span className="nimbus-drop" ref={dropRef} aria-hidden="true" />
      {items.map((it, i) => {
        const kind = it.fx ?? "pop"
        const playing = fx.i === i && kind !== "none"
        const isCurrent = i === current
        const props = {
          ref: (el: HTMLElement | null) => {
            itemRefs.current[i] = el
          },
          className: "nimbus-item",
          "aria-current": isCurrent ? ("page" as const) : undefined,
          onClick: () => select(i),
        }
        const content = (
          <>
            {it.icon && (
              <span
                className="nv-ico"
                key={playing ? fx.n : 0}
                data-fx={playing ? kind : undefined}
                ref={(el) => {
                  iconRefs.current[i] = el
                }}
              >
                {it.icon}
              </span>
            )}
            <span className="nimbus-label">{it.label}</span>
          </>
        )
        return it.href ? (
          <a key={it.label + i} {...(props as any)} href={it.href} aria-label={it.label}>
            {content}
          </a>
        ) : (
          <button key={it.label + i} {...(props as any)} type="button" aria-label={it.label}>
            {content}
          </button>
        )
      })}
    </nav>
  )
}

export { LiquidNavbar as Component }
export default LiquidNavbar
