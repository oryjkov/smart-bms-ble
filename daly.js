// Daly Smart BMS, "D2" Modbus-over-BLE protocol (H/K/M/S series, DL-xxxxxxxxxxxx).
// Request:  D2 03 <reg hi> <reg lo> <count hi> <count lo> <crc lo> <crc hi>
// Response: D2 03 <byte count> <data...> <crc lo> <crc hi>

export const SERVICE = 0xfff0;
export const NOTIFY_CHAR = 0xfff1;
export const WRITE_CHAR = 0xfff2;

const ADDR = 0xd2;
const FN_READ = 0x03;
const MAX_CELLS = 32;
const MAX_TEMPS = 8;

export const STATUS_REQ = { reg: 0x00, count: 0x3e };
export const INFO_REQ = { reg: 0xa9, count: 0x20 };

export function crc16modbus(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

export function readRequest(reg, count) {
  const f = new Uint8Array([ADDR, FN_READ, reg >> 8, reg & 0xff, count >> 8, count & 0xff, 0, 0]);
  const crc = crc16modbus(f.subarray(0, 6));
  f[6] = crc & 0xff;
  f[7] = crc >> 8;
  return f;
}

// Accumulates notification chunks and emits complete, CRC-checked frames.
export class FrameAssembler {
  constructor() {
    this.buf = new Uint8Array(0);
  }

  // Returns an array of { frame, ok, error } for every complete frame found.
  push(chunk) {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const out = [];
    for (;;) {
      const start = this.buf.findIndex((b, i) => b === ADDR && this.buf[i + 1] === FN_READ);
      if (start < 0) {
        this.buf = this.buf.length && this.buf.at(-1) === ADDR ? this.buf.slice(-1) : new Uint8Array(0);
        break;
      }
      if (start > 0) this.buf = this.buf.slice(start);
      if (this.buf.length < 3) break;
      const total = 3 + this.buf[2] + 2;
      if (this.buf.length < total) break;
      const frame = this.buf.slice(0, total);
      this.buf = this.buf.slice(total);
      const crc = crc16modbus(frame.subarray(0, total - 2));
      const got = frame[total - 2] | (frame[total - 1] << 8);
      out.push(crc === got ? { frame, ok: true } : { frame, ok: false, error: `CRC mismatch (calc ${hex16(crc)}, got ${hex16(got)})` });
    }
    return out;
  }

  reset() {
    this.buf = new Uint8Array(0);
  }
}

// Register values (uint16, big-endian) from a response frame.
export function registers(frame) {
  const n = frame[2] >> 1;
  const regs = new Array(n);
  for (let i = 0; i < n; i++) regs[i] = (frame[3 + 2 * i] << 8) | frame[4 + 2 * i];
  return regs;
}

// Decodes the block read with STATUS_REQ (registers 0x00..0x3D).
export function decodeStatus(frame) {
  const r = registers(frame);
  if (r.length < 0x39) throw new Error(`status frame too short: ${r.length} registers`);
  const cellCount = Math.min(r[0x31], MAX_CELLS);
  const tempCount = Math.min(r[0x32], MAX_TEMPS);
  const voltage = r[0x28] / 10;
  const current = (r[0x29] - 30000) / 10;
  return {
    cells: r.slice(0, cellCount).map((mv) => mv / 1000),
    temps: r.slice(0x20, 0x20 + tempCount).map((t) => t - 40),
    voltage,
    current,
    power: voltage * current,
    soc: r[0x2a] / 10,
    cellMax: r[0x2b] / 1000,
    cellMin: r[0x2c] / 1000,
    tempMax: r[0x2d] - 40,
    tempMin: r[0x2e] - 40,
    remainingAh: r[0x30] / 10,
    cycles: r[0x33],
    balancing: r[0x34] !== 0,
    chargeMos: r[0x35] !== 0,
    dischargeMos: r[0x36] !== 0,
    cellAvg: r[0x37] / 1000,
    cellDelta: r[0x38] / 1000,
    // Registers 0x3A..0x3D appear to hold fault flags; exposed raw until mapped.
    faultRaw: r.slice(0x3a, 0x3e),
  };
}

// Decodes the block read with INFO_REQ: NUL/space-padded ASCII strings.
export function decodeInfo(frame) {
  const data = frame.subarray(3, 3 + frame[2]);
  return new TextDecoder('ascii')
    .decode(data)
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
const hex16 = (v) => '0x' + v.toString(16).padStart(4, '0');
