// Renders the illustrative images used by PromptVault's sample library.
// Every image is drawn procedurally as SVG here and rasterised with a headless
// browser, so the sample artwork is original and freely redistributable.
//
// Usage: node scripts/generate-sample-art.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'samples')

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(c1, c2, t) {
  const a = hexToRgb(c1)
  const b = hexToRgb(c2)
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`
}

/** 1D midpoint-displacement ridge line. */
function ridge(random, width, baseY, roughness, amplitude, points = 257) {
  const ys = new Array(points).fill(0)
  ys[0] = (random() - 0.5) * amplitude
  ys[points - 1] = (random() - 0.5) * amplitude
  let step = points - 1
  let amp = amplitude
  while (step > 1) {
    const half = step / 2
    for (let i = half; i < points; i += step) {
      ys[i] = (ys[i - half] + ys[i + half]) / 2 + (random() - 0.5) * amp
    }
    amp *= roughness
    step = half
  }
  return ys.map((y, i) => [(i / (points - 1)) * width, baseY + y])
}

function ridgePath(pts, width, height) {
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return `${d} L${width},${height} L0,${height} Z`
}

const grain = (id, opacity = 0.08) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>
  </filter>`

// ---------------------------------------------------------------------------

function mountains({ seed, sky, sun, layers, moon = false, stars = false }) {
  const W = 1600
  const H = 900
  const random = rng(seed)
  const starField = stars
    ? Array.from({ length: 140 }, () => {
        const x = random() * W
        const y = random() * H * 0.45
        const r = random() * 1.3 + 0.3
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(random() * 0.7 + 0.2).toFixed(2)}"/>`
      }).join('')
    : ''
  const shapes = layers
    .map((color, i) => {
      const t = i / (layers.length - 1)
      const baseY = lerp(430, 800, t)
      const pts = ridge(rng(seed * 13 + i), W, baseY, 0.55, lerp(260, 120, t))
      const fog = i < layers.length - 1
        ? `<rect x="0" y="${(baseY - 40).toFixed(0)}" width="${W}" height="200" fill="url(#fog)" opacity="${lerp(0.55, 0.2, t).toFixed(2)}"/>`
        : ''
      return `<path d="${ridgePath(pts, W, H)}" fill="${color}"/>${fog}`
    })
    .join('')
  const birds = moon
    ? ''
    : [
        [520, 260, 1],
        [560, 240, 0.8],
        [590, 275, 0.7],
      ]
        .map(([x, y, s]) => `<path d="M${x},${y} q${8 * s},${-7 * s} ${16 * s},0 q${8 * s},${-7 * s} ${16 * s},0" stroke="#3b2b3a" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.6"/>`)
        .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      ${sky.map((c, i) => `<stop offset="${(i / (sky.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${sun}" stop-opacity="0.9"/>
      <stop offset="0.25" stop-color="${sun}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${sun}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    ${grain('grain', 0.07)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${starField}
  <circle cx="1080" cy="${moon ? 220 : 400}" r="${moon ? 220 : 380}" fill="url(#glow)"/>
  <circle cx="1080" cy="${moon ? 220 : 400}" r="${moon ? 34 : 62}" fill="${sun}"/>
  ${birds}
  ${shapes}
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function synthwave() {
  const W = 1600
  const H = 900
  const random = rng(77)
  const horizon = 560
  const stars = Array.from({ length: 90 }, () => `<circle cx="${(random() * W).toFixed(0)}" cy="${(random() * 380).toFixed(0)}" r="${(random() * 1.4 + 0.3).toFixed(2)}" fill="#fff" opacity="${(random() * 0.6 + 0.2).toFixed(2)}"/>`).join('')
  const stripes = Array.from({ length: 7 }, (_, i) => {
    const y = 470 + i * 22
    const h = 3 + i * 2.2
    return `<rect x="0" y="${y}" width="${W}" height="${h}" fill="#000"/>`
  }).join('')
  const vertical = Array.from({ length: 41 }, (_, i) => {
    const x = (i - 20) * 120
    return `<line x1="${W / 2 + x * 0.05}" y1="${horizon}" x2="${W / 2 + x * 2.2}" y2="${H}" />`
  }).join('')
  const horizontal = Array.from({ length: 14 }, (_, i) => {
    const t = (i + 1) / 14
    const y = horizon + (H - horizon) * t * t
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`
  }).join('')
  const taper = (pts, offsetX) =>
    pts.map(([x, y], i) => {
      const t = i / (pts.length - 1)
      const envelope = Math.sin(Math.PI * t) ** 0.8
      return [x + offsetX, horizon - (horizon - Math.min(y, horizon)) * envelope]
    })
  const left = taper(ridge(rng(5), 720, horizon - 90, 0.5, 160, 65), -20)
  const right = taper(ridge(rng(9), 720, horizon - 100, 0.5, 170, 65), 900)
  const mtn = (pts) => `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${pts.at(-1)[0]},${horizon} L${pts[0][0]},${horizon} Z`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d0221"/><stop offset="0.5" stop-color="#3a0a5c"/><stop offset="0.62" stop-color="#9b1d6e"/><stop offset="0.66" stop-color="#ff5c8a"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe066"/><stop offset="0.55" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ff2e88"/>
    </linearGradient>
    <mask id="sunmask"><rect width="${W}" height="${H}" fill="#fff"/>${stripes}</mask>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0433"/><stop offset="1" stop-color="#05010d"/></linearGradient>
    <filter id="neon" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff4fa3" stop-opacity="0.55"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
    ${grain('grain', 0.06)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}
  <circle cx="${W / 2}" cy="420" r="420" fill="url(#halo)"/>
  <circle cx="${W / 2}" cy="420" r="230" fill="url(#sun)" mask="url(#sunmask)"/>
  <path d="${mtn(left)}" fill="#1c0638" stroke="#ff4fd8" stroke-width="2" stroke-opacity="0.6"/>
  <path d="${mtn(right)}" fill="#1c0638" stroke="#ff4fd8" stroke-width="2" stroke-opacity="0.6"/>
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#ground)"/>
  <g stroke="#ff3fd0" stroke-width="2" opacity="0.85" filter="url(#neon)">${vertical}${horizontal}</g>
  <rect x="0" y="${horizon - 2}" width="${W}" height="4" fill="#ff9ad5" filter="url(#neon)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function bauhaus() {
  const W = 1200
  const H = 1600
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${grain('grain', 0.12)}</defs>
  <rect width="${W}" height="${H}" fill="#efe6d6"/>
  <rect x="80" y="80" width="1040" height="1040" fill="#e9dcc6"/>
  <circle cx="420" cy="460" r="300" fill="#d9442b"/>
  <path d="M600,160 A300,300 0 0 1 600,760 Z" fill="#1f4c9e"/>
  <rect x="600" y="760" width="520" height="360" fill="#f2b632"/>
  <rect x="80" y="860" width="360" height="260" fill="#151515"/>
  <circle cx="900" cy="300" r="90" fill="none" stroke="#151515" stroke-width="28"/>
  <path d="M440,1120 L600,860 L760,1120 Z" fill="#efe6d6"/>
  <line x1="80" y1="1180" x2="1120" y2="1180" stroke="#151515" stroke-width="6"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#151515">
    <text x="80" y="1310" font-size="124" font-weight="800" letter-spacing="-4">FORM FOLLOWS</text>
    <text x="80" y="1430" font-size="124" font-weight="800" letter-spacing="-4" fill="#d9442b">FEELING</text>
    <text x="80" y="1515" font-size="28" font-weight="500" letter-spacing="6">EXHIBITION · STUDY NO. 07</text>
    <text x="1120" y="1515" font-size="28" font-weight="500" letter-spacing="6" text-anchor="end">MMXXVI</text>
  </g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function orbs() {
  const W = 900
  const H = 1600
  const blobs = [
    [220, 360, 360, '#ff6b6b'],
    [700, 620, 380, '#7c5cff'],
    [300, 1040, 420, '#14c8b0'],
    [720, 1320, 300, '#ffb347'],
    [520, 820, 220, '#ff4fa3'],
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="110"/></filter>
    ${grain('grain', 0.1)}
  </defs>
  <rect width="${W}" height="${H}" fill="#0b0a12"/>
  <g filter="url(#blur)" opacity="0.95">${blobs.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}</g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function aurora() {
  const W = 1600
  const H = 1200
  const random = rng(41)
  const horizon = 760
  const stars = Array.from({ length: 220 }, () => `<circle cx="${(random() * W).toFixed(0)}" cy="${(random() * horizon * 0.9).toFixed(0)}" r="${(random() * 1.3 + 0.2).toFixed(2)}" fill="#fff" opacity="${(random() * 0.7 + 0.15).toFixed(2)}"/>`).join('')
  // Aurora curtains are built from many thin vertical rays along a wavy base line.
  const curtain = (offset, amp, baseY, color, opacity, spread = 1) => {
    const rays = []
    for (let x = -20; x < W + 20; x += 5) {
      const t = x / W
      const y = baseY + Math.sin(t * 6 * spread + offset) * amp + Math.sin(t * 15 + offset * 2) * amp * 0.25
      const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, t * 1.1 - 0.05))) ** 0.6
      const len = (140 + random() * 220) * fade
      const o = (0.25 + random() * 0.55) * fade * opacity
      rays.push(`<rect x="${x}" y="${(y - len).toFixed(0)}" width="5" height="${len.toFixed(0)}" fill="url(#${color})" opacity="${o.toFixed(2)}"/>`)
    }
    return rays.join('')
  }
  const mtn = ridge(rng(8), W, horizon - 90, 0.52, 200)
  const mtnD = `${mtn.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${Math.min(y, horizon).toFixed(1)}`).join(' ')} L${W},${horizon} L0,${horizon} Z`
  const sky = `
    <rect width="${W}" height="${horizon}" fill="url(#night)"/>
    ${stars}
    <g filter="url(#soft)">
      ${curtain(3.4, 50, 300, 'violet', 0.7, 0.8)}
      ${curtain(1.2, 70, 430, 'teal', 0.8, 1.1)}
      ${curtain(0, 60, 520, 'green', 1, 0.9)}
    </g>
    <path d="${mtnD}" fill="#06121a"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020611"/><stop offset="0.7" stop-color="#07203a"/><stop offset="1" stop-color="#0d3b4f"/></linearGradient>
    <linearGradient id="green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cffb2" stop-opacity="0"/><stop offset="0.75" stop-color="#3dffa0" stop-opacity="0.9"/><stop offset="1" stop-color="#b6ffd8" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3de0ff" stop-opacity="0"/><stop offset="0.8" stop-color="#2bd6c8" stop-opacity="0.8"/><stop offset="1" stop-color="#2bd6c8" stop-opacity="0"/></linearGradient>
    <linearGradient id="violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b57bff" stop-opacity="0"/><stop offset="0.7" stop-color="#a66bff" stop-opacity="0.7"/><stop offset="1" stop-color="#a66bff" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7 4"/></filter>
    <filter id="ripple" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.002 0.06" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="18"/><feGaussianBlur stdDeviation="2.5"/></filter>
    <linearGradient id="lakefade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020611" stop-opacity="0.1"/><stop offset="1" stop-color="#020611" stop-opacity="0.85"/></linearGradient>
    ${grain('grain', 0.06)}
  </defs>
  ${sky}
  <g transform="translate(0 ${horizon * 2}) scale(1 -1)" filter="url(#ripple)" opacity="0.75">${sky}</g>
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#lakefade)"/>
  <g stroke="#9fd8e6" stroke-opacity="0.18" stroke-width="1.5">
    <line x1="140" y1="${horizon + 120}" x2="520" y2="${horizon + 132}"/>
    <line x1="760" y1="${horizon + 210}" x2="1320" y2="${horizon + 196}"/>
    <line x1="320" y1="${horizon + 330}" x2="980" y2="${horizon + 352}"/>
  </g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function summerBanner() {
  const W = 1200
  const H = 1200
  const waves = Array.from({ length: 6 }, (_, i) => {
    const y = 760 + i * 70
    const d = Array.from({ length: 13 }, (_, k) => `${k ? 'Q' : 'M'}${k ? `${k * 100 - 50},${y + (k % 2 ? -26 : 26)} ${k * 100},${y}` : `0,${y}`}`).join(' ')
    return `<path d="${d} L1200,1200 L0,1200 Z" fill="${['#ff8a5b', '#ff7048', '#f45d3c', '#e64c34', '#d63f2f', '#c4352a'][i]}"/>`
  }).join('')
  const sparkle = (x, y, s) => `<path d="M${x},${y - s} C${x + s * 0.15},${y - s * 0.15} ${x + s * 0.15},${y - s * 0.15} ${x + s},${y} C${x + s * 0.15},${y + s * 0.15} ${x + s * 0.15},${y + s * 0.15} ${x},${y + s} C${x - s * 0.15},${y + s * 0.15} ${x - s * 0.15},${y + s * 0.15} ${x - s},${y} C${x - s * 0.15},${y - s * 0.15} ${x - s * 0.15},${y - s * 0.15} ${x},${y - s} Z" fill="#fff7e8"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd8a8"/><stop offset="1" stop-color="#ffb487"/></linearGradient>
    ${grain('grain', 0.08)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="860" cy="520" r="250" fill="#ffef9f"/>
  <circle cx="860" cy="520" r="190" fill="#ffd25c"/>
  ${waves}
  ${sparkle(240, 600, 34)}${sparkle(1050, 230, 26)}${sparkle(560, 690, 18)}
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#3a1408">
    <text x="90" y="200" font-size="34" font-weight="600" letter-spacing="8">NEW SEASON</text>
    <text x="84" y="350" font-size="168" font-weight="800" letter-spacing="-6">SUMMER</text>
    <text x="84" y="510" font-size="168" font-weight="800" letter-spacing="-6">DROP</text>
  </g>
  <rect x="90" y="580" width="300" height="76" rx="38" fill="#3a1408"/>
  <text x="240" y="629" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#ffe7c7" text-anchor="middle" letter-spacing="2">SHOP NOW</text>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function dunes() {
  const W = 1280
  const H = 1600
  const layers = [
    { y: 820, amp: 120, light: '#f6c99a', dark: '#d9935f' },
    { y: 980, amp: 140, light: '#efb27d', dark: '#c97a45' },
    { y: 1160, amp: 160, light: '#e59d62', dark: '#b4652f' },
    { y: 1360, amp: 150, light: '#d98a4f', dark: '#9c5224' },
  ]
  const gradients = layers
    .map(
      ({ light, dark }, i) => `<linearGradient id="dune${i}" x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stop-color="${light}"/><stop offset="${(0.3 + i * 0.12).toFixed(2)}" stop-color="${light}"/>
        <stop offset="${(0.42 + i * 0.12).toFixed(2)}" stop-color="${dark}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`,
    )
    .join('')
  const shapes = layers
    .map(({ y, amp }, i) => {
      const crestX = 300 + i * 230
      const d = `M0,${y + amp * 0.6} C${crestX * 0.5},${y + amp * 0.3} ${crestX - 160},${y - amp} ${crestX},${y - amp} C${crestX + 220},${y - amp} ${W * 0.8},${y + amp * 0.2} ${W},${y} L${W},${H} L0,${H} Z`
      return `<path d="${d}" fill="url(#dune${i})"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc3d8"/><stop offset="0.6" stop-color="#f3e2c7"/><stop offset="1" stop-color="#f7d4a8"/></linearGradient>
    ${gradients}
    ${grain('grain', 0.09)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="930" cy="360" r="70" fill="#fff8e6"/>
  <circle cx="930" cy="360" r="160" fill="#fff8e6" opacity="0.25"/>
  ${shapes}
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

function neonCity() {
  const W = 900
  const H = 1600
  const random = rng(303)
  const buildings = []
  let x = -20
  while (x < W) {
    const w = 60 + random() * 110
    const h = 500 + random() * 700
    const shade = mix('#0b0f2a', '#1a1240', random())
    buildings.push({ x, w, h, shade })
    x += w + 6
  }
  const windows = buildings
    .map(({ x, w, h }) => {
      const cells = []
      for (let wy = H - h + 30; wy < H - 60; wy += 26) {
        for (let wx = x + 10; wx < x + w - 14; wx += 18) {
          if (random() < 0.32) {
            const c = random() < 0.5 ? '#ff4fd8' : random() < 0.5 ? '#3de0ff' : '#ffd27a'
            cells.push(`<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="8" height="12" fill="${c}" opacity="${(0.4 + random() * 0.6).toFixed(2)}"/>`)
          }
        }
      }
      return cells.join('')
    })
    .join('')
  const rain = Array.from({ length: 260 }, () => {
    const rx = random() * W
    const ry = random() * H
    const len = 18 + random() * 30
    return `<line x1="${rx.toFixed(0)}" y1="${ry.toFixed(0)}" x2="${(rx - 6).toFixed(0)}" y2="${(ry + len).toFixed(0)}"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030f"/><stop offset="0.55" stop-color="#2a0b46"/><stop offset="1" stop-color="#6a1660"/></linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="moonglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff7ad9" stop-opacity="0.35"/><stop offset="1" stop-color="#ff7ad9" stop-opacity="0"/></radialGradient>
    <linearGradient id="street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fd8" stop-opacity="0.35"/><stop offset="1" stop-color="#05030f" stop-opacity="1"/></linearGradient>
    ${grain('grain', 0.08)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="640" cy="380" r="260" fill="url(#moonglow)"/>
  <circle cx="640" cy="380" r="90" fill="#ffc6ec" opacity="0.55"/>
  ${buildings.map(({ x, w, h, shade }) => `<rect x="${x.toFixed(0)}" y="${H - h}" width="${w.toFixed(0)}" height="${h}" fill="${shade}"/>`).join('')}
  <g filter="url(#glow)">${windows}</g>
  <rect x="0" y="${H - 160}" width="${W}" height="160" fill="url(#street)"/>
  <g stroke="#c7d7ff" stroke-opacity="0.28" stroke-width="1.4">${rain}</g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}

const artworks = {
  'mountains-dawn': () =>
    mountains({
      seed: 11,
      sky: ['#2b3a6b', '#7d6b9e', '#e9a2a0', '#fbd2a6'],
      sun: '#fff1d6',
      layers: ['#d9a6ab', '#b98299', '#8b6188', '#5c4572', '#33284f', '#1a1633'],
    }),
  'mountains-dusk': () =>
    mountains({
      seed: 11,
      sky: ['#070a1f', '#1d1b4b', '#5a3a7a', '#c4708a'],
      sun: '#f4f1ff',
      moon: true,
      stars: true,
      layers: ['#6b4f87', '#523d73', '#3b2c5c', '#2a1f47', '#1a1433', '#0d0a1f'],
    }),
  synthwave,
  bauhaus,
  orbs,
  aurora,
  'summer-drop': summerBanner,
  dunes,
  'neon-city': neonCity,
}

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, render] of Object.entries(artworks)) {
  const svg = render()
  const width = Number(/width="(\d+)"/.exec(svg)[1])
  const height = Number(/height="(\d+)"/.exec(svg)[1])
  await page.setViewportSize({ width, height })
  await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`)
  const buffer = await page.screenshot({ type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width, height } })
  writeFileSync(join(outDir, `${name}.jpg`), buffer)
  console.log(`rendered ${name}.jpg (${width}×${height}, ${Math.round(buffer.length / 1024)} KB)`)
}
await browser.close()
