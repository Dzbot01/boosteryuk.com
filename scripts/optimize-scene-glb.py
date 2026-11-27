#!/usr/bin/env python3
"""Perkecil tekstur di dalam sebuah GLB (binary glTF) supaya lolos batas aset Cloudflare.

Kenapa perlu:
  Cloudflare Workers/Pages membatasi **25 MiB per file statis**. Aset
  `public/models/scene.glb` hasil ekspor Mixamo berukuran 40,5 MB (dua tekstur
  PNG 4096x4096 = 35,4 MB), sehingga `dist/models/scene.glb` membuat deploy
  Cloudflare GAGAL dan situs produksi tertahan di build lama.

Yang dilakukan (hanya menyentuh gambar, bukan geometri/animasi):
  1. setiap image di dalam GLB di-resize ke maksimal --max-dim (default 2048);
  2. disimpan ulang sebagai JPEG (kualitas --quality, normal map --normal-quality)
     karena alpha-nya penuh 255 -> tidak ada transparansi yang hilang;
  3. buffer BIN disusun ulang (offset tiap bufferView dirapikan ke kelipatan 4 byte),
     JSON diperbarui (mimeType, byteOffset, byteLength, buffers[0].byteLength);
  4. GLB ditulis ulang: magic 'glTF', versi 2, chunk JSON + BIN.

Node/material/aksesor/animasi TIDAK diubah, jadi model tetap bergerak sendiri dan
tetap self-contained (tanpa .bin/.png eksternal, tanpa extension wajib).

Pemakaian:
    pip install pillow
    python3 scripts/optimize-scene-glb.py public/models/scene.glb \
        -o public/models/scene.glb --max-dim 2048 --quality 88 --normal-quality 92

File asli tetap ada di riwayat git (commit f7cd287 / 32749be) bila perlu dikembalikan.
"""
from __future__ import annotations

import argparse
import io
import json
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Butuh Pillow: pip install pillow")

MIB = 1024 * 1024
CF_ASSET_LIMIT = 25 * MIB  # batas Cloudflare Workers/Pages per file statis


def read_glb(data: bytes):
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        sys.exit("Bukan GLB (magic bytes salah).")
    if version != 2:
        sys.exit(f"GLB versi {version} tidak didukung (butuh 2).")
    if length != len(data):
        sys.exit("Panjang di header GLB != ukuran file.")
    off, chunks = 12, []
    while off < length:
        clen, ctype = struct.unpack("<I4s", data[off : off + 8])
        chunks.append((ctype, off + 8, clen))
        off += 8 + clen
    types = [c[0] for c in chunks]
    if types[:2] != [b"JSON", b"BIN\x00"]:
        sys.exit(f"Susunan chunk GLB tidak lazim: {types}")
    gltf = json.loads(data[chunks[0][1] : chunks[0][1] + chunks[0][2]])
    bin_start, bin_len = chunks[1][1], chunks[1][2]
    return gltf, data[bin_start : bin_start + bin_len]


def recompress(raw: bytes, mime: str, max_dim: int, quality: int, label: str, subsampling: int = 1) -> tuple[bytes, str]:
    """Resize + encode ulang satu tekstur. Mengembalikan (bytes, mimeType)."""
    img = Image.open(io.BytesIO(raw))
    img.load()
    w, h = img.size
    scale = min(1.0, max_dim / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

    if "A" in img.getbands():
        lo, hi = img.getchannel("A").getextrema()
        if (lo, hi) != (255, 255):
            sys.exit(
                f"{label}: tekstur punya alpha nyata (extrema {lo}..{hi}); JPEG akan membuang "
                "transparansi. Jalankan ulang dengan format lossless atau pakai EXT_texture_webp."
            )
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    out = io.BytesIO()
    img.save(out, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=subsampling)
    print(
        f"  - {label}: {w}x{h} {mime} {len(raw)/MIB:.2f} MiB  ->  "
        f"{img.size[0]}x{img.size[1]} image/jpeg q{quality} {out.tell()/MIB:.2f} MiB"
    )
    return out.getvalue(), "image/jpeg"


def rebuild(gltf: dict, bin_data: bytes, images: dict[int, tuple[bytes, str]]) -> bytes:
    """Susun ulang GLB: bufferView gambar diganti, offset lain dirapikan 4-byte."""
    views = gltf["bufferViews"]
    new_bin = bytearray()
    for i, view in enumerate(views):
        start = int(view.get("byteOffset", 0))
        length = int(view["byteLength"])
        if i in images:
            payload, mime = images[i]
            view["byteLength"] = len(payload)
            gltf["images"][next(k for k, im in enumerate(gltf["images"]) if im.get("bufferView") == i)][
                "mimeType"
            ] = mime
        else:
            payload = bin_data[start : start + length]
            if len(payload) != length:
                sys.exit(f"bufferView #{i} melewati ujung chunk BIN.")
        while len(new_bin) % 4:
            new_bin.append(0)
        view["byteOffset"] = len(new_bin)
        new_bin += payload

    gltf.setdefault("buffers", [{}])
    gltf["buffers"][0]["byteLength"] = len(new_bin)
    if gltf["buffers"][0].get("uri"):
        sys.exit("GLB punya buffer eksternal (uri) — tidak didukung skrip ini.")

    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(js) % 4:
        js += b" "
    while len(new_bin) % 4:
        new_bin += b"\x00"
    total = 12 + 8 + len(js) + 8 + len(new_bin)
    return b"".join(
        [struct.pack("<4sII", b"glTF", 2, total), struct.pack("<I4s", len(js), b"JSON"), js,
         struct.pack("<I4s", len(new_bin), b"BIN\x00"), bytes(new_bin)]
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="GLB sumber")
    ap.add_argument("-o", "--output", help="GLB hasil (default: timpa file sumber)")
    ap.add_argument("--max-dim", type=int, default=2048, help="sisi terpanjang tekstur (default 2048)")
    ap.add_argument("--quality", type=int, default=88, help="kualitas JPEG base color (default 88)")
    ap.add_argument("--normal-quality", type=int, default=92, help="kualitas JPEG normal map (default 92)")
    args = ap.parse_args()

    src = Path(args.input)
    dst = Path(args.output) if args.output else src
    data = src.read_bytes()
    gltf, bin_data = read_glb(data)

    images = gltf.get("images") or []
    views = gltf["bufferViews"]
    if not images:
        sys.exit("GLB tidak punya image — tidak ada yang perlu diperkecil.")

    # Material mana yang memakai normalTexture → kualitasnya dijaga lebih tinggi.
    normal_sources = set()
    for mat in gltf.get("materials") or []:
        nt = mat.get("normalTexture")
        if nt is not None:
            tex = (gltf.get("textures") or [])[nt["index"]]
            normal_sources.add(tex["source"])

    print(f"{src}: {len(data)/MIB:.2f} MiB, {len(images)} tekstur, "
          f"{sum(len(a.get('channels', [])) for a in gltf.get('animations') or [])} channel animasi")
    replaced: dict[int, tuple[bytes, str]] = {}
    for idx, image in enumerate(images):
        bv = int(image["bufferView"])
        view = views[bv]
        start, length = int(view.get("byteOffset", 0)), int(view["byteLength"])
        raw = bin_data[start : start + length]
        label = f"image[{idx}] {image.get('name') or ''}".strip() + (
            " (normal map)" if idx in normal_sources else ""
        )
        quality = args.normal_quality if idx in normal_sources else args.quality
        # Normal map disimpan 4:4:4 (tanpa subsampling chroma) agar relief tidak bergerigi.
        replaced[bv] = recompress(raw, image.get("mimeType", "?"), args.max_dim, quality, label,
                                    subsampling=0 if idx in normal_sources else 1)

    out = rebuild(gltf, bin_data, replaced)
    dst.write_bytes(out)
    before, after = len(data), len(out)
    print(f"hasil: {dst} {after/MIB:.2f} MiB (dari {before/MIB:.2f} MiB, hemat {(1-after/before)*100:.1f}%)")
    if after >= CF_ASSET_LIMIT:
        sys.exit(
            f"MASIH {after/MIB:.2f} MiB >= batas Cloudflare 25 MiB — turunkan --max-dim "
            "(mis. 1536 atau 1024) atau --quality."
        )
    print(f"OK: di bawah batas aset statis Cloudflare 25 MiB ({CF_ASSET_LIMIT/MIB:.0f} MiB).")


if __name__ == "__main__":
    main()
