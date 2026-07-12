/** Écriture de .zip sans compression (mode « store ») — suffisant et sans dépendance. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface Entry {
  name: Uint8Array
  data: Uint8Array
  crc: number
  offset: number
}

export class ZipWriter {
  private parts: Uint8Array[] = []
  private entries: Entry[] = []
  private offset = 0

  private push(bytes: Uint8Array) {
    this.parts.push(bytes)
    this.offset += bytes.length
  }

  add(path: string, content: Uint8Array | string) {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
    const name = new TextEncoder().encode(path)
    const crc = crc32(data)
    const header = new DataView(new ArrayBuffer(30))
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true) // version
    header.setUint16(6, 0x0800, true) // UTF-8
    header.setUint16(8, 0, true) // store
    header.setUint16(10, 0, true)
    header.setUint16(12, 0x5021, true) // date fixe (déterministe)
    header.setUint32(14, crc, true)
    header.setUint32(18, data.length, true)
    header.setUint32(22, data.length, true)
    header.setUint16(26, name.length, true)
    header.setUint16(28, 0, true)
    this.entries.push({ name, data, crc, offset: this.offset })
    this.push(new Uint8Array(header.buffer))
    this.push(name)
    this.push(data)
  }

  finish(): Blob {
    const centralStart = this.offset
    for (const e of this.entries) {
      const h = new DataView(new ArrayBuffer(46))
      h.setUint32(0, 0x02014b50, true)
      h.setUint16(4, 20, true)
      h.setUint16(6, 20, true)
      h.setUint16(8, 0x0800, true)
      h.setUint16(10, 0, true)
      h.setUint16(14, 0x5021, true)
      h.setUint32(16, e.crc, true)
      h.setUint32(20, e.data.length, true)
      h.setUint32(24, e.data.length, true)
      h.setUint16(28, e.name.length, true)
      h.setUint32(42, e.offset, true)
      this.push(new Uint8Array(h.buffer))
      this.push(e.name)
    }
    const centralSize = this.offset - centralStart
    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true)
    end.setUint16(8, this.entries.length, true)
    end.setUint16(10, this.entries.length, true)
    end.setUint32(12, centralSize, true)
    end.setUint32(16, centralStart, true)
    this.push(new Uint8Array(end.buffer))
    return new Blob(this.parts as BlobPart[], { type: 'application/zip' })
  }
}
