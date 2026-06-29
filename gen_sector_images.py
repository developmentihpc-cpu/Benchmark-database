#!/usr/bin/env python3
"""Generate sector-card images via the Gemini API — a BUILD-TIME tool.

The dashboard is a fully static site, so images must be generated ahead of time
and vendored as files; an API key must NEVER be embedded in the shipped JS. This
script reads the key from the GEMINI_API_KEY environment variable, generates a
photo per sector, optimises it, and writes assets/sectors/<key>.jpg — exactly the
form the five existing sector photos take. Then wire the new cards into
SECTOR_CARDS in js/app.js.

    export GEMINI_API_KEY=...            # Windows: set GEMINI_API_KEY=...
    python gen_sector_images.py          # generate the missing-theme images
    python gen_sector_images.py --all    # also regenerate the existing five

Model: defaults to Imagen 4 (imagen-4.0-generate-001). Imagen is deprecated and
shuts down 2026-08-17 — set GEMINI_IMAGE_MODEL=gemini-2.5-flash-image ("Nano
Banana") to use the going-forward model instead.

Never commit the key. If a key was ever pasted into a chat or a file, rotate it.
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

KEY = os.environ.get("GEMINI_API_KEY")
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "imagen-4.0-generate-001")
OUT = Path(__file__).resolve().parent / "assets" / "sectors"

# Shared style so generated images match the existing five (clean documentary photos).
STYLE = ("A high-quality professional documentary photograph representing {desc} in a "
         "developing country. Realistic, respectful and dignified; candid real people; "
         "warm natural light; clean modern composition; 16:9 framing. No text, no logos, "
         "no watermarks, no captions.")

# Themes WITHOUT a photo yet (keys must match guideTheme() / SECTOR_CARDS themes).
MISSING = {
    "wash":         "water, sanitation and hygiene — a community water point with people collecting clean water",
    "humanitarian": "humanitarian response — aid workers and a relief distribution to an affected community",
    "social":       "social protection and social services — a community support or cash-transfer setting with people",
    "environment":  "environment and climate — community reforestation, mangrove planting or conservation",
    "economic":     "private sector and economic development — a small business, market trader or entrepreneur",
}
# The five that already have photos (only regenerated with --all).
EXISTING = {
    "education":      "education — a bright classroom with engaged pupils and a teacher",
    "agriculture":    "agriculture and rural development — a smallholder farmer with crops and modern irrigation",
    "health":         "health and nutrition — a clean modern clinic with health workers and patients",
    "infrastructure": "infrastructure and energy — solar panels or a public infrastructure project",
    "governance":     "governance and civil society — a civic assembly or public institution",
}


def _post(url, body):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def gen_imagen(prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:predict"
    body = {"instances": [{"prompt": prompt}],
            "parameters": {"sampleCount": 1, "aspectRatio": "16:9"}}
    data = _post(url, body)
    return base64.b64decode(data["predictions"][0]["bytesBase64Encoded"])


def gen_nano(prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    data = _post(url, {"contents": [{"parts": [{"text": prompt}]}]})
    for part in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            return base64.b64decode(part["inlineData"]["data"])
    raise RuntimeError("response contained no image part")


def optimise(raw, dest):
    """Resize to 720px wide JPEG (q82) if Pillow is available; else save raw PNG."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        w = 720
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(dest, "JPEG", quality=82)
        return dest
    except Exception:
        png = dest.with_suffix(".png")
        png.write_bytes(raw)
        return png


def main():
    if not KEY:
        sys.exit("Set GEMINI_API_KEY (an environment variable — never hard-code it).")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all", action="store_true", help="also regenerate the five existing photos")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    gen = gen_nano if MODEL.startswith("gemini-") else gen_imagen
    todo = dict(MISSING)
    if args.all:
        todo.update(EXISTING)
    print(f"Generating {len(todo)} image(s) with {MODEL} -> {OUT}")
    for key, desc in todo.items():
        try:
            raw = gen(STYLE.format(desc=desc))
        except Exception as e:
            print(f"  {key:14s} FAILED — {e}")
            continue
        out = optimise(raw, OUT / f"{key}.jpg")
        kb = out.stat().st_size // 1024
        note = "" if out.suffix == ".jpg" else "  (install Pillow to auto-optimise)"
        print(f"  {key:14s} {kb} KB -> {out.name}{note}")
    print("Done. Review the images, then add the matching SECTOR_CARDS entries in js/app.js.")


if __name__ == "__main__":
    main()
