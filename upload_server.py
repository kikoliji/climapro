#!/usr/bin/env python3
"""
Servidor de pujada d'arxius per a ClimaPro.
Desa els fitxers a /var/www/nouaire/documents/

Instal·lació (Raspberry Pi):
    pip3 install flask

Executar manualment:
    python3 /home/kiko/climapro/upload_server.py

Autostart amb systemd (recomanat):
    sudo nano /etc/systemd/system/climapro-upload.service
    --- contingut ---
    [Unit]
    Description=ClimaPro upload server
    After=network.target

    [Service]
    ExecStart=/usr/bin/python3 /home/kiko/climapro/upload_server.py
    Restart=always
    User=kiko

    [Install]
    WantedBy=multi-user.target
    --- fi ---
    sudo systemctl enable climapro-upload
    sudo systemctl start climapro-upload
"""
from flask import Flask, request, jsonify
from pathlib import Path
import uuid

app = Flask(__name__)

UPLOAD_DIR = Path("/var/www/nouaire/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/upload", methods=["POST", "OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return "", 204
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "No s'ha rebut cap fitxer"}), 400
    ext = Path(f.filename).suffix.lower() if f.filename else ".bin"
    stem = Path(f.filename).stem[:50] if f.filename else "fitxer"
    name = f"{stem}_{uuid.uuid4().hex[:8]}{ext}"
    f.save(UPLOAD_DIR / name)
    print(f"[upload] Desat: {name}")
    return jsonify({"filename": name, "url": f"/documents/{name}"})

@app.route("/health")
def health():
    return jsonify({"status": "ok", "dir": str(UPLOAD_DIR)})

if __name__ == "__main__":
    print(f"[upload_server] Escoltant al port 3001")
    print(f"[upload_server] Desa arxius a: {UPLOAD_DIR}")
    app.run(host="0.0.0.0", port=3001)
