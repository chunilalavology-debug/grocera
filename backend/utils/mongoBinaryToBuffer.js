/**
 * Mongoose `.lean()` (and some driver paths) return BSON `Binary`, not Node `Buffer`.
 * `Buffer.from(bsonBinary)` is wrong and often yields length 0 — breaks image responses.
 */
function mongoBinaryToBuffer(input) {
  if (input == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") return Buffer.from(input, "base64");

  if (input.buffer && Buffer.isBuffer(input.buffer)) {
    const buf = input.buffer;
    const pos = typeof input.position === "number" && input.position > 0 ? input.position : buf.length;
    return Buffer.from(buf.subarray(0, pos));
  }

  if (typeof input.value === "function") {
    try {
      const v = input.value(true);
      if (Buffer.isBuffer(v)) return v;
      if (v instanceof Uint8Array) return Buffer.from(v);
    } catch (_) {
      /* fall through */
    }
  }

  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.alloc(0);
}

module.exports = { mongoBinaryToBuffer };
