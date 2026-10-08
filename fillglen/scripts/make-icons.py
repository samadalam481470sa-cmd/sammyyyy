#!/usr/bin/env python3
"""Write simple Fillglen PNG icons without extra Python deps."""
import struct, zlib, pathlib

PINE = (0x1B, 0x3A, 0x2F)
SAND = (0xE8, 0xC9, 0xA8)
CLAY = (0xD9, 0x76, 0x3A)
CREAM = (0xF6, 0xF1, 0xE8)

def png(size: int, pixels: list[tuple[int, int, int]]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b""
    for y in range(size):
        raw += b"\x00"
        for x in range(size):
            r, g, b = pixels[y * size + x]
            raw += bytes((r, g, b))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )

def draw(size: int) -> list[tuple[int, int, int]]:
    pix = [PINE] * (size * size)
    def setp(x, y, c):
        if 0 <= x < size and 0 <= y < size:
            pix[y * size + x] = c
    # glen curve
    for x in range(size):
        t = x / max(size - 1, 1)
        y = int(size * (0.35 + 0.45 * (2 * (t - 0.5)) ** 2))
        for dy in range(-max(1, size // 32), max(2, size // 24)):
            setp(x, y + dy, SAND)
    # ground
    gy = int(size * 0.72)
    for x in range(int(size * 0.18), int(size * 0.82)):
        for dy in range(max(1, size // 20)):
            setp(x, gy + dy, CLAY)
    # peak dot
    cx, cy, r = size // 2, int(size * 0.38), max(2, size // 16)
    for y in range(cy - r, cy + r):
        for x in range(cx - r, cx + r):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                setp(x, y, CREAM)
    return pix

out = pathlib.Path(__file__).resolve().parents[1] / "apps/extension/public"
out.mkdir(parents=True, exist_ok=True)
for s in (16, 32, 48, 128):
    (out / f"icon{s}.png").write_bytes(png(s, draw(s)))
    print("wrote", out / f"icon{s}.png")
