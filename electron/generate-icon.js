// Generates a JARVIS / Arc Reactor inspired icon
// Run: node electron/generate-icon.js

const fs = require('fs')
const path = require('path')

function createIcon() {
  const size = 256
  const scale = size / 64
  const bpp = 32
  const pixelDataSize = size * size * 4
  const rowSize = Math.ceil((size * 1) / 32) * 4
  const maskSize = rowSize * size
  const bmpHeaderSize = 40
  const dataSize = bmpHeaderSize + pixelDataSize + maskSize

  // ICO Header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  // Directory Entry
  const dir = Buffer.alloc(16)
  dir.writeUInt8(size === 256 ? 0 : size, 0)
  dir.writeUInt8(size === 256 ? 0 : size, 1)
  dir.writeUInt8(0, 2)
  dir.writeUInt8(0, 3)
  dir.writeUInt16LE(1, 4)
  dir.writeUInt16LE(bpp, 6)
  dir.writeUInt32LE(dataSize, 8)
  dir.writeUInt32LE(22, 12)

  // BMP Info Header
  const bmpHeader = Buffer.alloc(bmpHeaderSize)
  bmpHeader.writeUInt32LE(bmpHeaderSize, 0)
  bmpHeader.writeInt32LE(size, 4)
  bmpHeader.writeInt32LE(size * 2, 8)
  bmpHeader.writeUInt16LE(1, 12)
  bmpHeader.writeUInt16LE(bpp, 14)
  bmpHeader.writeUInt32LE(0, 16)
  bmpHeader.writeUInt32LE(pixelDataSize + maskSize, 20)

  const pixels = Buffer.alloc(pixelDataSize)
  const cx = size / 2
  const cy = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = ((size - 1 - y) * size + x) * 4
      const dx = x - cx + 0.5
      const dy = y - cy + 0.5
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      let r = 0, g = 0, b = 0, a = 0

      const outerR = 30 * scale
      if (dist <= outerR) {
        const edgeFade = Math.min(1, (outerR - dist) / (1.5 * scale))

        // Dark background
        r = 8; g = 12; b = 18; a = Math.round(edgeFade * 255)

        // === Arc Reactor Core ===
        const coreR = 5 * scale
        if (dist <= coreR) {
          const intensity = 1 - (dist / coreR) * 0.3
          r = Math.round(180 * intensity)
          g = Math.round(220 * intensity)
          b = Math.round(255 * intensity)
          a = 255
        }

        // Core glow
        const coreGlowR = 9 * scale
        if (dist > coreR && dist <= coreGlowR) {
          const glowFade = 1 - (dist - coreR) / (coreGlowR - coreR)
          const glow = glowFade * glowFade * 0.6
          r = Math.round(8 + 100 * glow)
          g = Math.round(12 + 160 * glow)
          b = Math.round(18 + 220 * glow)
          a = Math.round(edgeFade * 255)
        }

        // === Inner Ring ===
        const innerRingR = 11 * scale
        const innerRingW = 1.2 * scale
        if (Math.abs(dist - innerRingR) < innerRingW) {
          const ringIntensity = 1 - Math.abs(dist - innerRingR) / innerRingW
          r = Math.round(60 + 140 * ringIntensity)
          g = Math.round(140 + 100 * ringIntensity)
          b = Math.round(200 + 55 * ringIntensity)
          a = Math.round(edgeFade * 255)
        }

        // === Segmented Middle Ring (HUD style) ===
        const midRingR = 17 * scale
        const midRingW = 2.0 * scale
        if (Math.abs(dist - midRingR) < midRingW) {
          const segAngle = ((angle + Math.PI) / (2 * Math.PI)) * 6
          const segFrac = segAngle % 1
          const inSegment = segFrac > 0.12 && segFrac < 0.88

          if (inSegment) {
            const ringIntensity = 1 - Math.abs(dist - midRingR) / midRingW
            const segIntensity = Math.min(1, (segFrac - 0.12) / 0.15, (0.88 - segFrac) / 0.15)
            const combined = ringIntensity * segIntensity
            r = Math.round(30 + 120 * combined)
            g = Math.round(100 + 120 * combined)
            b = Math.round(180 + 75 * combined)
            a = Math.round(edgeFade * 255)
          }
        }

        // === Tick marks ===
        if (dist > 14.5 * scale && dist < 19.5 * scale) {
          const tickAngle = ((angle + Math.PI) / (2 * Math.PI)) * 24
          const tickFrac = tickAngle % 1
          if (tickFrac > 0.45 && tickFrac < 0.55) {
            r = Math.round(r + (120 - r) * 0.3)
            g = Math.round(g + (180 - g) * 0.3)
            b = Math.round(b + (240 - b) * 0.3)
          }
        }

        // === Outer Ring (4 segments) ===
        const outerRingR = 24 * scale
        const outerRingW = 1.8 * scale
        if (Math.abs(dist - outerRingR) < outerRingW) {
          const ringIntensity = 1 - Math.abs(dist - outerRingR) / outerRingW
          const segAngle = ((angle + Math.PI) / (2 * Math.PI)) * 4
          const segFrac = segAngle % 1
          const inSegment = segFrac > 0.08 && segFrac < 0.92

          if (inSegment) {
            const segIntensity = Math.min(1, (segFrac - 0.08) / 0.1, (0.92 - segFrac) / 0.1)
            const combined = ringIntensity * segIntensity
            r = Math.round(20 + 80 * combined)
            g = Math.round(80 + 100 * combined)
            b = Math.round(160 + 80 * combined)
            a = Math.round(edgeFade * 255)
          }
        }

        // === Outer glow ===
        if (Math.abs(dist - 27 * scale) < 2 * scale) {
          const glowIntensity = (1 - Math.abs(dist - 27 * scale) / (2 * scale)) * 0.15
          r = Math.round(Math.min(255, r + 60 * glowIntensity))
          g = Math.round(Math.min(255, g + 120 * glowIntensity))
          b = Math.round(Math.min(255, b + 200 * glowIntensity))
        }

        // === Crosshair lines ===
        if (dist > 8 * scale && dist < 14 * scale) {
          if (Math.abs(dy) < 0.7 * scale || Math.abs(dx) < 0.7 * scale) {
            r = Math.round(r + (150 - r) * 0.15)
            g = Math.round(g + (200 - g) * 0.15)
            b = Math.round(b + (255 - b) * 0.15)
          }
        }

        // === Diagonal accents ===
        if (dist > 19 * scale && dist < 23 * scale) {
          if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8 * scale) {
            r = Math.round(r + (100 - r) * 0.12)
            g = Math.round(g + (180 - g) * 0.12)
            b = Math.round(b + (240 - b) * 0.12)
          }
        }
      }

      pixels[idx] = b
      pixels[idx + 1] = g
      pixels[idx + 2] = r
      pixels[idx + 3] = a
    }
  }

  const mask = Buffer.alloc(maskSize, 0)
  const ico = Buffer.concat([header, dir, bmpHeader, pixels, mask])
  const outPath = path.join(__dirname, 'icon.ico')
  fs.writeFileSync(outPath, ico)
  console.log(`JARVIS icon created: ${outPath} (${size}x${size})`)
}

createIcon()
