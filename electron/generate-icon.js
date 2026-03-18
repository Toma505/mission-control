const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buffers) {
  const parts = Array.isArray(buffers) ? buffers : [buffers]
  let crc = 0xffffffff

  for (const buffer of parts) {
    for (let i = 0; i < buffer.length; i++) {
      crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const lengthBuffer = Buffer.alloc(4)
  const crcBuffer = Buffer.alloc(4)

  lengthBuffer.writeUInt32BE(data.length, 0)
  crcBuffer.writeUInt32BE(crc32([typeBuffer, data]), 0)

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

function renderPixels(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const scale = size / 64

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x - cx + 0.5
      const dy = y - cy + 0.5
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      let r = 0
      let g = 0
      let b = 0
      let a = 0

      const outerR = 30 * scale
      if (dist <= outerR) {
        const edgeFade = Math.min(1, (outerR - dist) / (1.5 * scale))

        r = 8
        g = 12
        b = 18
        a = Math.round(edgeFade * 255)

        const coreR = 5 * scale
        if (dist <= coreR) {
          const intensity = 1 - (dist / coreR) * 0.3
          r = Math.round(180 * intensity)
          g = Math.round(220 * intensity)
          b = Math.round(255 * intensity)
          a = 255
        }

        const coreGlowR = 9 * scale
        if (dist > coreR && dist <= coreGlowR) {
          const glowFade = 1 - (dist - coreR) / (coreGlowR - coreR)
          const glow = glowFade * glowFade * 0.6
          r = Math.round(8 + 100 * glow)
          g = Math.round(12 + 160 * glow)
          b = Math.round(18 + 220 * glow)
          a = Math.round(edgeFade * 255)
        }

        const innerRingR = 11 * scale
        const innerRingW = 1.2 * scale
        if (Math.abs(dist - innerRingR) < innerRingW) {
          const ringIntensity = 1 - Math.abs(dist - innerRingR) / innerRingW
          r = Math.round(60 + 140 * ringIntensity)
          g = Math.round(140 + 100 * ringIntensity)
          b = Math.round(200 + 55 * ringIntensity)
          a = Math.round(edgeFade * 255)
        }

        const midRingR = 17 * scale
        const midRingW = 2 * scale
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

        if (dist > 14.5 * scale && dist < 19.5 * scale) {
          const tickAngle = ((angle + Math.PI) / (2 * Math.PI)) * 24
          const tickFrac = tickAngle % 1
          if (tickFrac > 0.45 && tickFrac < 0.55) {
            r = Math.round(r + (120 - r) * 0.3)
            g = Math.round(g + (180 - g) * 0.3)
            b = Math.round(b + (240 - b) * 0.3)
          }
        }

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

        if (Math.abs(dist - 27 * scale) < 2 * scale) {
          const glowIntensity = (1 - Math.abs(dist - 27 * scale) / (2 * scale)) * 0.15
          r = Math.round(Math.min(255, r + 60 * glowIntensity))
          g = Math.round(Math.min(255, g + 120 * glowIntensity))
          b = Math.round(Math.min(255, b + 200 * glowIntensity))
        }

        if (dist > 8 * scale && dist < 14 * scale) {
          if (Math.abs(dy) < 0.7 * scale || Math.abs(dx) < 0.7 * scale) {
            r = Math.round(r + (150 - r) * 0.15)
            g = Math.round(g + (200 - g) * 0.15)
            b = Math.round(b + (255 - b) * 0.15)
          }
        }

        if (dist > 19 * scale && dist < 23 * scale) {
          if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8 * scale) {
            r = Math.round(r + (100 - r) * 0.12)
            g = Math.round(g + (180 - g) * 0.12)
            b = Math.round(b + (240 - b) * 0.12)
          }
        }
      }

      pixels[idx] = r
      pixels[idx + 1] = g
      pixels[idx + 2] = b
      pixels[idx + 3] = a
    }
  }

  return pixels
}

function encodePng(size) {
  const pixels = renderPixels(size)
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)

  for (let y = 0; y < size; y++) {
    const rawOffset = y * (stride + 1)
    const pixelOffset = y * stride
    raw[rawOffset] = 0
    pixels.copy(raw, rawOffset + 1, pixelOffset, pixelOffset + stride)
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const compressed = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ])
}

function writePng(filePath, size) {
  fs.writeFileSync(filePath, encodePng(size))
}

function writeIco(filePath, size) {
  const rgba = renderPixels(size)
  const bpp = 32
  const pixelDataSize = size * size * 4
  const rowSize = Math.ceil(size / 32) * 4
  const maskSize = rowSize * size
  const bmpHeaderSize = 40
  const dataSize = bmpHeaderSize + pixelDataSize + maskSize

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const dir = Buffer.alloc(16)
  dir.writeUInt8(size === 256 ? 0 : size, 0)
  dir.writeUInt8(size === 256 ? 0 : size, 1)
  dir.writeUInt8(0, 2)
  dir.writeUInt8(0, 3)
  dir.writeUInt16LE(1, 4)
  dir.writeUInt16LE(bpp, 6)
  dir.writeUInt32LE(dataSize, 8)
  dir.writeUInt32LE(22, 12)

  const bmpHeader = Buffer.alloc(bmpHeaderSize)
  bmpHeader.writeUInt32LE(bmpHeaderSize, 0)
  bmpHeader.writeInt32LE(size, 4)
  bmpHeader.writeInt32LE(size * 2, 8)
  bmpHeader.writeUInt16LE(1, 12)
  bmpHeader.writeUInt16LE(bpp, 14)
  bmpHeader.writeUInt32LE(0, 16)
  bmpHeader.writeUInt32LE(pixelDataSize + maskSize, 20)

  const bgra = Buffer.alloc(pixelDataSize)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const source = (y * size + x) * 4
      const target = ((size - 1 - y) * size + x) * 4
      bgra[target] = rgba[source + 2]
      bgra[target + 1] = rgba[source + 1]
      bgra[target + 2] = rgba[source]
      bgra[target + 3] = rgba[source + 3]
    }
  }

  const mask = Buffer.alloc(maskSize, 0)
  fs.writeFileSync(filePath, Buffer.concat([header, dir, bmpHeader, bgra, mask]))
}

function writeIcns(filePath) {
  const variants = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 64],
    ['ic12', 128],
    ['ic13', 256],
    ['ic14', 512],
  ]

  const chunks = variants.map(([type, size]) => {
    const png = encodePng(size)
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'ascii')
    header.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([header, png])
  })

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(totalLength, 4)

  fs.writeFileSync(filePath, Buffer.concat([header, ...chunks]))
}

function main() {
  const outputDir = __dirname
  const icoPath = path.join(outputDir, 'icon.ico')
  const pngPath = path.join(outputDir, 'icon.png')
  const icnsPath = path.join(outputDir, 'icon.icns')

  writeIco(icoPath, 256)
  writePng(pngPath, 1024)
  writeIcns(icnsPath)

  console.log(`Windows icon created: ${icoPath} (256x256)`)
  console.log(`Linux icon created: ${pngPath} (1024x1024)`)
  console.log(`macOS icon created: ${icnsPath}`)
}

main()
