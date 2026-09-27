// Run with: node daly.test.mjs
// Frames captured from DL-1771060408B5 (4S LiFePO4) on 2026-09-27.
import assert from 'node:assert/strict';
import { FrameAssembler, decodeInfo, decodeStatus, readRequest, toHex } from './daly.js';

const fromHex = (s) => Uint8Array.from(s.trim().split(/\s+/), (h) => parseInt(h, 16));

const STATUS =
  'd2 03 7c 0c e3 0c e5 0c e4 0c e8 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 3b 00 00 00 00 00 00 00 00 00 00 00 84 00 03 00 84 75 30 03 5d 0c e8 0c e3 00 3b 00 3b 00 00 0a 17 00 04 00 01 00 3f 00 00 00 01 00 01 0c e4 00 05 00 00 00 00 00 00 00 00 00 00 3d 8d';
const INFO =
  'd2 03 40 41 32 30 30 31 2d 39 32 37 30 31 32 30 32 00 00 45 33 30 33 2d 30 33 30 54 53 2d 53 4d 42 00 00 32 30 32 30 30 33 30 36 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 60 77';

assert.equal(toHex(readRequest(0x00, 0x3e)), 'd2 03 00 00 00 3e d7 b9');
assert.equal(toHex(readRequest(0xa9, 0x20)), 'd2 03 00 a9 00 20 87 91');

// Reassembly across fragments, with leading junk.
const asm = new FrameAssembler();
const bytes = fromHex(STATUS);
assert.deepEqual(asm.push(fromHex('00 ff')), []);
assert.deepEqual(asm.push(bytes.subarray(0, 20)), []);
assert.deepEqual(asm.push(bytes.subarray(20, 100)), []);
const [res] = asm.push(bytes.subarray(100));
assert.ok(res.ok, res.error);

const s = decodeStatus(res.frame);
assert.deepEqual(s.cells, [3.299, 3.301, 3.3, 3.304]);
assert.deepEqual(s.temps, [19]);
assert.equal(s.voltage, 13.2);
assert.equal(s.current, 0);
assert.equal(s.soc, 86.1);
assert.equal(s.remainingAh, 258.3);
assert.equal(s.cycles, 63);
assert.equal(s.cellDelta, 0.005);
assert.equal(s.cellAvg, 3.3);
assert.ok(s.chargeMos && s.dischargeMos && !s.balancing);

const bad = fromHex(STATUS);
bad[10] ^= 1;
assert.equal(new FrameAssembler().push(bad)[0].ok, false);

const [info] = new FrameAssembler().push(fromHex(INFO));
assert.deepEqual(decodeInfo(info.frame), ['A2001-92701202', 'E303-030TS-SMB', '20200306']);

console.log('ok');
