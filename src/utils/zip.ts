/** Normalizes binary input to a Uint8Array. */
export function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/** True if the bytes start with the ZIP local-file-header magic ("PK\x03\x04"). */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}
