#!/usr/bin/env python3
"""
Migra les fotos dels encàrrecs de Cloudinary al servidor local.

Ús:
    python3 migrar_fotos.py                  # execució real
    python3 migrar_fotos.py --dry-run        # simula sense fer canvis

Requisits:
    pip3 install firebase-admin requests

Col·loca serviceAccountKey.json al mateix directori.
"""
import argparse
import re
import sys
import uuid
from pathlib import Path

import requests
import firebase_admin
from firebase_admin import credentials, firestore

# ── Configuració ──────────────────────────────────────────────────────────────

FOTOS_BASE  = Path("/mnt/ssd/fotos")
BASE_URL    = "https://nouaire.ruizbravo.org"
CLOUDINARY  = "https://res.cloudinary.com"
SERVICE_KEY = Path(__file__).parent / "serviceAccountKey.json"
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def sanitize_client(v: str) -> str:
    return re.sub(r"[^\w\s\-]", "_", (v or "sense_client").strip())[:80] or "sense_client"

def sanitize_fecha(v: str) -> str:
    return re.sub(r"[^\d\-]", "_", (v or "sense_data").strip())[:10] or "sense_data"

def ext_from_url(url: str) -> str:
    path = url.split("?")[0].split("/")[-1]
    suffix = Path(path).suffix.lower()
    return suffix if suffix in IMAGE_EXTS else ".jpg"

def descarregar(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Simula sense descarregar ni actualitzar Firestore")
    args = parser.parse_args()
    dry = args.dry_run

    if not SERVICE_KEY.exists():
        print(f"[ERROR] No es troba {SERVICE_KEY}", file=sys.stderr)
        sys.exit(1)

    # Inicialitzar Firebase Admin
    cred = credentials.Certificate(str(SERVICE_KEY))
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print(f"{'[DRY-RUN] ' if dry else ''}Connectat a Firestore.")
    print(f"Directori destí: {FOTOS_BASE}\n")

    encargos = db.collection("encargos").stream()

    total_encargos = 0
    total_fotos    = 0
    total_migrades = 0
    total_errors   = 0

    for doc in encargos:
        data   = doc.to_dict()
        fotos  = data.get("fotos") or []
        cld    = [u for u in fotos if isinstance(u, str) and u.startswith(CLOUDINARY)]

        if not cld:
            continue

        total_encargos += 1
        cliente = sanitize_client(data.get("cliente") or data.get("client") or "")
        fecha   = sanitize_fecha(data.get("fecha") or "")

        print(f"Encàrrec {doc.id}  client={cliente!r}  fecha={fecha!r}  "
              f"{len(cld)} foto(s) Cloudinary")

        dest = FOTOS_BASE / cliente / fecha
        if not dry:
            dest.mkdir(parents=True, exist_ok=True)

        noves_fotos = list(fotos)  # còpia per modificar

        for url in cld:
            total_fotos += 1
            ext  = ext_from_url(url)
            name = f"{uuid.uuid4().hex[:12]}{ext}"
            path = dest / name
            nova_url = f"{BASE_URL}/fotos/{cliente}/{fecha}/{name}"

            print(f"  ↓ {url[:80]}{'…' if len(url)>80 else ''}")
            print(f"  → {nova_url}")

            if dry:
                total_migrades += 1
                continue

            try:
                contingut = descarregar(url)
                path.write_bytes(contingut)
                # Substituir la URL antiga per la nova
                idx = noves_fotos.index(url)
                noves_fotos[idx] = nova_url
                total_migrades += 1
                print(f"  ✓ Desat ({len(contingut)//1024} KB)")
            except Exception as e:
                total_errors += 1
                print(f"  ✗ Error: {e}", file=sys.stderr)

        if not dry and noves_fotos != fotos:
            db.collection("encargos").document(doc.id).update({"fotos": noves_fotos})
            print(f"  ✓ Firestore actualitzat")

        print()

    print("─" * 60)
    print(f"Encàrrecs processats : {total_encargos}")
    print(f"Fotos trobades       : {total_fotos}")
    print(f"Migrades             : {total_migrades}")
    print(f"Errors               : {total_errors}")
    if dry:
        print("\n[DRY-RUN] Cap canvi real fet.")

if __name__ == "__main__":
    main()
