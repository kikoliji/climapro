#!/usr/bin/env python3
"""
Backup de fotos de Cloudinary (guardadas en Firestore) al SSD de la Raspberry.
Ejecutar: python3 backup_fotos.py
Cron nocturn: 0 2 * * * /usr/bin/python3 /home/pi/climapro/backup_fotos.py >> /var/log/backup_fotos.log 2>&1
"""

import os
import re
import sys
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

DEST_DIR = Path("/mnt/ssd/fotos")
SERVICE_ACCOUNT = Path(__file__).parent / "serviceAccountKey.json"

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def nombre_archivo(url, encargo_id, indice):
    # Extrae el ID único de Cloudinary del path de la URL
    # https://res.cloudinary.com/xxx/image/upload/v123456/abcdef.jpg → abcdef.jpg
    path = urlparse(url).path
    cloudinary_id = re.sub(r"^.*upload/(?:v\d+/)?", "", path)
    cloudinary_id = cloudinary_id.replace("/", "_")
    if not cloudinary_id:
        cloudinary_id = f"{encargo_id}_{indice}"
    return cloudinary_id

def descargar(url, dest_path):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    dest_path.write_bytes(r.content)

def main():
    if not SERVICE_ACCOUNT.exists():
        log(f"ERROR: No se encuentra {SERVICE_ACCOUNT}")
        log("Descarga el serviceAccountKey.json desde Firebase Console:")
        log("  Project Settings → Service accounts → Generate new private key")
        sys.exit(1)

    DEST_DIR.mkdir(parents=True, exist_ok=True)

    firebase_admin.initialize_app(credentials.Certificate(str(SERVICE_ACCOUNT)))
    db = firestore.client()

    log("Leyendo encargos de Firestore...")
    encargos = db.collection("encargos").stream()

    total = 0
    descargadas = 0
    omitidas = 0
    errores = 0

    for doc in encargos:
        data = doc.to_dict()
        fotos = data.get("fotos", [])
        if not fotos:
            continue
        for i, url in enumerate(fotos):
            if not isinstance(url, str) or not url.startswith("http"):
                continue
            total += 1
            nombre = nombre_archivo(url, doc.id, i)
            dest = DEST_DIR / nombre
            if dest.exists():
                omitidas += 1
                continue
            try:
                descargar(url, dest)
                descargadas += 1
                log(f"  ✓ {nombre}")
            except Exception as e:
                errores += 1
                log(f"  ✗ {nombre}: {e}")

    log(f"Completado: {descargadas} descargadas, {omitidas} ya existían, {errores} errores (total {total})")

if __name__ == "__main__":
    main()
