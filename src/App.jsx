import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection, addDoc, onSnapshot, orderBy, query, where,
  deleteDoc, doc, updateDoc, setDoc, getDoc, runTransaction, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser
} from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const hoy = new Date().toISOString().split("T")[0];

const COLORS = {
  bg: "#F7F5F0", surface: "#FFFFFF", card: "#FFFFFF", border: "#E8E6E0",
  accent: "#2D6A4F", accentDim: "#245A42", accentGlow: "rgba(45,106,79,0.10)",
  accentLight: "#E8F4EE",
  warm: "#C8601A", warmLight: "#FFF0E6",
  green: "#16A34A", yellow: "#D97706",
  text: "#1A1A18", muted: "#888880",
  blue: "#2952A3", blueLight: "#EBF0FB",
};

const CLOUDINARY_CLOUD = "dekjrcfef";
const CLOUDINARY_PRESET = "climapro";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
const NOUAIRE_LOGO = "https://res.cloudinary.com/dekjrcfef/image/upload/v1776718222/nouaire_logo_eudd5f.png";

const EMPRESA = {
  nom: "Nouaire",
  adreca: "C/ Sant Josep, 11 - 17181 Aiguaviva (Girona)",
  telefon: "972 22 44 64",
  email: "info@nouaire.net",
  web: "www.nouaire.net",
  activitat: "aire condicionat / refrigeració",
};

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${COLORS.bg}; color: ${COLORS.text}; font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
  .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; letter-spacing:.3px; }
  .btn { cursor:pointer; border:none; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; border-radius:8px; padding:8px 16px; transition:all .2s; }
  .btn-primary { background:${COLORS.accent}; color:#fff; }
  .btn-primary:hover { background:${COLORS.accentDim}; transform:translateY(-1px); box-shadow:0 4px 14px rgba(45,106,79,0.3); }
  .btn-ghost { background:transparent; color:${COLORS.muted}; border:1px solid ${COLORS.border}; }
  .btn-ghost:hover { border-color:${COLORS.accent}; color:${COLORS.accent}; }
  .btn:disabled { opacity:0.35; cursor:not-allowed; pointer-events:none; }
  .btn-danger { background:transparent; color:${COLORS.warm}; border:1px solid rgba(200,96,26,0.25); font-size:12px; padding:5px 10px; }
  .btn-danger:hover { background:rgba(200,96,26,0.08); }
  .input { background:#fff; border:1px solid ${COLORS.border}; color:${COLORS.text}; border-radius:8px; padding:10px 13px; font-size:13px; font-family:'DM Sans',sans-serif; width:100%; outline:none; transition:border .2s,box-shadow .2s; }
  .input:focus { border-color:${COLORS.accent}; box-shadow:0 0 0 3px rgba(45,106,79,0.08); }
  .select { background:#fff; border:1px solid ${COLORS.border}; color:${COLORS.text}; border-radius:8px; padding:10px 13px; font-size:13px; font-family:'DM Sans',sans-serif; outline:none; cursor:pointer; }
  .card { background:#fff; border:1px solid ${COLORS.border}; border-radius:14px; box-shadow:0 1px 4px rgba(0,0,0,0.04); transition:box-shadow .2s; }
  .card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.08); }
  label { font-size:11px; color:${COLORS.muted}; font-weight:500; letter-spacing:.5px; text-transform:uppercase; display:block; margin-bottom:6px; }
  .folder-row { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; border-radius:10px; transition:background .15s; }
  .folder-row:hover { background:rgba(45,106,79,0.06); }
  tr:hover td { background:rgba(0,0,0,0.015); }
  .foto-thumb { cursor:pointer; transition:transform .15s; }
  .foto-thumb:hover { transform:scale(1.05); }
  .canvas-firma { touch-action: none; cursor: crosshair; }
  .page-title { font-family:'DM Serif Display',serif; font-size:28px; font-weight:400; letter-spacing:-0.5px; color:${COLORS.text}; }
  .section-title { font-family:'DM Serif Display',serif; font-size:20px; font-weight:400; color:${COLORS.text}; margin-bottom:4px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation:fadeUp 0.35s ease both; }
`;

const ESTADOS_ALBARAN = ["Esborrany", "Enviat", "Cobrat", "Pendent"];
const ESTADOS_ENCARGO = ["Pendent", "En curs", "Completat", "Cancel·lat"];

function calcHoras(entrada, salida) {
  if (!entrada || !salida) return "-";
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 1440;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function calcMinutos(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return mins < 0 ? mins + 1440 : mins;
}

function horaActual() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
}

function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { timeout: 15000, enableHighAccuracy: true }
    );
  });
}

function LinkMapa({ lat, lng, precision }) {
  if (!lat || !lng) return <span style={{ fontSize:11, color:COLORS.muted }}>Sense ubicació</span>;
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
      style={{ fontSize:11, color:COLORS.accent, textDecoration:"none" }}>
      📍 Veure mapa {precision ? `(±${precision}m)` : ""}
    </a>
  );
}

function DireccionMaps({ direccion, localidad }) {
  if (!direccion && !localidad) return null;
  const query = encodeURIComponent(`${direccion || ""} ${localidad || ""}`.trim());
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer"
      style={{ fontSize:12, color:COLORS.accent, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5 }}>
      📍 {direccion || localidad}
    </a>
  );
}

function Lightbox({ fotos, indice, onClose }) {
  const [actual, setActual] = useState(indice);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setActual(a => Math.min(a + 1, fotos.length - 1));
      if (e.key === "ArrowLeft") setActual(a => Math.max(a - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fotos, onClose]);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"relative", maxWidth:"90vw", maxHeight:"80vh" }}>
        <img src={fotos[actual]} alt="" style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:12 }} />
        {fotos.length > 1 && (
          <>
            <button onClick={e=>{e.stopPropagation();setActual(a=>Math.max(a-1,0));}}
              style={{ position:"absolute", left:-48, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.15)", border:"none", color:"#fff", fontSize:24, width:40, height:40, borderRadius:"50%", cursor:"pointer" }}>‹</button>
            <button onClick={e=>{e.stopPropagation();setActual(a=>Math.min(a+1,fotos.length-1));}}
              style={{ position:"absolute", right:-48, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.15)", border:"none", color:"#fff", fontSize:24, width:40, height:40, borderRadius:"50%", cursor:"pointer" }}>›</button>
          </>
        )}
      </div>
      <div style={{ color:"rgba(255,255,255,.6)", fontSize:13 }}>{actual+1} / {fotos.length} · ESC per tancar</div>
    </div>
  );
}

async function subirFoto(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Cloudinary error ${res.status}`);
  const data = await res.json();
  return data.secure_url;
}

async function subirFotoLocal(archivo, client, fecha) {
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("client", client);
  formData.append("fecha", fecha);
  const res = await fetch("https://nouaire.ruizbravo.org/upload/fotos", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload error ${res.status}`);
  const data = await res.json();
  return data.url;
}

async function pujarFitxerLocal(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);
  const host = `${window.location.protocol}//${window.location.hostname}`;
  const res = await fetch(`${host}:3001/upload`, { method:"POST", body:formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function parsearFecha(valor) {
  if (!valor) return "";
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha) return `${fecha.y}-${String(fecha.m).padStart(2,"0")}-${String(fecha.d).padStart(2,"0")}`;
  }
  if (typeof valor === "string" && valor.trim()) {
    const partes = valor.trim().split(/[\/\-\.]/);
    if (partes.length === 3) {
      const [a, b, c] = partes;
      if (c.length === 4) return `${c}-${b.padStart(2,"0")}-${a.padStart(2,"0")}`;
      if (a.length === 4) return `${a}-${b.padStart(2,"0")}-${c.padStart(2,"0")}`;
    }
  }
  return String(valor);
}

// ─── GENERAR PDF HOJA DE TRABAJO ──────────────────────────────────────────────
async function generarPDFHojaTreball(hoja) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 12;

  // Fondo blanc
  pdf.setFillColor(255,255,255);
  pdf.rect(0,0,W,297,"F");

  // Logo
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res,rej) => { img.onload=res; img.onerror=rej; img.src=NOUAIRE_LOGO; });
    const canvas = document.createElement("canvas");
    canvas.width=img.width; canvas.height=img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img,0,0);
    const dataUrl = canvas.toDataURL("image/png");
    pdf.addImage(dataUrl,"PNG",M,M,55,20);
  } catch(e) {
    pdf.setFontSize(18); pdf.setFont("helvetica","bold");
    pdf.setTextColor(30,60,120); pdf.text("nouaire",M,22);
  }

  // Info empresa
  pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(80,80,80);
  pdf.text(EMPRESA.activitat, M, 36);
  pdf.text(EMPRESA.adreca, M, 41);
  pdf.text(`Tel. ${EMPRESA.telefon} - ${EMPRESA.email}`, M, 46);
  pdf.text(EMPRESA.web, M, 51);

  // Caixa dades client (dreta)
  const cx = 80, cy = M, cw = W-cx-M, ch = 58;
  pdf.setDrawColor(150,150,150); pdf.setLineWidth(0.3);
  pdf.rect(cx, cy, cw, ch);

  const lineH = 9;
  const labels = ["Client", "Domicili", "Telèfon / Població", "Núm. / NIF", "Operari"];
  labels.forEach((lbl, i) => {
    const y = cy + 8 + i*lineH;
    pdf.setFontSize(8); pdf.setFont("helvetica","italic"); pdf.setTextColor(100,100,100);
    pdf.text(lbl, cx+3, y);
    pdf.setDrawColor(180,180,180); pdf.setLineWidth(0.2);
    pdf.line(cx+3, y+2, cx+cw-3, y+2);
  });

  // Valors client
  pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(20,20,20);
  pdf.text(hoja.client || "", cx+15, cy+8);
  pdf.text(hoja.domicili || "", cx+15, cy+17);
  const telPob = [hoja.telefon, hoja.poblacio].filter(Boolean).join("  /  ");
  pdf.text(telPob, cx+27, cy+26);
  const numNif = [hoja.numero ? `Núm. ${hoja.numero}` : "", hoja.nif ? `NIF: ${hoja.nif}` : ""].filter(Boolean).join("    ");
  pdf.text(numNif, cx+15, cy+35);
  pdf.text((hoja.operaris||[]).join(", "), cx+15, cy+44);

  // Data
  pdf.setDrawColor(150,150,150); pdf.setLineWidth(0.3);
  pdf.rect(M, 56, 55, 12);
  pdf.setFontSize(8); pdf.setFont("helvetica","italic"); pdf.setTextColor(100,100,100);
  pdf.text("Data", M+2, 62);
  pdf.setFont("helvetica","normal"); pdf.setTextColor(20,20,20); pdf.setFontSize(10);
  pdf.text(hoja.data || "", M+15, 63);

  // Hores taula
  const htY = 72;
  pdf.setDrawColor(120,120,120); pdf.setLineWidth(0.3);
  pdf.rect(M, htY, W-2*M, 14);
  const cols = ["Hores operari","Hores ajudant","Desplaçaments","Dietes","Altres"];
  const colW = (W-2*M)/5;
  cols.forEach((c,i) => {
    if (i>0) { pdf.setDrawColor(150,150,150); pdf.line(M+i*colW, htY, M+i*colW, htY+14); }
    pdf.setFontSize(7); pdf.setFont("helvetica","italic"); pdf.setTextColor(100,100,100);
    pdf.text(c, M+i*colW+2, htY+5);
    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(20,20,20);
    const vals = [hoja.horesOperari||"", hoja.horesAjudant||"", hoja.desplacaments||"", hoja.dietes||"", hoja.altres||""];
    pdf.text(String(vals[i]), M+i*colW+2, htY+12);
  });

  // Descripció treballs
  let yPos = htY + 18;
  pdf.setFillColor(240,240,240); pdf.rect(M, yPos, W-2*M, 7, "F");
  pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(30,30,30);
  pdf.text("DESCRIPCIÓ DELS TREBALLS REALITZATS:", M+2, yPos+5);
  yPos += 7;
  pdf.setDrawColor(150,150,150); pdf.setLineWidth(0.2);
  const descH = 36;
  pdf.rect(M, yPos, W-2*M, descH);
  pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(20,20,20);
  const descLines = pdf.splitTextToSize(hoja.descripcio || "", W-2*M-4);
  pdf.text(descLines.slice(0,6), M+2, yPos+6);
  yPos += descH + 3;

  // Materials
  pdf.setFillColor(240,240,240); pdf.rect(M, yPos, W-2*M, 7, "F");
  pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(30,30,30);
  pdf.text("MATERIALS SUBMINISTRATS O INSTAL·LATS:", M+2, yPos+5);
  yPos += 7;

  const matW = W-2*M;
  // Capçalera materials
  pdf.setFillColor(250,250,250); pdf.rect(M, yPos, matW, 6, "F");
  pdf.setDrawColor(150,150,150); pdf.setLineWidth(0.2);
  pdf.rect(M, yPos, matW, 6);
  pdf.setFontSize(7); pdf.setFont("helvetica","italic"); pdf.setTextColor(80,80,80);
  pdf.text("Descripció material", M+2, yPos+4);
  yPos += 6;

  const mats = hoja.materials || [];
  const matLineH = 7;
  const maxMats = 10;
  for (let i = 0; i < maxMats; i++) {
    pdf.setDrawColor(180,180,180); pdf.setLineWidth(0.15);
    pdf.rect(M, yPos, matW, matLineH);
    if (mats[i]) {
      pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(20,20,20);
      pdf.text(String(mats[i].descripcio||"").substring(0,90), M+2, yPos+5);
    }
    yPos += matLineH;
  }
  yPos += 3;

  // Signatura (ample complet)
  const sigH = 52;
  pdf.setDrawColor(150,150,150); pdf.setLineWidth(0.3);
  pdf.rect(M, yPos, W-2*M, sigH);
  pdf.setFontSize(8); pdf.setFont("helvetica","italic"); pdf.setTextColor(100,100,100);
  pdf.text("Signatura Client,", M+3, yPos+6);
  if (hoja.signatura) {
    try {
      pdf.addImage(hoja.signatura, "PNG", M+3, yPos+10, W-2*M-6, sigH-14);
    } catch(e) {}
  }

  return pdf;
}

function generarPDFHorario(trabajador, fichajes, empresa = "Nouaire") {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ahora = new Date();
  const hace4años = new Date();
  hace4años.setFullYear(ahora.getFullYear() - 4);
  const registros = fichajes
    .filter(f => f.trabajador === trabajador && new Date(f.fecha) >= hace4años)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.entrada||"").localeCompare(b.entrada||""));
  const porDia = {};
  registros.forEach(f => { if (!porDia[f.fecha]) porDia[f.fecha] = []; porDia[f.fecha].push(f); });

  pdf.setFillColor(15, 17, 23); pdf.rect(0, 0, 210, 40, "F");
  pdf.setTextColor(0, 196, 255); pdf.setFontSize(20); pdf.setFont("helvetica", "bold");
  pdf.text("REGISTRE DE JORNADA LABORAL", 105, 15, { align: "center" });
  pdf.setTextColor(200, 200, 200); pdf.setFontSize(11);
  pdf.text(`Empresa: ${empresa}`, 105, 23, { align: "center" });
  pdf.setTextColor(150, 150, 150); pdf.setFontSize(9);
  pdf.text("Art. 34.9 de l'Estatut dels Treballadors — RDL 8/2019", 105, 30, { align: "center" });
  pdf.setTextColor(30, 30, 30); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
  pdf.text("DADES DEL TREBALLADOR", 14, 50);
  pdf.setDrawColor(0, 196, 255); pdf.setLineWidth(0.5); pdf.line(14, 52, 196, 52);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(50, 50, 50);
  pdf.text(`Nom: ${trabajador}`, 14, 60);
  pdf.text(`Període: ${hace4años.toLocaleDateString("ca-ES")} — ${ahora.toLocaleDateString("ca-ES")}`, 14, 67);
  const totalMins = registros.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
  pdf.text(`Total hores: ${Math.floor(totalMins/60)}h ${totalMins%60}m`, 120, 60);
  pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(30, 30, 30);
  pdf.text("REGISTRES DE JORNADA", 14, 80); pdf.line(14, 82, 196, 82);

  if (registros.length > 0) {
    const rows = [];
    Object.entries(porDia).forEach(([fecha, tramos]) => {
      const totalDia = tramos.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
      const dia = new Date(fecha + "T00:00:00").toLocaleDateString("ca-ES", { weekday: "short" });
      tramos.forEach((f, i) => {
        const ub = f.ubicacionEntrada ? `${f.ubicacionEntrada.lat.toFixed(4)},${f.ubicacionEntrada.lng.toFixed(4)}` : "—";
        rows.push([i===0?fecha:"", i===0?dia.charAt(0).toUpperCase()+dia.slice(1):"", `T${i+1}`, f.entrada||"—", f.salida||"—", calcHoras(f.entrada,f.salida), i===tramos.length-1?`${Math.floor(totalDia/60)}h ${totalDia%60}m`:"", ub]);
      });
    });
    autoTable(pdf, { startY:87, head:[["Data","Dia","T.","Entrada","Sortida","Hores","Total","GPS"]], body:rows, headStyles:{fillColor:[15,17,23],textColor:[0,196,255],fontSize:7}, bodyStyles:{fontSize:7}, margin:{left:14,right:14} });
  }
  const tot = pdf.getNumberOfPages();
  for (let i=1;i<=tot;i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150,150,150); pdf.text(`Pàgina ${i} de ${tot}`,105,290,{align:"center"}); }
  pdf.save(`registre_horari_${trabajador.replace(/\s/g,"_")}_${ahora.getFullYear()}.pdf`);
}

async function generarNumeroAlbara() {
  const comptadorRef = doc(db, "contadors", "albaranes");
  const any = new Date().getFullYear();
  let num;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(comptadorRef);
    const ultim = snap.exists() ? (snap.data().ultim || 0) : 0;
    num = ultim + 1;
    transaction.set(comptadorRef, { ultim: num }, { merge: true });
  });
  return `ALB-${any}-${String(num).padStart(4, "0")}`;
}

async function generarNumeroFullTreball() {
  const comptadorRef = doc(db, "contadors", "hojesTreball");
  const any = new Date().getFullYear();
  let num;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(comptadorRef);
    const ultim = snap.exists() ? (snap.data().ultim || 0) : 0;
    num = ultim + 1;
    transaction.set(comptadorRef, { ultim: num }, { merge: true });
  });
  return `FT-${any}-${String(num).padStart(4, "0")}`;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setCargando(true); setError("");
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setError("Email o contrasenya incorrectes"); }
    setCargando(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", background:COLORS.bg }}>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:380 }}>
          <div style={{ marginBottom:40 }}>
            <img src={NOUAIRE_LOGO} alt="Nouaire" style={{ height:48, marginBottom:20 }} />
            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, fontWeight:400, letterSpacing:"-0.5px", color:COLORS.text, marginBottom:6 }}>Benvingut</h1>
            <p style={{ fontSize:14, color:COLORS.muted, fontWeight:300 }}>Accedeix al panell de gestió de Nouaire</p>
          </div>
          <div style={{ display:"grid", gap:16 }}>
            <div><label>Email</label><input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
            <div><label>Contrasenya</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
            {error && <div style={{ fontSize:13, color:COLORS.warm, background:"#FEE2E2", padding:"10px 14px", borderRadius:8 }}>{error}</div>}
            <button className="btn btn-primary" onClick={handleLogin} disabled={cargando} style={{ width:"100%", padding:"13px", fontSize:14, borderRadius:10, marginTop:4 }}>
              {cargando ? "Entrant..." : "Entrar"}
            </button>
          </div>
        </div>
      </div>
      <div style={{ width:360, background:COLORS.accentLight, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:64, marginBottom:20 }}>🌿</div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:COLORS.accent, marginBottom:10 }}>Nouaire</div>
          <div style={{ fontSize:13, color:COLORS.accentDim, fontWeight:300, lineHeight:1.6 }}>{EMPRESA.adreca}<br/>{EMPRESA.telefon}</div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide, extraWide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div className="card" style={{ width:"100%", maxWidth: extraWide?900:wide?720:540, padding:24, margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, fontWeight:700, color:COLORS.accent }}>{title}</span>
          <button className="btn btn-ghost" style={{ padding:"4px 10px" }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const colors = {
    esborrany:{bg:"#FEF9C3",color:"#A16207"}, pendent:{bg:"#FFEDD5",color:"#C8601A"}, completada:{bg:"#DCFCE7",color:"#16A34A"},
    Cobrat:{bg:"#DCFCE7",color:"#16A34A"}, Enviat:{bg:"#DBEAFE",color:"#2952A3"},
    Esborrany:{bg:"#F1F0EC",color:"#888880"}, Pendent:{bg:"#FEF9C3",color:"#A16207"},
    "En curs":{bg:"#DBEAFE",color:"#2952A3"}, Completat:{bg:"#DCFCE7",color:"#16A34A"},
    "Cancel·lat":{bg:"#FEE2E2",color:"#C8601A"}, Urgent:{bg:"#FEE2E2",color:"#C8601A"},
    Alta:{bg:"#FFEDD5",color:"#C8601A"}, Mitjana:{bg:"#FEF9C3",color:"#A16207"},
    Baixa:{bg:"#F1F0EC",color:"#888880"}, Actiu:{bg:"#DCFCE7",color:"#16A34A"},
    Inactiu:{bg:"#F1F0EC",color:"#888880"}, Signat:{bg:"#DCFCE7",color:"#16A34A"},
  };
  const c = colors[estado]||{bg:"#F1F0EC",color:"#888880"};
  return <span className="badge" style={{background:c.bg,color:c.color}}>{estado}</span>;
}

function Header({ title, onAdd, addLabel }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
      <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, fontWeight:700 }}>{title}</h2>
      {onAdd && <button className="btn btn-primary" onClick={onAdd}>{addLabel}</button>}
    </div>
  );
}

// ─── CANVAS SIGNATURA ─────────────────────────────────────────────────────────
function CanvasSignatura({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = (e) => { e && e.preventDefault(); drawing.current = false; };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const guardar = () => {
    const canvas = canvasRef.current;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <label>✍ Signatura del client</label>
      <div style={{ background:"#fff", borderRadius:10, border:`2px solid ${COLORS.border}`, overflow:"hidden", marginBottom:10 }}>
        <canvas
          ref={canvasRef}
          width={500} height={160}
          className="canvas-firma"
          style={{ display:"block", width:"100%", height:160, background:"#fff" }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-ghost" onClick={limpiar}>🗑 Esborrar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel·lar</button>
        <button className="btn btn-primary" onClick={guardar}>✅ Confirmar signatura</button>
      </div>
    </div>
  );
}

// ─── HOJA DE TRABAJO — FORMULARIO ────────────────────────────────────────────
function FormHojaTreball({ hoja, onClose, trabajadores, encargos, materialsHistorial, isWorker }) {
  const emptyForm = {
    numero: "", data: new Date().toISOString().split("T")[0],
    client: "", domicili: "", poblacio: "", telefon: "", nif: "",
    operaris: isWorker ? [isWorker] : [], horesOperari: "", horesAjudant: "", desplacaments: "", dietes: "", altres: "",
    descripcio: "", materials: [],
    signatura: null, estat: isWorker ? "esborrany" : "pendent", encargoId: "", email: "",
  };

  const [form, setForm] = useState(hoja ? { ...emptyForm, ...hoja, materials: Array.isArray(hoja.materials) ? hoja.materials : [], operaris: Array.isArray(hoja.operaris) ? hoja.operaris : (hoja.operaris ? [hoja.operaris] : []) } : emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [mostrarSignatura, setMostrarSignatura] = useState(false);
  const [generant, setGenerant] = useState(false);
  const [sugMaterials, setSugMaterials] = useState([]);
  const [matInput, setMatInput] = useState("");
  const [showSug, setShowSug] = useState(false);

  const nombresActivos = trabajadores.filter(t=>t.estado!=="Inactiu").map(t=>t.nombre);

  // Autocompletado materiales
  const filtrarSugerencias = (text) => {
    if (!text) { setSugMaterials([]); return; }
    const sug = materialsHistorial.filter(m => m.toLowerCase().includes(text.toLowerCase())).slice(0,6);
    setSugMaterials(sug);
  };

  const afegirMaterial = (desc) => {
    if (!desc.trim()) return;
    setForm(f => ({ ...f, materials: [...(f.materials||[]), { descripcio: desc.trim() }] }));
    setMatInput(""); setSugMaterials([]); setShowSug(false);
  };

  const eliminarMaterial = (i) => setForm(f => ({ ...f, materials: (f.materials||[]).filter((_,j)=>j!==i) }));

  const toggleOperari = (nom) => {
    const actual = Array.isArray(form.operaris) ? form.operaris : [];
    setForm({ ...form, operaris: actual.includes(nom) ? actual.filter(n=>n!==nom) : [...actual, nom] });
  };

  const guardar = async () => {
    setGuardando(true);
    const dades = { ...form, updatedAt: new Date().toISOString() };
    let hojaId = hoja?.id;
    if (hojaId) {
      await updateDoc(doc(db,"hojesTreball",hojaId), dades);
    } else {
      dades.numero = await generarNumeroFullTreball();
      const ref = await addDoc(collection(db,"hojesTreball"), { ...dades, createdAt: serverTimestamp() });
      hojaId = ref.id;
      // Crear albarà automàtic
      const numeroAlbara = await generarNumeroAlbara();
      await addDoc(collection(db,"albaranes"), {
        numero: numeroAlbara,
        cliente: form.client || "",
        fecha: form.data || new Date().toISOString().split("T")[0],
        descripcion: form.descripcio || "",
        importe: 0,
        estado: "Esborrany",
        operaris: form.operaris || [],
        origenFullId: hojaId,
        createdAt: new Date().toISOString(),
      });
      // Notificació a l'admin quan el treballador envia un full nou
      if (isWorker) {
        await addDoc(collection(db,"notificacions"), {
          tipus: "full_enviat",
          missatge: `${isWorker} ha enviat un full de treball (client: ${form.client||"—"})`,
          hojaId,
          llegida: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    // Guardar materials nous a l'historial
    for (const mat of (form.materials||[])) {
      if (mat.descripcio && !materialsHistorial.includes(mat.descripcio)) {
        await addDoc(collection(db,"materialsHistorial"), { nom: mat.descripcio, createdAt: new Date().toISOString() });
      }
    }
    setGuardando(false);
    onClose();
  };

  const descarregarPDF = async () => {
    setGenerant(true);
    const pdf = await generarPDFHojaTreball(form);
    pdf.save(`hoja_treball_${form.numero||"nou"}_${form.client||"client"}.pdf`);
    setGenerant(false);
  };

  const enviarPerCorreu = async () => {
    if (!form.email) { alert("Afegeix l'email del client al formulari"); return; }
    setGenerant(true);
    try {
      const pdf = await generarPDFHojaTreball(form);
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      const filename = `full-${form.numero || "nou"}.pdf`;
      const subject = `Full de treball #${form.numero || ""} - ${form.client || ""}`;
      const bodyText = "Benvolgut/da, us adjuntem el full de treball. Gràcies.";

      // Build RFC 2822 MIME multipart message
      const encSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const encBody = btoa(unescape(encodeURIComponent(bodyText)));
      const boundary = `=_Part_${Date.now()}`;
      const pdfLines = (pdfBase64.match(/.{1,76}/g) || [pdfBase64]).join("\r\n");
      const mime = [
        "MIME-Version: 1.0",
        `To: ${form.email}`,
        `Subject: ${encSubject}`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        encBody,
        "",
        `--${boundary}`,
        `Content-Type: application/pdf; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
        "",
        pdfLines,
        "",
        `--${boundary}--`,
      ].join("\r\n");

      // Base64url encode the full MIME message for Gmail API
      const msgBytes = new TextEncoder().encode(mime);
      let binary = "";
      for (let i = 0; i < msgBytes.length; i += 4096) {
        binary += String.fromCharCode(...msgBytes.subarray(i, i + 4096));
      }
      const raw = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      // OAuth2 token + Gmail API send
      if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services no disponible");
      console.log('client_id value:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
      await new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/gmail.send",
          callback: async (tokenResp) => {
            if (tokenResp.error) { reject(new Error(tokenResp.error)); return; }
            try {
              const res = await fetch(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${tokenResp.access_token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ raw }),
                }
              );
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                reject(new Error(errData.error?.message || `Gmail API error ${res.status}`));
              } else {
                resolve();
              }
            } catch (e) { reject(e); }
          },
        });
        client.requestAccessToken({ prompt: "" });
      });

      alert(`Correu enviat correctament a ${form.email}`);
    } catch (err) {
      console.error("[Gmail] Error enviant correu:", err);
      alert(`Error enviant el correu: ${err.message}`);
    } finally {
      setGenerant(false);
    }
  };

  // Omplir des d'encàrrec
  const omplirDesEncargo = (encargoId) => {
    const enc = encargos.find(e=>e.id===encargoId);
    if (!enc) return;
    const asignados = Array.isArray(enc.asignados) ? enc.asignados : (enc.asignado ? [enc.asignado] : []);
    const toStr = (v) => (v && typeof v === "object" && v.toDate) ? v.toDate().toISOString().split("T")[0] : (typeof v === "string" ? v : "");
    setForm(f => ({
      ...f, encargoId,
      client: toStr(enc.cliente) || f.client,
      domicili: toStr(enc.direccion) || f.domicili,
      poblacio: toStr(enc.localidad) || f.poblacio,
      telefon: toStr(enc.telefono) || f.telefon,
      operaris: asignados.length > 0 ? asignados : f.operaris,
      data: toStr(enc.fecha) || f.data,
      descripcio: toStr(enc.notas) || f.descripcio,
    }));
  };

  return (
    <div style={{ display:"grid", gap:16 }}>

      {/* VINCULAR ENCÀRREC */}
      {encargos.length > 0 && (
        <div style={{ background:"rgba(0,196,255,.07)", border:`1px solid ${COLORS.accent}33`, borderRadius:10, padding:12 }}>
          <label>Omplir des d'un encàrrec existent</label>
          <select className="select" style={{ width:"100%" }} value={form.encargoId||""} onChange={e=>omplirDesEncargo(e.target.value)}>
            <option value="">— Selecciona encàrrec —</option>
            {encargos.filter(e=>!e.archivado&&e.estado!=="Cancel·lat").map(e=>(
              <option key={e.id} value={e.id}>{String(e.titulo||"")} — {String(e.cliente||"")}</option>
            ))}
          </select>
        </div>
      )}

      {/* NÚMERO I DATA */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label>Número full</label><input className="input" placeholder="028244" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
        <div><label>Data</label><input className="input" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></div>
      </div>

      {/* CLIENT */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label>Client *</label><input className="input" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} /></div>
        <div><label>NIF</label><input className="input" value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
      </div>
      <div><label>Domicili</label><input className="input" value={form.domicili} onChange={e=>setForm({...form,domicili:e.target.value})} /></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label>Població</label><input className="input" value={form.poblacio} onChange={e=>setForm({...form,poblacio:e.target.value})} /></div>
        <div><label>Telèfon</label><input className="input" value={form.telefon} onChange={e=>setForm({...form,telefon:e.target.value})} /></div>
      </div>
      <div><label>📧 Email client</label><input className="input" type="email" placeholder="client@exemple.com" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} /></div>

      {/* OPERARIS */}
      <div>
        <label>👷 Operaris</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
          {nombresActivos.map(nom => {
            const sel = (form.operaris||[]).includes(nom);
            return (
              <button key={nom} type="button" onClick={() => toggleOperari(nom)}
                style={{ padding:"6px 14px", borderRadius:20, cursor:"pointer", border:"none", fontFamily:"Inter", fontSize:12, fontWeight:500,
                  background: sel ? COLORS.accent : COLORS.surface,
                  color: sel ? "#000" : COLORS.muted,
                  outline: sel ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}` }}>
                {sel ? "✓ " : ""}{nom}
              </button>
            );
          })}
        </div>
      </div>

      {/* HORES */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {[
          { lbl:"Hores operari", key:"horesOperari" },
          { lbl:"Hores ajudant", key:"horesAjudant" },
          { lbl:"Desplaçaments", key:"desplacaments" },
          { lbl:"Dietes", key:"dietes" },
          { lbl:"Altres", key:"altres" },
        ].map(({ lbl, key }) => (
          <div key={key}><label style={{ fontSize:10 }}>{lbl}</label><input className="input" style={{ padding:"7px 8px", fontSize:12 }} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} /></div>
        ))}
      </div>

      {/* DESCRIPCIÓ */}
      <div>
        <label>📋 Descripció dels treballs realitzats</label>
        <textarea className="input" placeholder="Descriu detalladament els treballs realitzats..." value={form.descripcio}
          onChange={e=>setForm({...form,descripcio:e.target.value})} style={{ minHeight:90, resize:"vertical" }} />
      </div>

      {/* MATERIALS */}
      <div>
        <label>🔩 Materials subministrats o instal·lats</label>
        {(form.materials||[]).length > 0 && (
          <div style={{ marginBottom:8 }}>
            {(form.materials||[]).map((m,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:COLORS.surface, borderRadius:6, marginBottom:4 }}>
                <span style={{ fontSize:13, flex:1 }}>{m.descripcio}</span>
                <button className="btn btn-danger" style={{ padding:"2px 8px" }} onClick={() => eliminarMaterial(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
        {/* Input nou material */}
        <div style={{ display:"flex", gap:8, alignItems:"flex-start", position:"relative" }}>
          <div style={{ flex:1, position:"relative" }}>
            <input className="input" placeholder="Descripció material..." value={matInput}
              onChange={e=>{ setMatInput(e.target.value); filtrarSugerencias(e.target.value); setShowSug(true); }}
              onFocus={()=>{ filtrarSugerencias(matInput); setShowSug(true); }}
              onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); afegirMaterial(matInput); } }}
            />
            {showSug && sugMaterials.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:8, zIndex:50, maxHeight:180, overflowY:"auto" }}>
                {sugMaterials.map((s,i) => (
                  <div key={i} style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, borderBottom:`1px solid ${COLORS.border}` }}
                    onMouseDown={e=>{ e.preventDefault(); setMatInput(s); setSugMaterials([]); setShowSug(false); }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" style={{ whiteSpace:"nowrap" }} onClick={()=>afegirMaterial(matInput)}>+ Afegir</button>
        </div>
      </div>

      {/* SIGNATURA */}
      {form.signatura ? (
        <div>
          <label>✅ Signatura recollida</label>
          <div style={{ display:"flex", alignItems:"center", gap:12, background:"#fff", borderRadius:8, padding:8, display:"inline-flex" }}>
            <img src={form.signatura} alt="signatura" style={{ height:60, maxWidth:200 }} />
            <button className="btn btn-ghost" onClick={()=>setForm({...form,signatura:null})}>Esborrar</button>
          </div>
        </div>
      ) : mostrarSignatura ? (
        <CanvasSignatura
          onSave={(sig) => { setForm({...form, signatura:sig, estat:"Signat"}); setMostrarSignatura(false); }}
          onCancel={() => setMostrarSignatura(false)}
        />
      ) : (
        <button className="btn btn-ghost" onClick={()=>setMostrarSignatura(true)} style={{ width:"100%", padding:14 }}>
          ✍ Recollir signatura del client
        </button>
      )}

      {/* BOTONS */}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel·lar</button>
        <button className="btn btn-ghost" onClick={descarregarPDF} disabled={generant}>
          {generant ? "Generant..." : "📄 Descarregar PDF"}
        </button>
        <button className="btn btn-ghost" onClick={enviarPerCorreu} disabled={generant} style={{ color: form.email ? COLORS.accent : COLORS.muted }}>
          {generant ? "Generant..." : "📧 Enviar per correu"}
        </button>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardant..." : "💾 Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── HOJAS DE TRABAJO (SECCIÓN PRINCIPAL) ────────────────────────────────────
function HojesTreball({ trabajadores, encargos, podeAprovar=false }) {
  const [hojes, setHojes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editant, setEditant] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [generant, setGenerant] = useState(null);
  const [materialsHistorial, setMaterialsHistorial] = useState([]);
  const [filtreEstat, setFiltreEstat] = useState("Tots");
  const [filtreBusqueda, setFiltreBusqueda] = useState("");

  useEffect(() => {
    const q = query(collection(db,"hojesTreball"), orderBy("createdAt","desc"));
    return onSnapshot(q, snap => { setHojes(snap.docs.map(d=>({id:d.id,...d.data()}))); setCargando(false); });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db,"materialsHistorial"), snap => {
      setMaterialsHistorial(snap.docs.map(d=>d.data().nom).filter(Boolean));
    });
  }, []);

  const eliminar = async (id) => { await deleteDoc(doc(db,"hojesTreball",id)); setConfirmarEliminar(null); };

  const descarregarPDF = async (hoja) => {
    setGenerant(hoja.id);
    const pdf = await generarPDFHojaTreball(hoja);
    pdf.save(`full_treball_${hoja.numero||hoja.id}_${hoja.client||"client"}.pdf`);
    setGenerant(null);
  };

  const lista = hojes
    .filter(h => filtreEstat==="Tots" || h.estat===filtreEstat)
    .filter(h => !filtreBusqueda || h.client?.toLowerCase().includes(filtreBusqueda.toLowerCase()) || h.numero?.includes(filtreBusqueda));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, fontWeight:700 }}>Fulls de Treball</h2>
        <button className="btn btn-primary" onClick={()=>{ setEditant(null); setModal(true); }}>+ Nou full</button>
      </div>

      {/* FILTRES */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        {["Tots","Pendent","Signat","Enviat"].map(f=>(
          <button key={f} className="btn" onClick={()=>setFiltreEstat(f)}
            style={{ background:filtreEstat===f?COLORS.accent:COLORS.surface, color:filtreEstat===f?"#000":COLORS.muted, border:`1px solid ${filtreEstat===f?COLORS.accent:COLORS.border}`, fontSize:12 }}>
            {f}
          </button>
        ))}
        <input className="input" placeholder="🔍 Client o número..." style={{ flex:1, minWidth:160, fontSize:12 }}
          value={filtreBusqueda} onChange={e=>setFiltreBusqueda(e.target.value)} />
        <span style={{ alignSelf:"center", fontFamily:"'DM Serif Display',serif", fontWeight:700, fontSize:14, color:COLORS.accent }}>{lista.length} fulls</span>
      </div>

      {/* LLISTA */}
      {cargando ? <div style={{ color:COLORS.muted, textAlign:"center", padding:40 }}>Carregant...</div> : (
        <div style={{ display:"grid", gap:10 }}>
          {lista.length === 0
            ? <div className="card" style={{ padding:40, textAlign:"center", color:COLORS.muted }}>No hi ha fulls de treball</div>
            : lista.map(h => (
              <div key={h.id} className="card" style={{ padding:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"center" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <EstadoBadge estado={h.estat||"Pendent"} />
                      {h.numero && <span style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, color:COLORS.accent, fontSize:15 }}>#{h.numero}</span>}
                      {h.signatura && <span className="badge" style={{ background:"rgba(0,230,118,.15)", color:COLORS.green }}>✅ Signat</span>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{h.client || "Sense client"}</div>
                    <div style={{ fontSize:12, color:COLORS.muted }}>
                      {h.data}{h.poblacio ? ` · ${h.poblacio}` : ""}{Array.isArray(h.operaris) && h.operaris.length > 0 ? ` · 👷 ${h.operaris.join(", ")}` : ""}
                    </div>
                    {h.total && <div style={{ fontSize:13, color:COLORS.green, marginTop:4, fontFamily:"'DM Serif Display',serif", fontWeight:700 }}>TOTAL: {h.total}€</div>}
                    {h.descripcio && <div style={{ fontSize:12, color:COLORS.muted, marginTop:4, fontStyle:"italic" }}>"{h.descripcio.substring(0,80)}{h.descripcio.length>80?"...":""}"</div>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button className="btn btn-primary" style={{ fontSize:12, padding:"6px 12px" }}
                      onClick={()=>{ setEditant(h); setModal(true); }}>✏ Editar</button>
                    <button className="btn btn-ghost" style={{ fontSize:12, padding:"6px 12px" }}
                      onClick={()=>descarregarPDF(h)} disabled={generant===h.id}>
                      {generant===h.id ? "..." : "📄 PDF"}
                    </button>
                    {(h.estat==="pendent"||h.estat==="Pendent") && (
                      <button className="btn btn-primary" style={{fontSize:12,padding:"6px 12px",background:COLORS.green}}
                        onClick={()=>updateDoc(doc(db,"hojesTreball",h.id),{estat:"completada"})}>
                        ✅ Completar
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(h)}>🗑</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* MODAL FORMULARI */}
      {modal && (
        <Modal title={editant ? `Editar full #${editant.numero||""}` : "Nou full de treball"} onClose={()=>setModal(false)} extraWide>
          <FormHojaTreball
            hoja={editant}
            onClose={() => setModal(false)}
            trabajadores={trabajadores}
            encargos={encargos}
            materialsHistorial={materialsHistorial}
          />
        </Modal>
      )}

      {confirmarEliminar && (
        <Modal title="Eliminar full?" onClose={()=>setConfirmarEliminar(null)}>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:600, color:COLORS.accent }}>{confirmarEliminar.client} — {confirmarEliminar.data}</div>
            <div style={{ fontSize:13, color:COLORS.muted, marginTop:4 }}>No es pot desfer.</div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancel·lar</button>
            <button className="btn" style={{ background:COLORS.warm, color:"#fff" }} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── GESTIONAR ENCARGO (trabajador) ──────────────────────────────────────────
function GestionarEncargo({ encargo, onClose }) {
  const [estado, setEstado] = useState(encargo.estado);
  const [notas, setNotas] = useState(encargo.notasTrabajador || "");
  const [fotos, setFotos] = useState(encargo.fotos || []);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [lightbox, setLightbox] = useState(null);

  const subirFotos = async (archivos) => {
    setSubiendo(true);
    const urls = [...fotos];
    for (let i = 0; i < archivos.length; i++) {
      setProgreso(`Pujant foto ${i+1} de ${archivos.length}...`);
      const url = await subirFotoLocal(archivos[i], encargo.cliente || "sense_client", hoy);
      urls.push(url);
    }
    setFotos(urls); setSubiendo(false); setProgreso("");
  };

  const guardar = async () => {
    setGuardando(true);
    const ahora = new Date().toISOString().split("T")[0];
    await updateDoc(doc(db, "encargos", encargo.id), {
      estado, notasTrabajador: notas, fotos,
      fechaCompletado: estado === "Completat" ? ahora : null,
    });
    setGuardando(false); onClose();
  };

  return (
    <>
      <Modal title={`✏ ${encargo.titulo}`} onClose={onClose} wide>
        <div style={{ display:"grid", gap:16 }}>
          <div style={{ background:COLORS.surface, padding:14, borderRadius:10, display:"grid", gap:6 }}>
            <div style={{ fontSize:13, fontWeight:500 }}>{encargo.cliente}</div>
            {(encargo.direccion || encargo.localidad) && <DireccionMaps direccion={encargo.direccion} localidad={encargo.localidad} />}
            {encargo.telefono && <a href={`tel:${encargo.telefono}`} style={{ fontSize:12, color:COLORS.accent, textDecoration:"none" }}>📱 {encargo.telefono}</a>}
            {encargo.notas && <div style={{ fontSize:12, color:COLORS.muted, fontStyle:"italic" }}>📋 {encargo.notas}</div>}
          </div>
          <div>
            <label>Estat de l'encàrrec</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:6 }}>
              {[{s:"Pendent",icon:"⏳",color:COLORS.yellow},{s:"En curs",icon:"🔄",color:COLORS.accent},{s:"Completat",icon:"✅",color:COLORS.green}].map(({s,icon,color})=>(
                <button key={s} onClick={()=>setEstado(s)} style={{ padding:"14px 8px", borderRadius:12, cursor:"pointer", border:"none", background:estado===s?color:COLORS.surface, color:estado===s?"#000":COLORS.muted, fontSize:13, fontWeight:700, fontFamily:"Inter", outline:estado===s?`3px solid ${color}`:`1px solid ${COLORS.border}`, display:"flex", flexDirection:"column", alignItems:"center", gap:6, transition:"all .15s", transform:estado===s?"scale(1.04)":"scale(1)" }}>
                  <span style={{ fontSize:22 }}>{icon}</span>{s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label>⚠ Materials o recanvis que falten</label>
            <textarea className="input" placeholder="Ex: Falta vàlvula d'expansió, filtre G4..." value={notas} onChange={e=>setNotas(e.target.value)} style={{ minHeight:70, resize:"vertical" }} />
          </div>
          <div>
            <label>📷 Fotos del treball</label>
            {fotos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, marginTop:6 }}>
                {fotos.map((url,i)=>(
                  <div key={i} style={{ position:"relative" }}>
                    <img src={url} alt="" className="foto-thumb" onClick={()=>setLightbox(i)} style={{ width:80, height:80, objectFit:"cover", borderRadius:8, border:`2px solid ${COLORS.border}` }} />
                    <button onClick={()=>setFotos(fotos.filter((_,j)=>j!==i))} style={{ position:"absolute", top:-6, right:-6, background:COLORS.warm, border:"none", borderRadius:"50%", width:20, height:20, cursor:"pointer", color:"#fff", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <label htmlFor="foto-input" className="btn btn-ghost" style={{ cursor:"pointer", margin:0 }}>{subiendo?progreso:"📷 Afegir fotos"}</label>
              <input id="foto-input" type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>subirFotos(Array.from(e.target.files))} disabled={subiendo} />
              {fotos.length>0 && <span style={{ fontSize:12, color:COLORS.muted }}>{fotos.length} foto{fotos.length!==1?"s":""} · toca per ampliar</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando||subiendo} style={{ padding:"10px 24px" }}>{guardando?"Guardant...":"💾 Guardar"}</button>
          </div>
        </div>
      </Modal>
      {lightbox !== null && <Lightbox fotos={fotos} indice={lightbox} onClose={()=>setLightbox(null)} />}
    </>
  );
}

// ─── HELPER: dades de la setmana actual (Dl–Dv) ──────────────────────────────
function getSetmanaActual() {
  const avui = new Date();
  const diaSemana = avui.getDay(); // 0=dg,1=dl...6=ds
  const difDl = diaSemana === 0 ? -6 : 1 - diaSemana;
  const dies = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(avui);
    d.setDate(avui.getDate() + difDl + i);
    dies.push(d.toISOString().split("T")[0]);
  }
  return dies;
}

// ─── RESUM SETMANAL ───────────────────────────────────────────────────────────
function ResumSetmanal({ nom, fichajes }) {
  const dies = getSetmanaActual();
  const avui = new Date().toISOString().split("T")[0];
  const nomsDia = ["Dl","Dt","Dc","Dj","Dv"];
  return (
    <div className="card" style={{ padding:20, marginBottom:20, borderTop:`3px solid ${COLORS.yellow}` }}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, fontSize:17, marginBottom:14, color:COLORS.yellow }}>📅 Resum setmanal</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {dies.map((dia, i) => {
          const tramsDia = fichajes.filter(f=>f.trabajador===nom&&f.fecha===dia);
          const mins = tramsDia.reduce((s,f)=>s+calcMinutos(f.entrada,f.salida),0);
          const esAvui = dia === avui;
          const esFutur = dia > avui;
          const pocesHores = !esFutur && mins > 0 && mins < 480;
          const senseFitxar = !esFutur && mins === 0;
          let borderColor = COLORS.border;
          if (esAvui) borderColor = COLORS.accent;
          else if (pocesHores) borderColor = COLORS.yellow;
          else if (senseFitxar && !esFutur) borderColor = COLORS.warm;
          else if (mins >= 480) borderColor = COLORS.green;
          return (
            <div key={dia} style={{ textAlign:"center", padding:"10px 6px", borderRadius:10, border:`1px solid ${borderColor}`, background: esAvui?"rgba(0,196,255,.07)":COLORS.surface, position:"relative" }}>
              <div style={{ fontSize:11, color:COLORS.muted, fontWeight:600, marginBottom:4 }}>{nomsDia[i]}</div>
              <div style={{ fontSize:10, color:COLORS.muted, marginBottom:6 }}>{dia.slice(5)}</div>
              {esFutur ? (
                <div style={{ fontSize:12, color:COLORS.muted }}>—</div>
              ) : mins === 0 ? (
                <div style={{ fontSize:11, color:COLORS.warm }}>⚠ 0h</div>
              ) : (
                <div style={{ fontSize:13, fontWeight:700, color: mins>=480?COLORS.green:COLORS.yellow, fontFamily:"'DM Serif Display',serif" }}>
                  {Math.floor(mins/60)}h{mins%60>0?` ${mins%60}m`:""}
                </div>
              )}
              {pocesHores && <div style={{ fontSize:9, color:COLORS.yellow, marginTop:3 }}>Menys de 8h</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:16, marginTop:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:COLORS.green }}>● ≥8h</span>
        <span style={{ fontSize:11, color:COLORS.yellow }}>● &lt;8h</span>
        <span style={{ fontSize:11, color:COLORS.warm }}>● Sense fitxar</span>
        <span style={{ fontSize:11, color:COLORS.accent }}>● Avui</span>
      </div>
    </div>
  );
}

// ─── RESUM HORES DETALLAT ─────────────────────────────────────────────────────
function ResumHoresDetallat({ nom, mevesFulles }) {
  const [tab, setTab] = useState("setmana");

  const DIES_CA = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];
  const MESOS_CA = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];

  const parseH = (v) => parseFloat(String(v||0).replace(",",".")) || 0;

  const avui = new Date();
  const avuiStr = avui.toISOString().split("T")[0];
  const mesStr  = avuiStr.slice(0,7);
  const anyStr  = avuiStr.slice(0,4);

  const getLunes = (d) => {
    const r = new Date(typeof d==="string" ? d+"T00:00:00" : d);
    const day = r.getDay();
    r.setDate(r.getDate()-(day===0?6:day-1));
    return r.toISOString().split("T")[0];
  };
  const lunesStr = getLunes(avui);
  const diumenge = (() => { const r=new Date(lunesStr+"T00:00:00"); r.setDate(r.getDate()+6); return r.toISOString().split("T")[0]; })();

  const fullsSetmana = mevesFulles.filter(h=>h.data>=lunesStr&&h.data<=diumenge);
  const fullsMes     = mevesFulles.filter(h=>(h.data||"").startsWith(mesStr));
  const fullsAny     = mevesFulles.filter(h=>(h.data||"").startsWith(anyStr));

  const horesSetmana = fullsSetmana.reduce((s,h)=>s+parseH(h.horesOperari),0);
  const horesMes     = fullsMes.reduce((s,h)=>s+parseH(h.horesOperari),0);
  const horesAny     = fullsAny.reduce((s,h)=>s+parseH(h.horesOperari),0);

  const formatDia = (ds) => { const d=new Date(ds+"T00:00:00"); return `${DIES_CA[d.getDay()]} ${d.getDate()} ${MESOS_CA[d.getMonth()]}`; };
  const monthName = (ms) => { const [,m]=ms.split("-"); return `${MESOS_CA[parseInt(m)-1]} ${ms.slice(0,4)}`; };
  const weekEnd   = (ws) => { const r=new Date(ws+"T00:00:00"); r.setDate(r.getDate()+6); return r.toISOString().split("T")[0]; };

  const groupBy = (fulls, keyFn) => {
    const g={};
    fulls.forEach(h=>{ const k=keyFn(h); if(!g[k])g[k]=[]; g[k].push(h); });
    return Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0]));
  };

  const TABS = [{id:"setmana",label:"Setmana"},{id:"mes",label:"Mes"},{id:"any",label:"Any"}];
  const METRICS = [
    {label:"Aquesta setmana", h:horesSetmana},
    {label:"Aquest mes",      h:horesMes},
    {label:"Aquest any",      h:horesAny},
  ];

  return (
    <div className="card" style={{padding:20,marginBottom:20}}>
      <div style={{fontFamily:"'DM Serif Display',serif",fontSize:18,fontWeight:400,marginBottom:14}}>Resum d'hores</div>

      {/* MÈTRIQUES */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        {METRICS.map(m=>(
          <div key={m.label} style={{background:COLORS.bg,borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:COLORS.accent,lineHeight:1}}>{m.h}h</div>
            <div style={{fontSize:10,color:COLORS.muted,marginTop:5,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:500}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* PESTANYES */}
      <div style={{display:"flex",gap:4,marginBottom:16}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"5px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,
            fontFamily:"'DM Sans',sans-serif",transition:"all .15s",
            background:tab===t.id?COLORS.accent:"transparent",
            color:tab===t.id?"#fff":COLORS.muted
          }}>{t.label}</button>
        ))}
      </div>

      {/* SETMANA */}
      {tab==="setmana"&&(
        fullsSetmana.length===0
          ? <div style={{color:COLORS.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sense fulls aquesta setmana</div>
          : <>
              {groupBy(fullsSetmana,h=>h.data).map(([dia,fulls])=>{
                const totalDia=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={dia} style={{background:COLORS.bg,borderRadius:12,padding:14,marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontWeight:600,fontSize:13,color:COLORS.text}}>{formatDia(dia)}</span>
                      <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{totalDia}h</span>
                    </div>
                    {fulls.map(h=>(
                      <div key={h.id} style={{padding:"8px 0",borderTop:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500}}>{h.client||"Sense client"}</div>
                          <div style={{marginTop:2}}>
                            {h.numero&&<span style={{fontSize:11,color:COLORS.accent,marginRight:6}}>#{h.numero}</span>}
                            {h.descripcio&&<span style={{fontSize:11,color:COLORS.muted}}>{h.descripcio.substring(0,70)}{h.descripcio.length>70?"…":""}</span>}
                          </div>
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:COLORS.accent,whiteSpace:"nowrap"}}>{parseH(h.horesOperari)>0?`${parseH(h.horesOperari)}h`:"—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:12,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:12,color:COLORS.muted}}>Total setmana</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:COLORS.accent}}>{horesSetmana}h</span>
              </div>
            </>
      )}

      {/* MES */}
      {tab==="mes"&&(
        fullsMes.length===0
          ? <div style={{color:COLORS.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sense fulls aquest mes</div>
          : <>
              {groupBy(fullsMes,h=>getLunes(h.data)).map(([ws,fulls])=>{
                const we=weekEnd(ws);
                const totalS=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={ws} style={{background:COLORS.bg,borderRadius:12,padding:14,marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontWeight:600,fontSize:13}}>
                        {ws.slice(8)} – {we.slice(8)} {MESOS_CA[parseInt(mesStr.slice(5))-1]}
                      </span>
                      <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{totalS}h</span>
                    </div>
                    {fulls.sort((a,b)=>(a.data||"").localeCompare(b.data||"")).map(h=>(
                      <div key={h.id} style={{padding:"6px 0",borderTop:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <div style={{flex:1}}>
                          <span style={{fontSize:11,color:COLORS.muted,marginRight:6}}>{h.data?.slice(8)}·</span>
                          <span style={{fontSize:13,fontWeight:500}}>{h.client||"Sense client"}</span>
                          {h.numero&&<span style={{fontSize:11,color:COLORS.accent,marginLeft:6}}>#{h.numero}</span>}
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:COLORS.accent}}>{parseH(h.horesOperari)>0?`${parseH(h.horesOperari)}h`:"—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:12,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:12,color:COLORS.muted}}>Total mes</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:COLORS.accent}}>{horesMes}h</span>
              </div>
            </>
      )}

      {/* ANY */}
      {tab==="any"&&(
        fullsAny.length===0
          ? <div style={{color:COLORS.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sense fulls aquest any</div>
          : <>
              {groupBy(fullsAny,h=>(h.data||"").slice(0,7)).map(([ms,fulls])=>{
                const totalM=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={ms} style={{background:COLORS.bg,borderRadius:12,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontWeight:600,fontSize:13}}>{monthName(ms)}</span>
                      <span style={{fontSize:11,color:COLORS.muted,marginLeft:10}}>{fulls.length} full{fulls.length!==1?"s":""}</span>
                    </div>
                    <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20}}>{totalM}h</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:12,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:12,color:COLORS.muted}}>Total any</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:COLORS.accent}}>{horesAny}h</span>
              </div>
            </>
      )}
    </div>
  );
}

// ─── VISTA TRABAJADOR ─────────────────────────────────────────────────────────
function VistaTrabajador({ usuarioInfo, fichajes, encargos, usuarioUid, trabajadores, hojesTreball }) {
  const [fichando, setFichando] = useState(false);
  const [mensajeGPS, setMensajeGPS] = useState("");
  const [encargoSeleccionado, setEncargoSeleccionado] = useState(null);
  const [mostrarFormFull, setMostrarFormFull] = useState(false);
  const [editantFull, setEditantFull] = useState(null);
  const [paginaFulls, setPaginaFulls] = useState(0);
  const [materialsHistorial, setMaterialsHistorial] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db,"materialsHistorial"), snap => {
      setMaterialsHistorial(snap.docs.map(d=>d.data().nom).filter(Boolean));
    });
  }, []);

  useEffect(() => {
    // registrarTokenFCM desactivat fins HTTPS
  }, [usuarioUid]);

  const misFichajesHoy = fichajes.filter(f=>f.trabajador===usuarioInfo.nombre&&f.fecha===hoy).sort((a,b)=>(a.entrada||"").localeCompare(b.entrada||""));
  const misUltimos = fichajes.filter(f=>f.trabajador===usuarioInfo.nombre).slice(0,20);
  const misEncargos = encargos.filter(e=>{
    const asignados = Array.isArray(e.asignados)?e.asignados:(e.asignado?[e.asignado]:[]);
    if (!asignados.includes(usuarioInfo.nombre)) return false;
    if (e.estado==="Cancel·lat") return false;
    if (e.estado==="Completat"&&e.fechaCompletado&&e.fechaCompletado<hoy) return false;
    return true;
  });

  const ultimoTramo = misFichajesHoy[misFichajesHoy.length-1];
  const hayTramoAbierto = ultimoTramo!=null&&(!ultimoTramo.salida||ultimoTramo.salida==="");
  const totalHoyMins = misFichajesHoy.reduce((s,f)=>s+calcMinutos(f.entrada,f.salida),0);

  const ficharEntrada = async () => {
    setFichando(true); setMensajeGPS("Obtenint ubicació...");
    const ubicacion = await obtenerUbicacion();
    setMensajeGPS(ubicacion?"📍 Ubicació registrada":"⚠ No s'ha pogut obtenir ubicació");
    await addDoc(collection(db,"fichajes"),{ trabajador:usuarioInfo.nombre, fecha:hoy, entrada:horaActual(), salida:"", notas:"", tramo:misFichajesHoy.length+1, ubicacionEntrada:ubicacion });
    setFichando(false); setTimeout(()=>setMensajeGPS(""),3000);
  };

  const ficharSalida = async () => {
    if (!ultimoTramo) return;
    setFichando(true); setMensajeGPS("Obtenint ubicació...");
    const ubicacion = await obtenerUbicacion();
    setMensajeGPS(ubicacion?"📍 Ubicació registrada":"⚠ No s'ha pogut obtenir ubicació");
    await updateDoc(doc(db,"fichajes",ultimoTramo.id),{ salida:horaActual(), ubicacionSalida:ubicacion });
    setFichando(false); setTimeout(()=>setMensajeGPS(""),3000);
  };

  const porFecha = {};
  misUltimos.forEach(f=>{if(!porFecha[f.fecha])porFecha[f.fecha]=[];porFecha[f.fecha].push(f);});
  const colorEstado = {"Pendent":COLORS.yellow,"En curs":COLORS.accent,"Completat":COLORS.green};

  const seteDiesEnrere = new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0];
  const hojesVisibles = hojesTreball
    .filter(h => {
      const estat = h.estat || "pendent";
      if (estat === "completada" && (h.data || "") < seteDiesEnrere) return false;
      return true;
    })
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <>
    <style>{STYLE}</style>
    <div style={{ minHeight:"100vh", background:COLORS.bg }}>
      <div style={{ background:"#fff", borderBottom:`1px solid ${COLORS.border}`, padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
        <img src={NOUAIRE_LOGO} alt="Nouaire" style={{ height:28 }} />
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:30,height:30,borderRadius:"50%",background:COLORS.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:COLORS.accent }}>
            {usuarioInfo.nombre.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize:13, color:COLORS.muted, fontWeight:400 }}>{usuarioInfo.nombre}</span>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>signOut(auth)}>Sortir</button>
        </div>
      </div>
      <div style={{ padding:20, maxWidth:860, margin:"0 auto" }}>

        {/* RESUM SETMANAL */}
        <ResumSetmanal nom={usuarioInfo.nombre} fichajes={fichajes} />

        {/* RESUM HORES DETALLAT */}
        <ResumHoresDetallat nom={usuarioInfo.nombre} mevesFulles={hojesTreball} />

        {/* FICHAR */}
        <div className="card" style={{ padding:24, marginBottom:20, borderTop:`3px solid ${COLORS.accent}` }}>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, fontWeight:700 }}>{new Date().toLocaleDateString("ca-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
            {totalHoyMins>0&&<div style={{ fontSize:13, color:COLORS.accent, marginTop:4 }}>⏱ Total avui: {Math.floor(totalHoyMins/60)}h {totalHoyMins%60}m</div>}
          </div>
          {misFichajesHoy.length>0&&(
            <div style={{ marginBottom:16 }}>
              {misFichajesHoy.map((f,i)=>(
                <div key={f.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", background:COLORS.surface, borderRadius:8, marginBottom:6 }}>
                  <span style={{ fontSize:12, color:COLORS.muted, minWidth:55 }}>Tram {i+1}</span>
                  <span style={{ fontSize:13, color:COLORS.green }}>{f.entrada}</span>
                  <span style={{ color:COLORS.muted }}>→</span>
                  <span style={{ fontSize:13, color:f.salida?COLORS.warm:COLORS.muted }}>{f.salida||"en curs..."}</span>
                  {f.salida?<span style={{ fontSize:12, color:COLORS.accent, marginLeft:"auto" }}>{calcHoras(f.entrada,f.salida)}</span>:<span className="badge" style={{ background:"rgba(0,196,255,.15)", color:COLORS.accent, marginLeft:"auto" }}>Actiu</span>}
                  {f.ubicacionEntrada&&<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} />}
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            {!hayTramoAbierto&&<button className="btn btn-primary" style={{ padding:"14px 40px", fontSize:16, borderRadius:12 }} onClick={ficharEntrada} disabled={fichando}>{fichando?"Registrant...":misFichajesHoy.length===0?"🟢 Registrar entrada":"🟢 Inici tram tarda"}</button>}
            {hayTramoAbierto&&<button className="btn" style={{ background:COLORS.warm, color:"#fff", padding:"14px 40px", fontSize:16, borderRadius:12 }} onClick={ficharSalida} disabled={fichando}>{fichando?"Registrant...":"🔴 Registrar sortida"}</button>}
            {mensajeGPS&&<div style={{ fontSize:12, color:COLORS.muted }}>{mensajeGPS}</div>}
            {misFichajesHoy.length===0&&!fichando&&<div style={{ fontSize:12, color:COLORS.muted }}>📍 Es registrarà la teva ubicació en fitxar</div>}
          </div>
        </div>

        {/* ENCÀRRECS */}
        <div className="card" style={{ padding:20, marginBottom:20 }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, fontSize:18, marginBottom:16, color:COLORS.warm }}>🔧 Els meus encàrrecs ({misEncargos.length})</div>
          {misEncargos.length===0
            ? <div style={{ color:COLORS.muted, fontSize:13, textAlign:"center", padding:20 }}>Sense encàrrecs assignats avui</div>
            : misEncargos.map(e=>{
              const estadoColor = colorEstado[e.estado]||COLORS.muted;
              return (
                <div key={e.id} style={{ padding:"16px", marginBottom:10, borderRadius:12, background:e.estado==="Completat"?"rgba(0,230,118,.06)":COLORS.surface, border:`1px solid ${e.estado==="Completat"?COLORS.green+"44":COLORS.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                        <EstadoBadge estado={e.prioridad} />
                        <span className="badge" style={{ background:`${estadoColor}22`, color:estadoColor }}>{e.estado}</span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{e.titulo}</div>
                      <div style={{ fontSize:12, color:COLORS.muted, marginBottom:4 }}>{e.cliente}</div>
                      {(e.direccion||e.localidad)&&<div style={{ marginBottom:4 }}><DireccionMaps direccion={e.direccion} localidad={e.localidad} /></div>}
                      {e.telefono&&<a href={`tel:${e.telefono}`} style={{ fontSize:12, color:COLORS.accent, textDecoration:"none", display:"block", marginBottom:4 }}>📱 {e.telefono}</a>}
                      {e.notasTrabajador&&<div style={{ fontSize:12, color:COLORS.yellow, marginTop:6, background:"rgba(255,214,0,.08)", padding:"6px 10px", borderRadius:6 }}>⚠ {e.notasTrabajador}</div>}
                      {e.fotos?.length>0&&<div style={{ fontSize:11, color:COLORS.green, marginTop:4 }}>📷 {e.fotos.length} foto{e.fotos.length!==1?"s":""}</div>}
                    </div>
                    <button onClick={()=>setEncargoSeleccionado(e)} style={{ padding:"10px 16px", borderRadius:10, cursor:"pointer", border:"none", background:e.estado==="Completat"?COLORS.green:COLORS.accent, color:"#000", fontSize:13, fontWeight:700, fontFamily:"Inter", whiteSpace:"nowrap", flexShrink:0 }}>
                      {e.estado==="Completat"?"✅ Veure":"✏ Gestionar"}
                    </button>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* FULLS DE TREBALL DEL TREBALLADOR */}
        <div className="card" style={{ padding:20, marginBottom:20, borderTop:`3px solid ${COLORS.green}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, fontSize:18, color:COLORS.green }}>📋 Els meus fulls de treball ({hojesTreball.length})</div>
            <button className="btn btn-primary" style={{ fontSize:13 }} onClick={()=>{ setEditantFull(null); setMostrarFormFull(true); }}>
              + Crear full de treball
            </button>
          </div>
          {hojesVisibles.length === 0
            ? <div style={{ color:COLORS.muted, fontSize:13, textAlign:"center", padding:16 }}>Encara no tens cap full de treball</div>
            : (() => {
                const totalPagines = Math.ceil(hojesVisibles.length / 10);
                const pagina = Math.min(paginaFulls, totalPagines - 1);
                const fullsPagina = hojesVisibles.slice(pagina * 10, pagina * 10 + 10);
                return (<>
                  {fullsPagina.map(h=>(
                    <div key={h.id} style={{ padding:"12px 14px", marginBottom:8, borderRadius:10, background:COLORS.surface, border:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                          <EstadoBadge estado={h.estat||"pendent"} />
                          {h.numero&&<span style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, color:COLORS.accent, fontSize:14 }}>#{h.numero}</span>}
                          {h.signatura&&<span className="badge" style={{ background:"rgba(0,230,118,.15)", color:COLORS.green }}>✅ Signat</span>}
                        </div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{h.client||"Sense client"}</div>
                        <div style={{ fontSize:11, color:COLORS.muted }}>{h.data}{h.poblacio?` · ${h.poblacio}`:""}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                        {(h.estat==="esborrany") && (
                          <button className="btn btn-primary" style={{ fontSize:12, padding:"6px 14px" }}
                            onClick={()=>updateDoc(doc(db,"hojesTreball",h.id),{estat:"pendent"})}>
                            📤 Enviar a l'administrador
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize:12, padding:"6px 14px" }} onClick={()=>{ setEditantFull(h); setMostrarFormFull(true); }}>
                          ✏ Editar
                        </button>
                      </div>
                    </div>
                  ))}
                  {totalPagines > 1 && (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, gap:8 }}>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:"6px 14px" }} onClick={()=>setPaginaFulls(p=>Math.max(0,p-1))} disabled={pagina===0}>← Anterior</button>
                      <span style={{ fontSize:12, color:COLORS.muted }}>Pàgina {pagina+1} de {totalPagines}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:"6px 14px" }} onClick={()=>setPaginaFulls(p=>Math.min(totalPagines-1,p+1))} disabled={pagina===totalPagines-1}>Següent →</button>
                    </div>
                  )}
                </>);
              })()
          }
        </div>

        {/* HISTORIAL */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontWeight:700, fontSize:16, marginBottom:16, color:COLORS.accent }}>⏱ Els meus últims dies</div>
          {Object.keys(porFecha).length===0?<div style={{ color:COLORS.muted, fontSize:13 }}>Sense registres</div>
            :Object.entries(porFecha).slice(0,5).map(([fecha,tramos])=>{
              const totalDia=tramos.reduce((s,f)=>s+calcMinutos(f.entrada,f.salida),0);
              return (
                <div key={fecha} style={{ padding:"8px 0", borderBottom:`1px solid ${COLORS.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{fecha}</span>
                    <span style={{ fontSize:12, color:COLORS.accent }}>{Math.floor(totalDia/60)}h {totalDia%60}m</span>
                  </div>
                  {tramos.sort((a,b)=>(a.entrada||"").localeCompare(b.entrada||"")).map((f,i)=>(
                    <div key={f.id} style={{ fontSize:11, color:COLORS.muted, paddingLeft:8 }}>
                      Tram {i+1}: {f.entrada} → {f.salida||"—"} {f.salida?`(${calcHoras(f.entrada,f.salida)})` : ""}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>

      {encargoSeleccionado&&<GestionarEncargo encargo={encargoSeleccionado} onClose={()=>setEncargoSeleccionado(null)} />}

      {/* MODAL FULL DE TREBALL */}
      {mostrarFormFull&&(
        <Modal title={editantFull?`Editar full #${editantFull.numero||""}`:"Nou full de treball"} onClose={()=>setMostrarFormFull(false)} extraWide>
          <FormHojaTreball
            hoja={editantFull}
            onClose={()=>setMostrarFormFull(false)}
            trabajadores={trabajadores?.filter(t => t.estado === "Actiu") || []}
            encargos={encargos}
            materialsHistorial={materialsHistorial}
            isWorker={usuarioInfo.nombre}
          />
        </Modal>
      )}
    </div>
    </>
  );
}

// ─── GESTIÓ USUARIS ───────────────────────────────────────────────────────────
function GestionUsuarios({ trabajadores }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", nombre:"", rol:"trabajador", seccionsPermeses:[] });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [confirmarEliminarUsuari, setConfirmarEliminarUsuari] = useState(null);
  const [editantRol, setEditantRol] = useState(null);
  const [rolForm, setRolForm] = useState({ rol:"", seccionsPermeses:[] });
  const [guardandoRol, setGuardandoRol] = useState(false);

  const editarRol = async () => {
    setGuardandoRol(true);
    const dades = { rol: rolForm.rol };
    if (rolForm.rol === "secretaria") dades.seccionsPermeses = rolForm.seccionsPermeses;
    else dades.seccionsPermeses = [];
    await updateDoc(doc(db, "usuarios", editantRol.id), dades);
    setGuardandoRol(false);
    setEditantRol(null);
  };

  useEffect(()=>{ return onSnapshot(collection(db,"usuarios"),snap=>setUsuarios(snap.docs.map(d=>({id:d.id,...d.data()})))); },[]);

  const crearUsuario = async () => {
    if (!form.email||!form.password||!form.nombre) return;
    setGuardando(true); setError("");

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
    } catch(e) {
      setError(
        e.code === "auth/email-already-in-use" ? "Aquest email ja existeix" :
        e.code === "auth/weak-password" ? "La contrasenya ha de tenir mínim 6 caràcters" :
        `Error d'autenticació: ${e.code}`
      );
      setGuardando(false);
      return;
    }

    const rol = form.rol.trim().toLowerCase();
    const dades = { email: form.email, nombre: form.nombre, rol };
    if (rol === "secretaria") dades.seccionsPermeses = form.seccionsPermeses;

    for (let intent = 1; intent <= 3; intent++) {
      try {
        await setDoc(doc(db, "usuarios", cred.user.uid), dades);
        setModal(false);
        setForm({ email:"", password:"", nombre:"", rol:"trabajador", seccionsPermeses:[] });
        setGuardando(false);
        return;
      } catch(_) {
        if (intent < 3) await new Promise(r => setTimeout(r, 500 * intent));
      }
    }

    try { await deleteUser(cred.user); } catch(_) {}
    setError("Usuari creat a Auth però no s'ha pogut desar a Firestore (3 intents fallits). El compte ha estat eliminat. Contacta amb suport.");
    setGuardando(false);
  };

  return (
    <div>
      <Header title="Gestió d'Usuaris" onAdd={()=>setModal(true)} addLabel="+ Crear usuari" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {usuarios.map(u=>(
          <div key={u.id} className="card" style={{ padding:20, borderLeft:`3px solid ${u.rol==="admin"?COLORS.yellow:u.rol==="secretaria"?COLORS.warm:COLORS.accent}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:28 }}>{u.rol==="admin"?"👑":u.rol==="secretaria"?"📋":u.rol==="encarregat"?"🔑":"👷"}</div>
              <span className="badge" style={{ background:u.rol==="admin"?"rgba(255,214,0,.2)":u.rol==="secretaria"?"rgba(255,107,53,.2)":u.rol==="encarregat"?"rgba(45,106,79,.15)":"rgba(0,196,255,.15)", color:u.rol==="admin"?COLORS.yellow:u.rol==="secretaria"?COLORS.warm:u.rol==="encarregat"?COLORS.accent:COLORS.accent }}>{u.rol==="admin"?"Administrador":u.rol==="secretaria"?"Secretaria":u.rol==="encarregat"?"Encarregat":"Treballador"}</span>
            </div>
            <div style={{ fontWeight:700, fontSize:15 }}>{u.nombre}</div>
            <div style={{ fontSize:12, color:COLORS.muted, marginTop:4 }}>{u.email}</div>
            <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>{ setEditantRol(u); setRolForm({rol:u.rol||"trabajador",seccionsPermeses:u.seccionsPermeses||[]}); }}>✏ Editar rol</button>
              <button className="btn btn-danger" onClick={()=>setConfirmarEliminarUsuari(u)}>🗑 Eliminar accés</button>
            </div>
          </div>
        ))}
      </div>

      {editantRol&&(
        <Modal title={`Editar rol — ${editantRol.nombre}`} onClose={()=>setEditantRol(null)}>
          <div style={{display:"grid",gap:16}}>
            <div style={{padding:"12px 14px",background:COLORS.bg,borderRadius:10}}>
              <div style={{fontSize:14,fontWeight:600}}>{editantRol.nombre}</div>
              <div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{editantRol.email}</div>
            </div>
            <div><label>Rol</label>
              <select className="select" style={{width:"100%"}} value={rolForm.rol} onChange={e=>setRolForm({rol:e.target.value,seccionsPermeses:[]})}>
                <option value="trabajador">Treballador</option>
                <option value="encarregat">Encarregat</option>
                <option value="secretaria">Secretaria</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {rolForm.rol==="secretaria"&&(
              <div>
                <label>Seccions permeses</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                  {NAV_ITEMS.filter(i=>i.id!=="usuarios").map(item=>{
                    const sel=(rolForm.seccionsPermeses||[]).includes(item.id);
                    return(
                      <label key={item.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 10px",borderRadius:8,background:sel?COLORS.accentGlow:COLORS.surface,border:`1px solid ${sel?COLORS.accent:COLORS.border}`,fontSize:12,fontWeight:500,textTransform:"none",letterSpacing:0}}>
                        <input type="checkbox" checked={sel} onChange={()=>{
                          const prev=rolForm.seccionsPermeses||[];
                          setRolForm({...rolForm,seccionsPermeses:sel?prev.filter(x=>x!==item.id):[...prev,item.id]});
                        }} style={{accentColor:COLORS.accent}} />
                        {item.icon} {item.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setEditantRol(null)}>Cancel·lar</button>
              <button className="btn btn-primary" onClick={editarRol} disabled={guardandoRol}>{guardandoRol?"Guardant...":"Guardar canvis"}</button>
            </div>
          </div>
        </Modal>
      )}
      {confirmarEliminarUsuari&&<Modal title="Eliminar accés?" onClose={()=>setConfirmarEliminarUsuari(null)}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminarUsuari.nombre}</div>
          <div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>{confirmarEliminarUsuari.email} — {confirmarEliminarUsuari.rol==="admin"?"Administrador":confirmarEliminarUsuari.rol==="secretaria"?"Secretaria":"Treballador"}</div>
          <div style={{fontSize:13,color:COLORS.muted,marginTop:8}}>Eliminaràs l'accés. No es pot desfer.</div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={()=>setConfirmarEliminarUsuari(null)}>Cancel·lar</button>
          <button className="btn" style={{background:COLORS.warm,color:"#fff"}} onClick={()=>{deleteDoc(doc(db,"usuarios",confirmarEliminarUsuari.id));setConfirmarEliminarUsuari(null);}}>Sí, eliminar</button>
        </div>
      </Modal>}
      {modal&&<Modal title="Crear usuari" onClose={()=>setModal(false)}>
        <div style={{ display:"grid", gap:14 }}>
          <div><label>Treballador</label>
            <select className="select" style={{ width:"100%" }} value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}>
              <option value="">Selecciona treballador</option>
              {trabajadores.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>
          <div><label>Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label>Contrasenya</label><input className="input" type="password" placeholder="Mínim 6 caràcters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          <div><label>Rol</label>
            <select className="select" style={{ width:"100%" }} value={form.rol} onChange={e=>setForm({...form,rol:e.target.value,seccionsPermeses:[]})}>
              <option value="trabajador">Treballador</option>
              <option value="encarregat">Encarregat</option>
              <option value="secretaria">Secretaria</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {form.rol==="secretaria"&&(
            <div>
              <label>Seccions permeses</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:6 }}>
                {NAV_ITEMS.filter(i=>i.id!=="usuarios").map(item=>{
                  const sel=(form.seccionsPermeses||[]).includes(item.id);
                  return (
                    <label key={item.id} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 10px", borderRadius:8, background:sel?COLORS.accentGlow:COLORS.surface, border:`1px solid ${sel?COLORS.accent:COLORS.border}`, fontSize:12, fontWeight:500, textTransform:"none", letterSpacing:0 }}>
                      <input type="checkbox" checked={sel} onChange={()=>{
                        const prev=form.seccionsPermeses||[];
                        setForm({...form,seccionsPermeses:sel?prev.filter(x=>x!==item.id):[...prev,item.id]});
                      }} style={{ accentColor:COLORS.accent }} />
                      {item.icon} {item.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {error&&<div style={{ fontSize:13, color:COLORS.warm }}>{error}</div>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={crearUsuario} disabled={guardando}>{guardando?"Creant...":"Crear usuari"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── TREBALLADORS ─────────────────────────────────────────────────────────────
function ResumHoresTreballador({ treballador, hojesTreball }) {
  const [tab, setTab] = useState("setmana");
  const nom = treballador.nombre;

  const DIES_CA = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];
  const MESOS_CA = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];

  const parseH = (v) => parseFloat(String(v||0).replace(",",".")) || 0;

  const avui = new Date();
  const avuiStr = avui.toISOString().split("T")[0];
  const mesStr  = avuiStr.slice(0,7);
  const anyStr  = avuiStr.slice(0,4);

  const getLunes = (d) => {
    const r = new Date(typeof d==="string" ? d+"T00:00:00" : d);
    const day = r.getDay();
    r.setDate(r.getDate()-(day===0?6:day-1));
    return r.toISOString().split("T")[0];
  };
  const lunesStr = getLunes(avui);
  const diumenge = (() => { const r=new Date(lunesStr+"T00:00:00"); r.setDate(r.getDate()+6); return r.toISOString().split("T")[0]; })();

  const mevesFulles = hojesTreball.filter(h => (Array.isArray(h.operaris)?h.operaris:[]).includes(nom));

  const fullsSetmana = mevesFulles.filter(h=>h.data>=lunesStr&&h.data<=diumenge);
  const fullsMes     = mevesFulles.filter(h=>(h.data||"").startsWith(mesStr));
  const fullsAny     = mevesFulles.filter(h=>(h.data||"").startsWith(anyStr));

  const horesSetmana = fullsSetmana.reduce((s,h)=>s+parseH(h.horesOperari),0);
  const horesMes     = fullsMes.reduce((s,h)=>s+parseH(h.horesOperari),0);
  const horesAny     = fullsAny.reduce((s,h)=>s+parseH(h.horesOperari),0);

  const formatDia = (ds) => { const d=new Date(ds+"T00:00:00"); return `${DIES_CA[d.getDay()]} ${d.getDate()} ${MESOS_CA[d.getMonth()]}`; };
  const monthName = (ms) => { const [,m]=ms.split("-"); return `${MESOS_CA[parseInt(m)-1]} ${ms.slice(0,4)}`; };
  const weekEnd   = (ws) => { const r=new Date(ws+"T00:00:00"); r.setDate(r.getDate()+6); return r.toISOString().split("T")[0]; };

  const groupBy = (fulls, keyFn) => {
    const g={};
    fulls.forEach(h=>{ const k=keyFn(h); if(!g[k])g[k]=[]; g[k].push(h); });
    return Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0]));
  };

  const TABS = [{id:"setmana",label:"Setmana"},{id:"mes",label:"Mes"},{id:"any",label:"Any"}];
  const METRICS = [
    {label:"Aquesta setmana", h:horesSetmana},
    {label:"Aquest mes",      h:horesMes},
    {label:"Aquest any",      h:horesAny},
  ];

  return (
    <div style={{marginTop:14,borderTop:`1px solid ${COLORS.border}`,paddingTop:14}}>
      {/* MÈTRIQUES */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {METRICS.map(m=>(
          <div key={m.label} style={{background:COLORS.bg,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:COLORS.accent,lineHeight:1}}>{m.h}h</div>
            <div style={{fontSize:9,color:COLORS.muted,marginTop:4,textTransform:"uppercase",letterSpacing:"0.4px",fontWeight:500}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* PESTANYES */}
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,
            fontFamily:"'DM Sans',sans-serif",transition:"all .15s",
            background:tab===t.id?COLORS.accent:"transparent",
            color:tab===t.id?"#fff":COLORS.muted
          }}>{t.label}</button>
        ))}
      </div>

      {/* SETMANA */}
      {tab==="setmana"&&(
        fullsSetmana.length===0
          ? <div style={{color:COLORS.muted,fontSize:12,textAlign:"center",padding:"12px 0"}}>Sense fulls aquesta setmana</div>
          : <>
              {groupBy(fullsSetmana,h=>h.data).map(([dia,fulls])=>{
                const totalDia=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={dia} style={{background:COLORS.bg,borderRadius:10,padding:10,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontWeight:600,fontSize:12,color:COLORS.text}}>{formatDia(dia)}</span>
                      <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>{totalDia}h</span>
                    </div>
                    {fulls.map(h=>(
                      <div key={h.id} style={{padding:"5px 0",borderTop:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:500}}>{h.client||"Sense client"}</div>
                          <div style={{marginTop:1}}>
                            {h.numero&&<span style={{fontSize:10,color:COLORS.accent,marginRight:5}}>#{h.numero}</span>}
                            {h.descripcio&&<span style={{fontSize:10,color:COLORS.muted}}>{h.descripcio.substring(0,50)}{h.descripcio.length>50?"…":""}</span>}
                          </div>
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:COLORS.accent,whiteSpace:"nowrap"}}>{parseH(h.horesOperari)>0?`${parseH(h.horesOperari)}h`:"—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:8,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:11,color:COLORS.muted}}>Total setmana</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:COLORS.accent}}>{horesSetmana}h</span>
              </div>
            </>
      )}

      {/* MES */}
      {tab==="mes"&&(
        fullsMes.length===0
          ? <div style={{color:COLORS.muted,fontSize:12,textAlign:"center",padding:"12px 0"}}>Sense fulls aquest mes</div>
          : <>
              {groupBy(fullsMes,h=>getLunes(h.data)).map(([ws,fulls])=>{
                const we=weekEnd(ws);
                const totalS=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={ws} style={{background:COLORS.bg,borderRadius:10,padding:10,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontWeight:600,fontSize:12}}>
                        {ws.slice(8)} – {we.slice(8)} {MESOS_CA[parseInt(mesStr.slice(5))-1]}
                      </span>
                      <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>{totalS}h</span>
                    </div>
                    {fulls.sort((a,b)=>(a.data||"").localeCompare(b.data||"")).map(h=>(
                      <div key={h.id} style={{padding:"4px 0",borderTop:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                        <div style={{flex:1}}>
                          <span style={{fontSize:10,color:COLORS.muted,marginRight:5}}>{h.data?.slice(8)}·</span>
                          <span style={{fontSize:12,fontWeight:500}}>{h.client||"Sense client"}</span>
                          {h.numero&&<span style={{fontSize:10,color:COLORS.accent,marginLeft:5}}>#{h.numero}</span>}
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:COLORS.accent}}>{parseH(h.horesOperari)>0?`${parseH(h.horesOperari)}h`:"—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:8,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:11,color:COLORS.muted}}>Total mes</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:COLORS.accent}}>{horesMes}h</span>
              </div>
            </>
      )}

      {/* ANY */}
      {tab==="any"&&(
        fullsAny.length===0
          ? <div style={{color:COLORS.muted,fontSize:12,textAlign:"center",padding:"12px 0"}}>Sense fulls aquest any</div>
          : <>
              {groupBy(fullsAny,h=>(h.data||"").slice(0,7)).map(([ms,fulls])=>{
                const totalM=fulls.reduce((s,h)=>s+parseH(h.horesOperari),0);
                return (
                  <div key={ms} style={{background:COLORS.bg,borderRadius:10,padding:10,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontWeight:600,fontSize:12}}>{monthName(ms)}</span>
                      <span style={{fontSize:10,color:COLORS.muted,marginLeft:8}}>{fulls.length} full{fulls.length!==1?"s":""}</span>
                    </div>
                    <span style={{background:"#DCFCE7",color:"#16A34A",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{totalM}h</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:6,paddingTop:8,borderTop:`1px solid ${COLORS.border}`}}>
                <span style={{fontSize:11,color:COLORS.muted}}>Total any</span>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:COLORS.accent}}>{horesAny}h</span>
              </div>
            </>
      )}
    </div>
  );
}

function Trabajadores({ trabajadores, cargandoT, hojesTreball=[], podeEliminar=true }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [resumObert, setResumObert] = useState(null);
  const [form, setForm] = useState({ nombre:"", telefono:"", email:"", cargo:"Tècnic", estado:"Actiu", notas:"" });

  const abrirNuevo=()=>{setEditando(null);setForm({nombre:"",telefono:"",email:"",cargo:"Tècnic",estado:"Actiu",notas:""});setModal(true);};
  const abrirEditar=(t)=>{setEditando(t);setForm({nombre:t.nombre,telefono:t.telefono||"",email:t.email||"",cargo:t.cargo||"Tècnic",estado:t.estado||"Actiu",notas:t.notas||""});setModal(true);};
  const guardar=async()=>{ if(!form.nombre)return;setGuardando(true); if(editando)await updateDoc(doc(db,"trabajadores",editando.id),form); else await addDoc(collection(db,"trabajadores"),form); setGuardando(false);setModal(false); };
  const eliminar=async(id)=>{await deleteDoc(doc(db,"trabajadores",id));setConfirmarEliminar(null);};
  const activos=trabajadores.filter(t=>t.estado!=="Inactiu");
  const inactivos=trabajadores.filter(t=>t.estado==="Inactiu");

  return (
    <div>
      <Header title="Treballadors" onAdd={abrirNuevo} addLabel="+ Afegir treballador" />
      {cargandoT?<div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Carregant...</div>:trabajadores.length===0?<div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Afegeix el primer treballador</div>:(
        <>
          <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Actius ({activos.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:28}}>
            {activos.map(t=>(
              <div key={t.id} className="card" style={{padding:20,borderLeft:`3px solid ${COLORS.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{width:40,height:40,borderRadius:"50%",background:COLORS.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:COLORS.accent,marginBottom:8}}>
                      {t.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div style={{fontWeight:600,fontSize:15}}>{t.nombre}</div>
                    <div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{t.cargo}</div>
                  </div>
                  <EstadoBadge estado={t.estado||"Actiu"} />
                </div>
                {t.telefono&&<div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>📱 {t.telefono}</div>}
                {t.email&&<div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>✉ {t.email}</div>}
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>abrirEditar(t)}>✏ Editar</button>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px",color:resumObert===t.id?COLORS.accent:COLORS.muted,borderColor:resumObert===t.id?COLORS.accent:COLORS.border}} onClick={()=>setResumObert(resumObert===t.id?null:t.id)}>
                    {resumObert===t.id?"▲ Hores":"▼ Hores"}
                  </button>
                  {podeEliminar&&<button className="btn btn-danger" onClick={()=>setConfirmarEliminar(t)}>🗑</button>}
                </div>
                {resumObert===t.id && <ResumHoresTreballador treballador={t} hojesTreball={hojesTreball} />}
              </div>
            ))}
          </div>
          {inactivos.length>0&&<>
            <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Inactius ({inactivos.length})</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {inactivos.map(t=>(
                <div key={t.id} className="card" style={{padding:20,opacity:0.6}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{t.nombre}</div>
                  <div style={{fontSize:12,color:COLORS.muted}}>{t.cargo}</div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>abrirEditar(t)}>✏ Editar</button>
                    {podeEliminar&&<button className="btn btn-danger" onClick={()=>setConfirmarEliminar(t)}>🗑</button>}
                  </div>
                </div>
              ))}
            </div>
          </>}
        </>
      )}
      {modal&&<Modal title={editando?"Editar Treballador":"Nou Treballador"} onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Nom *</label><input className="input" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Càrrec</label><select className="select" style={{width:"100%"}} value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})}>{["Tècnic","Oficial","Ajudant","Cap d'obra","Administratiu","Altre"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Estat</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option>Actiu</option><option>Inactiu</option></select></div>
          </div>
          <div><label>Telèfon</label><input className="input" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
          <div><label>Email</label><input className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label>Notes</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardant...":editando?"Guardar canvis":"Afegir"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="Eliminar?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.nombre}</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancel·lar</button><button className="btn" style={{background:COLORS.warm,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
    </div>
  );
}

// ─── FICHAJES ────────────────────────────────────────────────────────────────
function Fichajes({ trabajadores, fichajes }) {
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTrabajador, setFiltroTrabajador] = useState("Tots");
  const [modalPDF, setModalPDF] = useState(false);
  const [trabajadorPDF, setTrabajadorPDF] = useState("");
  const [vistaAgrupada, setVistaAgrupada] = useState(true);
  const nombresActivos = trabajadores.filter(t=>t.estado!=="Inactiu").map(t=>t.nombre);
  const todosNombres = trabajadores.map(t=>t.nombre);
  const [form, setForm] = useState({ trabajador:nombresActivos[0]||"", fecha:new Date().toISOString().split("T")[0], entrada:"08:00", salida:"", notas:"" });

  useEffect(()=>{ if(nombresActivos.length>0&&!form.trabajador)setForm(f=>({...f,trabajador:nombresActivos[0]})); },[trabajadores]);

  const guardar=async()=>{ if(!form.trabajador||!form.fecha||!form.entrada)return; setGuardando(true); await addDoc(collection(db,"fichajes"),form); setGuardando(false); setModal(false); };
  const eliminar=async(id)=>{await deleteDoc(doc(db,"fichajes",id));setConfirmarEliminar(null);};
  const registrarSalida=async(f)=>{await updateDoc(doc(db,"fichajes",f.id),{salida:horaActual()});};

  const lista=fichajes.filter(f=>filtroTrabajador==="Tots"||f.trabajador===filtroTrabajador).filter(f=>!filtroFecha||f.fecha===filtroFecha);
  const horasTotal=lista.reduce((s,f)=>s+calcMinutos(f.entrada,f.salida),0);
  const grupos={};
  lista.forEach(f=>{const clave=`${f.trabajador}__${f.fecha}`;if(!grupos[clave])grupos[clave]={trabajador:f.trabajador,fecha:f.fecha,tramos:[],totalMins:0};grupos[clave].tramos.push(f);grupos[clave].totalMins+=calcMinutos(f.entrada,f.salida);});
  const listaAgrupada=Object.values(grupos).sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.trabajador.localeCompare(b.trabajador));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24,fontWeight:700}}>Control Horari</h2>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={()=>setVistaAgrupada(!vistaAgrupada)} style={{fontSize:12}}>{vistaAgrupada?"Vista detallada":"Vista agrupada"}</button>
          <button className="btn btn-ghost" onClick={()=>{setTrabajadorPDF(todosNombres[0]||"");setModalPDF(true);}}>📄 PDF 4 anys</button>
          <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar fitxatge</button>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <select className="select" value={filtroTrabajador} onChange={e=>setFiltroTrabajador(e.target.value)}>
          <option value="Tots">Tots els treballadors</option>
          {nombresActivos.map(t=><option key={t}>{t}</option>)}
        </select>
        <input className="input" type="date" style={{width:"auto"}} value={filtroFecha} onChange={e=>setFiltroFecha(e.target.value)} />
        {filtroFecha&&<button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setFiltroFecha("")}>✕ Netejar</button>}
        <span style={{marginLeft:"auto",fontFamily:"'DM Serif Display',serif",fontSize:14,fontWeight:700,color:COLORS.accent}}>Total: {Math.floor(horasTotal/60)}h {horasTotal%60}m</span>
      </div>
      {vistaAgrupada?(
        <div style={{display:"grid",gap:12}}>
          {listaAgrupada.length===0?<div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>No hi ha fitxatges</div>
            :listaAgrupada.map(g=>(
              <div key={`${g.trabajador}__${g.fecha}`} className="card" style={{padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div><span style={{fontWeight:600,fontSize:14}}>{g.trabajador}</span><span style={{fontSize:13,color:COLORS.muted,marginLeft:12}}>{g.fecha}</span></div>
                  <span style={{fontFamily:"'DM Serif Display',serif",fontWeight:700,fontSize:16,color:COLORS.accent}}>{Math.floor(g.totalMins/60)}h {g.totalMins%60}m total</span>
                </div>
                <div style={{display:"grid",gap:6}}>
                  {g.tramos.sort((a,b)=>(a.entrada||"").localeCompare(b.entrada||"")).map((f,i)=>(
                    <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px",background:COLORS.surface,borderRadius:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,color:COLORS.muted,minWidth:55}}>Tram {i+1}</span>
                      <span style={{fontSize:13,color:COLORS.green}}>{f.entrada}</span>
                      <span style={{color:COLORS.muted}}>→</span>
                      <span style={{fontSize:13,color:f.salida?COLORS.warm:COLORS.muted}}>{f.salida||<button className="btn btn-primary" style={{fontSize:11,padding:"2px 8px"}} onClick={()=>registrarSalida(f)}>Registrar sortida</button>}</span>
                      {f.salida&&<span style={{fontSize:12,color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</span>}
                      {f.ubicacionEntrada&&<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} precision={f.ubicacionEntrada.precision} />}
                      <button className="btn btn-danger" style={{marginLeft:"auto"}} onClick={()=>setConfirmarEliminar(f)}>🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ):(
        <div className="card" style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Treballador","Data","Entrada","GPS","Sortida","Hores",""].map((h,i)=><th key={i} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{lista.map(f=>(
              <tr key={f.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
                <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{f.trabajador}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{f.fecha}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.green}}>{f.entrada}</td>
                <td style={{padding:"12px 16px"}}>{f.ubicacionEntrada?<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} precision={f.ubicacionEntrada.precision} />:<span style={{fontSize:11,color:COLORS.muted}}>—</span>}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:f.salida?COLORS.warm:COLORS.muted}}>{f.salida||<button className="btn btn-primary" style={{fontSize:11,padding:"3px 10px"}} onClick={()=>registrarSalida(f)}>Registrar sortida</button>}</td>
                <td style={{padding:"12px 16px",fontSize:13,fontFamily:"'DM Serif Display',serif",fontWeight:600,color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</td>
                <td style={{padding:"12px 16px"}}><button className="btn btn-danger" onClick={()=>setConfirmarEliminar(f)}>🗑</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {modalPDF&&<Modal title="📄 PDF — Últims 4 anys" onClose={()=>setModalPDF(false)}>
        <div style={{display:"grid",gap:16}}>
          <div><label>Treballador</label><select className="select" style={{width:"100%"}} value={trabajadorPDF} onChange={e=>setTrabajadorPDF(e.target.value)}>{todosNombres.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModalPDF(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={()=>{generarPDFHorario(trabajadorPDF,fichajes);setModalPDF(false);}}>📥 Descarregar</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="Eliminar tram?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.trabajador} — {confirmarEliminar.fecha}</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancel·lar</button><button className="btn" style={{background:COLORS.warm,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
      {modal&&<Modal title="Registrar Fitxatge" onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:16}}>
          <div><label>Treballador</label><select className="select" style={{width:"100%"}} value={form.trabajador} onChange={e=>setForm({...form,trabajador:e.target.value})}>{nombresActivos.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Data</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
            <div><label>Entrada</label><input className="input" type="time" value={form.entrada} onChange={e=>setForm({...form,entrada:e.target.value})} /></div>
          </div>
          <div><label>Sortida (opcional)</label><input className="input" type="time" value={form.salida} onChange={e=>setForm({...form,salida:e.target.value})} /></div>
          <div><label>Notes</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardant...":"Guardar"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── ENCÀRRECS ───────────────────────────────────────────────────────────────
function Encargos({ trabajadores, podeEliminar=true }) {
  const [encargos, setEncargos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [verDetalle, setVerDetalle] = useState(null);
  const [editando, setEditando] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [lightboxAdmin, setLightboxAdmin] = useState(null);
  const [vistaArchivados, setVistaArchivados] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("Tots");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroTrabajador, setFiltroTrabajador] = useState("");
  const [filtroLocalidad, setFiltroLocalidad] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const nombresActivos = trabajadores.filter(t=>t.estado!=="Inactiu").map(t=>t.nombre);
  const emptyForm = { titulo:"", cliente:"", asignados:[], prioridad:"Mitjana", estado:"Pendent", fecha:"", notas:"", localidad:"", direccion:"", telefono:"", archivado:false };
  const [form, setForm] = useState(emptyForm);

  useEffect(()=>{ const q=query(collection(db,"encargos"),orderBy("fecha","desc")); return onSnapshot(q,snap=>{setEncargos(snap.docs.map(d=>({id:d.id,...d.data()})));setCargando(false);}); },[]);

  const limpiarFiltros=()=>{setFiltroEstado("Tots");setFiltroFechaDesde("");setFiltroFechaHasta("");setFiltroTrabajador("");setFiltroLocalidad("");setFiltroBusqueda("");};
  const hayFiltros=filtroEstado!=="Tots"||filtroFechaDesde||filtroFechaHasta||filtroTrabajador||filtroLocalidad||filtroBusqueda;

  const lista=encargos
    .filter(e=>vistaArchivados?e.archivado:!e.archivado)
    .filter(e=>filtroEstado==="Tots"||e.estado===filtroEstado)
    .filter(e=>!filtroFechaDesde||e.fecha>=filtroFechaDesde)
    .filter(e=>!filtroFechaHasta||e.fecha<=filtroFechaHasta)
    .filter(e=>!filtroTrabajador||(Array.isArray(e.asignados)?e.asignados.includes(filtroTrabajador):e.asignado===filtroTrabajador))
    .filter(e=>!filtroLocalidad||(e.localidad||"").toLowerCase().includes(filtroLocalidad.toLowerCase()))
    .filter(e=>!filtroBusqueda||e.titulo?.toLowerCase().includes(filtroBusqueda.toLowerCase())||e.cliente?.toLowerCase().includes(filtroBusqueda.toLowerCase()));

  const abrirNuevo=()=>{setEditando(null);setForm(emptyForm);setModal(true);};
  const abrirEditar=(e)=>{ setEditando(e); const asignados=Array.isArray(e.asignados)?e.asignados:(e.asignado?[e.asignado]:[]); const toStr=(v)=>(v&&typeof v==="object"&&v.toDate)?v.toDate().toISOString().split("T")[0]:(typeof v==="string"?v:""); setForm({titulo:e.titulo||"",cliente:e.cliente||"",asignados,prioridad:e.prioridad||"Mitjana",estado:e.estado||"Pendent",fecha:toStr(e.fecha),notas:e.notas||"",localidad:e.localidad||"",direccion:e.direccion||"",telefono:e.telefono||"",archivado:e.archivado||false}); setModal(true); };
  const guardar=async()=>{ if(!form.titulo)return;setGuardando(true); const datos={...form,asignado:form.asignados[0]||""}; if(editando)await updateDoc(doc(db,"encargos",editando.id),datos); else await addDoc(collection(db,"encargos"),datos); setGuardando(false);setModal(false); };
  const eliminar=async(id)=>{await deleteDoc(doc(db,"encargos",id));setConfirmarEliminar(null);};
  const cambiarEstado=async(id,estado)=>{ const ahora=new Date().toISOString().split("T")[0]; await updateDoc(doc(db,"encargos",id),{estado,fechaCompletado:estado==="Completat"?ahora:null}); };
  const archivar=async(id,archivado)=>{await updateDoc(doc(db,"encargos",id),{archivado});};
  const archivarTodosCompletados=async()=>{ const c=encargos.filter(e=>e.estado==="Completat"&&!e.archivado); for(const e of c)await updateDoc(doc(db,"encargos",e.id),{archivado:true}); };
  const toggleAsignado=(nom)=>{ const actual=Array.isArray(form.asignados)?form.asignados:[]; setForm({...form,asignados:actual.includes(nom)?actual.filter(n=>n!==nom):[...actual,nom]}); };

  const importarSmartsheet=async(archivo)=>{
    setImportando(true);setResultadoImport(null);
    try{
      const buffer=await archivo.arrayBuffer();
      const wb=XLSX.read(buffer,{type:"array",cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const filas=XLSX.utils.sheet_to_json(ws,{defval:""});
      let importados=0,saltados=0;
      for(const fila of filas){
        const titulo=String(fila["ENCÀRREC / COMENTARI"]||fila["ENCARGO"]||"").trim();
        const cliente=String(fila["CLIENT"]||fila["CLIENTE"]||"").trim();
        const fecha=parsearFecha(fila["DATA"]||fila["FECHA"]||"");
        const asignado=String(fila["ASSIGNAT"]||fila["ASIGNADO"]||"").trim();
        const localidad=String(fila["Localitat"]||fila["Localidad"]||"").trim();
        const direccion=String(fila["DIRECCIÓ"]||fila["DIRECCION"]||"").trim();
        const telefono=String(fila["TELÈFON"]||fila["TELÉFONO"]||"").trim();
        const notas=String(fila["Comentarios"]||"").trim();
        if(!titulo&&!cliente){saltados++;continue;}
        await addDoc(collection(db,"encargos"),{titulo:titulo||`Encàrrec ${cliente}`,cliente,asignados:asignado?[asignado]:[],asignado,localidad,direccion,telefono,notas,fecha,prioridad:"Mitjana",estado:"Pendent",archivado:false});
        importados++;
      }
      setResultadoImport({importados,saltados});
    }catch(e){setResultadoImport({error:"No s'ha pogut llegir l'arxiu."});}
    setImportando(false);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24,fontWeight:700}}>Encàrrecs</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setVistaArchivados(!vistaArchivados)}>{vistaArchivados?"📋 Veure actius":"📦 Veure arxivats"}</button>
          {!vistaArchivados&&<button className="btn btn-ghost" style={{fontSize:12}} onClick={archivarTodosCompletados}>✅ Arxivar completats</button>}
          <label className="btn btn-ghost" style={{cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>
            {importando?"⏳ Important...":"📊 Importar Smartsheet"}
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&importarSmartsheet(e.target.files[0])} disabled={importando} />
          </label>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nou encàrrec</button>
        </div>
      </div>

      {resultadoImport&&(
        <div style={{marginBottom:12,padding:12,borderRadius:10,background:resultadoImport.error?"rgba(255,71,87,.1)":"rgba(0,230,118,.1)",border:`1px solid ${resultadoImport.error?COLORS.warm:COLORS.green}`}}>
          {resultadoImport.error?<span style={{color:COLORS.warm,fontSize:13}}>❌ {resultadoImport.error}</span>:<span style={{color:COLORS.green,fontSize:13}}>✅ {resultadoImport.importados} importats · {resultadoImport.saltados} saltats</span>}
          <button className="btn btn-ghost" style={{fontSize:11,padding:"2px 8px",marginLeft:12}} onClick={()=>setResultadoImport(null)}>✕</button>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {["Tots",...ESTADOS_ENCARGO].map(f=><button key={f} className="btn" onClick={()=>setFiltroEstado(f)} style={{background:filtroEstado===f?COLORS.accent:COLORS.surface,color:filtroEstado===f?"#000":COLORS.muted,border:`1px solid ${filtroEstado===f?COLORS.accent:COLORS.border}`,fontSize:12}}>{f}</button>)}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center",padding:"10px 14px",background:COLORS.surface,borderRadius:10,border:`1px solid ${COLORS.border}`}}>
        <input className="input" type="date" style={{width:"auto",fontSize:12}} value={filtroFechaDesde} onChange={e=>setFiltroFechaDesde(e.target.value)} />
        <span style={{color:COLORS.muted,fontSize:12}}>→</span>
        <input className="input" type="date" style={{width:"auto",fontSize:12}} value={filtroFechaHasta} onChange={e=>setFiltroFechaHasta(e.target.value)} />
        <input className="input" placeholder="📍 Localitat..." style={{width:130,fontSize:12}} value={filtroLocalidad} onChange={e=>setFiltroLocalidad(e.target.value)} />
        <select className="select" style={{fontSize:12,padding:"9px 10px"}} value={filtroTrabajador} onChange={e=>setFiltroTrabajador(e.target.value)}>
          <option value="">👷 Tots</option>
          {nombresActivos.map(t=><option key={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="🔍 Cercar..." style={{flex:1,minWidth:140,fontSize:12}} value={filtroBusqueda} onChange={e=>setFiltroBusqueda(e.target.value)} />
        {hayFiltros&&<button className="btn btn-ghost" style={{fontSize:12}} onClick={limpiarFiltros}>✕</button>}
        <span style={{fontFamily:"'DM Serif Display',serif",fontWeight:700,fontSize:14,color:COLORS.accent,whiteSpace:"nowrap"}}>{lista.length} enc.</span>
      </div>

      {cargando?<div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Carregant...</div>:(
        <div style={{display:"grid",gap:10}}>
          {lista.length===0?<div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>{vistaArchivados?"No hi ha encàrrecs arxivats":hayFiltros?"Sense resultats":"No hi ha encàrrecs"}</div>
            :lista.map(e=>{
              const asignados=Array.isArray(e.asignados)?e.asignados:(e.asignado?[e.asignado]:[]);
              return(
                <div key={e.id} className="card" style={{padding:16,opacity:e.archivado?0.7:1}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                        <EstadoBadge estado={e.prioridad}/><EstadoBadge estado={e.estado}/>
                        {e.notasTrabajador&&<span className="badge" style={{background:"rgba(255,214,0,.15)",color:COLORS.yellow}}>⚠ Falta material</span>}
                        {e.fotos?.length>0&&<span className="badge" style={{background:"rgba(0,230,118,.15)",color:COLORS.green}}>📷 {e.fotos.length}</span>}
                        {e.archivado&&<span className="badge" style={{background:"rgba(139,143,168,.15)",color:COLORS.muted}}>📦 Arxivat</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{e.titulo}</div>
                      <div style={{fontSize:12,color:COLORS.muted,marginBottom:2}}>{e.cliente}{asignados.length>0?` · 👷 ${asignados.join(", ")}`:""}{e.fecha?` · ${e.fecha}`:""}</div>
                      {(e.direccion||e.localidad)&&<div style={{marginBottom:2}}><DireccionMaps direccion={e.direccion} localidad={e.localidad} /></div>}
                      {e.telefono&&<div style={{fontSize:12,color:COLORS.muted}}>📱 {e.telefono}</div>}
                      {e.notasTrabajador&&<div style={{fontSize:12,color:COLORS.yellow,marginTop:6,background:"rgba(255,214,0,.08)",padding:"5px 10px",borderRadius:6}}>⚠ {e.notasTrabajador}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                      <select className="select" style={{fontSize:12,padding:"4px 7px"}} value={e.estado} onChange={ev=>cambiarEstado(e.id,ev.target.value)}>{ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}</select>
                      <div style={{display:"flex",gap:5}}>
                        {(e.fotos?.length>0||e.notasTrabajador)&&<button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>setVerDetalle(e)}>🔍</button>}
                        <button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>abrirEditar(e)}>✏</button>
                        <button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>archivar(e.id,!e.archivado)} title={e.archivado?"Restaurar":"Arxivar"}>{e.archivado?"📤":"📦"}</button>
                        {podeEliminar&&<button className="btn btn-danger" onClick={()=>setConfirmarEliminar(e)}>🗑</button>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {verDetalle&&(
        <Modal title={`Detall: ${verDetalle.titulo}`} onClose={()=>setVerDetalle(null)} wide>
          <div style={{display:"grid",gap:16}}>
            {verDetalle.notasTrabajador&&<div><label>⚠ Materials que falten</label><div style={{background:"rgba(255,214,0,.08)",border:`1px solid ${COLORS.yellow}33`,borderRadius:8,padding:12,fontSize:13,color:COLORS.yellow}}>{verDetalle.notasTrabajador}</div></div>}
            {verDetalle.fotos?.length>0&&(
              <div>
                <label>📷 Fotos ({verDetalle.fotos.length}) — toca per ampliar</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginTop:8}}>
                  {verDetalle.fotos.map((url,i)=><img key={i} src={url} alt="" className="foto-thumb" onClick={()=>setLightboxAdmin(i)} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8,border:`2px solid ${COLORS.border}`}} />)}
                </div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setVerDetalle(null)}>Tancar</button></div>
          </div>
        </Modal>
      )}
      {lightboxAdmin!==null&&verDetalle&&<Lightbox fotos={verDetalle.fotos} indice={lightboxAdmin} onClose={()=>setLightboxAdmin(null)} />}

      {modal&&<Modal title={editando?"Editar Encàrrec":"Nou Encàrrec"} onClose={()=>setModal(false)} wide>
        <div style={{display:"grid",gap:14}}>
          <div><label>Títol *</label><input className="input" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Client</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
            <div><label>Data prevista</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Localitat</label><input className="input" value={form.localidad} onChange={e=>setForm({...form,localidad:e.target.value})} /></div>
            <div><label>Telèfon</label><input className="input" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
          </div>
          <div><label>Adreça</label><input className="input" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Prioritat</label><select className="select" style={{width:"100%"}} value={form.prioridad} onChange={e=>setForm({...form,prioridad:e.target.value})}>{["Baixa","Mitjana","Alta","Urgent"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label>Estat</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div>
            <label>👷 Assignat</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
              {nombresActivos.map(nom=>{
                const sel=(form.asignados||[]).includes(nom);
                return(
                  <button key={nom} type="button" onClick={()=>toggleAsignado(nom)}
                    style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",border:"none",fontFamily:"Inter",fontSize:12,fontWeight:500,
                      background:sel?COLORS.accent:COLORS.surface,
                      color:sel?"#000":COLORS.muted,
                      outline:sel?`2px solid ${COLORS.accent}`:`1px solid ${COLORS.border}`}}>
                    {sel?"✓ ":""}{nom}
                  </button>
                );
              })}
            </div>
          </div>
          <div><label>Notes per al treballador</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardant...":editando?"Guardar canvis":"Crear encàrrec"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="Eliminar encàrrec?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.titulo}</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancel·lar</button><button className="btn" style={{background:COLORS.warm,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
    </div>
  );
}

// ─── ALBARANS ────────────────────────────────────────────────────────────────
function Albaranes({ albaranes }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState("Tots");
  const emptyForm = { numero:"", cliente:"", fecha:new Date().toISOString().split("T")[0], importe:"", estado:"Esborrany", descripcion:"" };
  const [form, setForm] = useState(emptyForm);

  const abrirNuevo=()=>{setEditando(null);setForm(emptyForm);setModal(true);};
  const abrirEditar=(a)=>{setEditando(a);setForm({numero:a.numero,cliente:a.cliente,fecha:a.fecha,importe:String(a.importe),estado:a.estado,descripcion:a.descripcion||""});setModal(true);};
  const guardar=async()=>{ if(!form.cliente)return;setGuardando(true); let numero=form.numero; if(!editando&&!numero)numero=await generarNumeroAlbara(); const datos={...form,importe:Number(form.importe),numero}; if(editando)await updateDoc(doc(db,"albaranes",editando.id),datos); else await addDoc(collection(db,"albaranes"),datos); setGuardando(false);setModal(false); };
  const eliminar=async(id)=>{await deleteDoc(doc(db,"albaranes",id));setConfirmarEliminar(null);};
  const cambiarEstado=async(id,estado)=>{await updateDoc(doc(db,"albaranes",id),{estado});};
  const lista=filtro==="Tots"?albaranes:albaranes.filter(a=>a.estado===filtro);
  const total=lista.reduce((s,a)=>s+a.importe,0);

  return (
    <div>
      <Header title="Albarans" onAdd={abrirNuevo} addLabel="+ Nou albarà" />
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["Tots",...ESTADOS_ALBARAN].map(f=><button key={f} className="btn" onClick={()=>setFiltro(f)} style={{background:filtro===f?COLORS.accent:COLORS.surface,color:filtro===f?"#000":COLORS.muted,border:`1px solid ${filtro===f?COLORS.accent:COLORS.border}`,fontSize:12}}>{f}</button>)}
        <span style={{marginLeft:"auto",alignSelf:"center",fontSize:14,fontFamily:"'DM Serif Display',serif",fontWeight:700,color:COLORS.green}}>Total: {total.toLocaleString()}€</span>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        {lista.length===0?<div style={{padding:40,textAlign:"center",color:COLORS.muted}}>No hi ha albarans</div>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Número","Client","Descripció","Data","Import","Estat",""].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{lista.map(a=>(
              <tr key={a.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
                <td style={{padding:"12px 16px",fontSize:13,fontFamily:"'DM Serif Display',serif",fontWeight:600,color:COLORS.accent}}>{a.numero}</td>
                <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{a.cliente}</td>
                <td style={{padding:"12px 16px",fontSize:12,color:COLORS.muted,maxWidth:200}}>{a.descripcion}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{a.fecha}</td>
                <td style={{padding:"12px 16px",fontSize:14,fontFamily:"'DM Serif Display',serif",fontWeight:700,color:COLORS.green}}>{a.importe.toLocaleString()}€</td>
                <td style={{padding:"12px 16px"}}><select className="select" style={{fontSize:12,padding:"4px 8px"}} value={a.estado} onChange={ev=>cambiarEstado(a.id,ev.target.value)}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></td>
                <td style={{padding:"12px 16px"}}><div style={{display:"flex",gap:6}}><button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>abrirEditar(a)}>✏</button><button className="btn btn-danger" onClick={()=>setConfirmarEliminar(a)}>🗑</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {modal&&<Modal title={editando?"Editar Albarà":"Nou Albarà"} onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Nº Albarà</label><input className="input" placeholder="Auto si buit" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
            <div><label>Data</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div><label>Client *</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
          <div><label>Descripció</label><input className="input" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Import (€)</label><input className="input" type="number" value={form.importe} onChange={e=>setForm({...form,importe:e.target.value})} /></div>
            <div><label>Estat</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel·lar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardant...":editando?"Guardar canvis":"Crear albarà"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="Eliminar albarà?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.numero} — {confirmarEliminar.cliente}</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancel·lar</button><button className="btn" style={{background:COLORS.warm,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
    </div>
  );
}

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
const DOCS_CATS = ["Instal·lació","Manteniment","Tècnic","Elèctric","General"];
const CAT_COLORS_DOC = {"Instal·lació":COLORS.accent,"Manteniment":COLORS.green,"Tècnic":COLORS.warm,"Elèctric":COLORS.yellow,"General":COLORS.muted};


function DocFotos({ hojesTreball, solaLectura }) {
  const [filtreFull, setFiltreFull] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [lightboxFotos, setLightboxFotos] = useState([]);
  const [pujant, setPujant] = useState(false);
  const [fullPujar, setFullPujar] = useState("");

  const allFotos = hojesTreball.flatMap(h=>(h.fotos||[]).map(url=>({url,fullId:h.id,client:h.client||"",data:h.data||"",numero:h.numero||""})));
  const lista = filtreFull ? allFotos.filter(f=>f.fullId===filtreFull) : allFotos;

  const pujarFoto = async (arxius) => {
    if(!fullPujar){alert("Selecciona primer un full de treball");return;}
    setPujant(true);
    const hoja=hojesTreball.find(h=>h.id===fullPujar);
    const noves=[...(hoja?.fotos||[])];
    for(const a of arxius){try{noves.push(await subirFoto(a));}catch(e){console.error(e);}}
    await updateDoc(doc(db,"hojesTreball",fullPujar),{fotos:noves});
    setPujant(false);
  };

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select className="select" value={filtreFull} onChange={e=>setFiltreFull(e.target.value)} style={{minWidth:220,fontSize:13}}>
          <option value="">Totes les fotos ({allFotos.length})</option>
          {hojesTreball.filter(h=>(h.fotos||[]).length>0).map(h=>(
            <option key={h.id} value={h.id}>{h.client||"Sense client"} — {h.data}{h.numero?` #${h.numero}`:""}</option>
          ))}
        </select>
        {!solaLectura&&<>
          <select className="select" value={fullPujar} onChange={e=>setFullPujar(e.target.value)} style={{minWidth:220,fontSize:13}}>
            <option value="">Selecciona full per pujar foto...</option>
            {hojesTreball.map(h=><option key={h.id} value={h.id}>{h.client||"Sense client"} — {h.data}{h.numero?` #${h.numero}`:""}</option>)}
          </select>
          <label className="btn btn-primary" style={{cursor:"pointer",fontSize:13,margin:0}}>
            {pujant?"Pujant...":"📷 Pujar foto"}
            <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>e.target.files.length&&pujarFoto(Array.from(e.target.files))} disabled={pujant} />
          </label>
        </>}
        <span style={{marginLeft:"auto",fontSize:13,color:COLORS.muted}}>{lista.length} foto{lista.length!==1?"s":""}</span>
      </div>
      {lista.length===0
        ? <div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>Sense fotos</div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
            {lista.map((f,i)=>(
              <div key={i} className="card" style={{padding:6,cursor:"pointer"}} onClick={()=>{setLightboxFotos(lista.map(x=>x.url));setLightbox(i);}}>
                <img src={f.url} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8}} />
                <div style={{fontSize:10,color:COLORS.muted,marginTop:5,padding:"0 3px",lineHeight:1.4}}>{f.client}<br/>{f.data}</div>
              </div>
            ))}
          </div>
      }
      {lightbox!==null&&<Lightbox fotos={lightboxFotos} indice={lightbox} onClose={()=>setLightbox(null)} />}
    </div>
  );
}

function DocAlbarans({ albaranes }) {
  const [buscar, setBuscar] = useState("");
  const [filtreEstat, setFiltreEstat] = useState("Tots");
  const [detall, setDetall] = useState(null);

  const lista = albaranes
    .filter(a=>filtreEstat==="Tots"||a.estado===filtreEstat)
    .filter(a=>!buscar||a.cliente?.toLowerCase().includes(buscar.toLowerCase())||a.numero?.toLowerCase().includes(buscar.toLowerCase()));
  const total = lista.reduce((s,a)=>s+(a.importe||0),0);

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input className="input" placeholder="🔍 Client o número..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{maxWidth:240,fontSize:13}} />
        {["Tots",...ESTADOS_ALBARAN].map(f=>(
          <button key={f} className="btn" onClick={()=>setFiltreEstat(f)}
            style={{fontSize:12,padding:"5px 12px",background:filtreEstat===f?COLORS.accent:COLORS.surface,color:filtreEstat===f?"#fff":COLORS.muted,border:`1px solid ${filtreEstat===f?COLORS.accent:COLORS.border}`}}>
            {f}
          </button>
        ))}
        <span style={{marginLeft:"auto",fontFamily:"'DM Serif Display',serif",fontSize:18,color:COLORS.green}}>{total.toLocaleString()}€</span>
      </div>
      <div style={{display:"grid",gap:8}}>
        {lista.length===0
          ? <div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>Sense albarans</div>
          : lista.map(a=>(
              <div key={a.id} className="card" style={{padding:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:15,color:COLORS.accent,minWidth:130}}>{a.numero}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{a.cliente}</div>
                  <div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{a.fecha}{a.descripcion?` · ${a.descripcion.substring(0,50)}`:""}</div>
                </div>
                <EstadoBadge estado={a.estado} />
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:16,color:COLORS.green}}>{(a.importe||0).toLocaleString()}€</span>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setDetall(a)}>Veure</button>
              </div>
            ))
        }
      </div>
      {detall&&(
        <Modal title={`Albarà ${detall.numero}`} onClose={()=>setDetall(null)}>
          <div style={{display:"grid",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label>Client</label><div style={{fontWeight:600,fontSize:15}}>{detall.cliente}</div></div>
              <div><label>Data</label><div style={{fontSize:14}}>{detall.fecha}</div></div>
            </div>
            {detall.descripcion&&<div><label>Descripció</label><div style={{fontSize:13}}>{detall.descripcion}</div></div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label>Import</label><div style={{fontFamily:"'DM Serif Display',serif",fontSize:26,color:COLORS.green}}>{(detall.importe||0).toLocaleString()}€</div></div>
              <div><label>Estat</label><div style={{marginTop:6}}><EstadoBadge estado={detall.estado}/></div></div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setDetall(null)}>Tancar</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DocFulls({ hojesTreball, trabajadores }) {
  const [buscar, setBuscar] = useState("");
  const [filtreTreb, setFiltreTreb] = useState("");
  const [filtreEstat, setFiltreEstat] = useState("Tots");
  const [generant, setGenerant] = useState(null);

  const lista = hojesTreball
    .filter(h=>filtreEstat==="Tots"||h.estat===filtreEstat)
    .filter(h=>!filtreTreb||(Array.isArray(h.operaris)?h.operaris:[]).includes(filtreTreb))
    .filter(h=>!buscar||h.client?.toLowerCase().includes(buscar.toLowerCase())||h.numero?.includes(buscar));

  const descarregar = async (hoja) => {
    setGenerant(hoja.id);
    const pdf = await generarPDFHojaTreball(hoja);
    pdf.save(`full_${hoja.numero||hoja.id}_${hoja.client||"client"}.pdf`);
    setGenerant(null);
  };

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input className="input" placeholder="🔍 Client o número..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{maxWidth:220,fontSize:13}} />
        <select className="select" value={filtreTreb} onChange={e=>setFiltreTreb(e.target.value)} style={{fontSize:13}}>
          <option value="">Tots els treballadors</option>
          {trabajadores.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
        </select>
        {["Tots","Pendent","Signat","Enviat"].map(f=>(
          <button key={f} className="btn" onClick={()=>setFiltreEstat(f)}
            style={{fontSize:11,padding:"5px 11px",background:filtreEstat===f?COLORS.accent:COLORS.surface,color:filtreEstat===f?"#fff":COLORS.muted,border:`1px solid ${filtreEstat===f?COLORS.accent:COLORS.border}`}}>
            {f}
          </button>
        ))}
        <span style={{marginLeft:"auto",fontSize:13,color:COLORS.muted}}>{lista.length} fulls</span>
      </div>
      <div style={{display:"grid",gap:8}}>
        {lista.length===0
          ? <div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>Sense fulls</div>
          : lista.map(h=>(
              <div key={h.id} className="card" style={{padding:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <EstadoBadge estado={h.estat||"Pendent"} />
                    {h.numero&&<span style={{fontFamily:"'DM Serif Display',serif",color:COLORS.accent,fontSize:14}}>#{h.numero}</span>}
                    {h.signatura&&<span className="badge" style={{background:"rgba(22,163,74,.15)",color:COLORS.green,fontSize:10}}>✅ Signat</span>}
                  </div>
                  <div style={{fontWeight:600,fontSize:14}}>{h.client||"Sense client"}</div>
                  <div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>
                    {h.data}{h.poblacio?` · ${h.poblacio}`:""}
                    {Array.isArray(h.operaris)&&h.operaris.length>0?` · 👷 ${h.operaris.join(", ")}`:""}
                  </div>
                </div>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>descarregar(h)} disabled={generant===h.id}>
                  {generant===h.id?"...":"📄 PDF"}
                </button>
              </div>
            ))
        }
      </div>
    </div>
  );
}

const FOTOS_INDEX_URL = "https://nouaire.ruizbravo.org/fotos/index";

function DocFotosLocal() {
  const [clientes,   setClientes]   = useState([]);
  const [carregant,  setCarregant]  = useState(true);
  const [error,      setError]      = useState(null);
  const [cerca,      setCerca]      = useState("");
  const [clienteObert, setClienteObert] = useState(null); // nombre
  const [fechaOberta,  setFechaOberta]  = useState(null); // {client, fecha, fotos}
  const [lightbox,   setLightbox]   = useState(null);

  useEffect(() => {
    fetch(FOTOS_INDEX_URL)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then(d => { setClientes(d.clientes || []); setCarregant(false); })
      .catch(e => { setError(e.message); setCarregant(false); });
  }, []);

  const clientesFiltrats = clientes.filter(c =>
    c.nombre.toLowerCase().includes(cerca.toLowerCase())
  );

  const totalFotos = c => c.fechas.reduce((s, f) => s + f.fotos.length, 0);

  const obrirFecha = (client, fecha, fotos) => {
    setFechaOberta({ client, fecha, fotos });
    setLightbox(null);
  };

  // ── Vista grid de fotos d'una data ────────────────────────────────────────
  if (fechaOberta) return (
    <div>
      <button className="btn btn-ghost" style={{marginBottom:16,fontSize:13}}
        onClick={()=>setFechaOberta(null)}>
        ← {fechaOberta.client} / {fechaOberta.fecha}
      </button>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
        {fechaOberta.fotos.map((url,i)=>(
          <div key={i} onClick={()=>setLightbox(i)}
            style={{cursor:"pointer",borderRadius:12,overflow:"hidden",
              border:`1px solid ${COLORS.border}`,background:COLORS.surface,
              transition:"transform .15s,box-shadow .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.03)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.10)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
            <img src={url} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",display:"block"}} />
          </div>
        ))}
      </div>
      <div style={{marginTop:12,fontSize:12,color:COLORS.muted}}>
        {fechaOberta.fotos.length} foto{fechaOberta.fotos.length!==1?"s":""}
      </div>
      {lightbox!==null&&(
        <Lightbox fotos={fechaOberta.fotos} indice={lightbox} onClose={()=>setLightbox(null)} />
      )}
    </div>
  );

  // ── Vista carpetes ─────────────────────────────────────────────────────────
  if (carregant) return <div style={{textAlign:"center",padding:48,color:COLORS.muted,fontSize:14}}>Carregant fotos del servidor...</div>;
  if (error)     return <div style={{textAlign:"center",padding:48,color:COLORS.warm,fontSize:14}}>⚠ {error}</div>;

  return (
    <div>
      {/* Buscador */}
      <div style={{position:"relative",marginBottom:20}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
          fontSize:15,color:COLORS.muted,pointerEvents:"none"}}>🔍</span>
        <input
          className="input"
          value={cerca}
          onChange={e=>{setCerca(e.target.value);setClienteObert(null);}}
          placeholder="Cerca client..."
          style={{paddingLeft:36,fontSize:14,width:"100%",maxWidth:340}}
        />
      </div>

      {clientesFiltrats.length === 0
        ? <div style={{textAlign:"center",padding:48,color:COLORS.muted}}>Cap client trobat</div>
        : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {clientesFiltrats.map(c => {
              const obert  = clienteObert === c.nombre;
              const nFotos = totalFotos(c);
              return (
                <div key={c.nombre} style={{borderRadius:12,border:`1px solid ${COLORS.border}`,
                  background:COLORS.surface,overflow:"hidden"}}>

                  {/* Capçalera carpeta */}
                  <div onClick={()=>setClienteObert(obert ? null : c.nombre)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
                      cursor:"pointer",userSelect:"none",
                      background: obert ? COLORS.accentLight : COLORS.surface,
                      transition:"background .15s"}}
                    onMouseEnter={e=>{ if(!obert) e.currentTarget.style.background=COLORS.bg; }}
                    onMouseLeave={e=>{ if(!obert) e.currentTarget.style.background=COLORS.surface; }}>
                    <span style={{fontSize:22}}>{obert ? "📂" : "📁"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,color:obert?COLORS.accent:COLORS.text}}>
                        {c.nombre}
                      </div>
                      <div style={{fontSize:11,color:COLORS.muted,marginTop:2}}>
                        {c.fechas.length} data{c.fechas.length!==1?"es":""} · {nFotos} foto{nFotos!==1?"s":""}
                      </div>
                    </div>
                    <span style={{fontSize:12,color:COLORS.muted,transition:"transform .2s",
                      transform: obert?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                  </div>

                  {/* Llista de dates */}
                  {obert && (
                    <div style={{borderTop:`1px solid ${COLORS.border}`,padding:"10px 14px",
                      display:"flex",flexDirection:"column",gap:4}}>
                      {c.fechas.map(f=>(
                        <div key={f.fecha}
                          onClick={()=>obrirFecha(c.nombre, f.fecha, f.fotos)}
                          style={{display:"flex",alignItems:"center",gap:10,
                            padding:"10px 12px",borderRadius:8,cursor:"pointer",
                            transition:"background .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=COLORS.bg}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <span style={{fontSize:16}}>🗓</span>
                          <span style={{fontSize:13,flex:1,color:COLORS.text}}>{f.fecha}</span>
                          <span style={{fontSize:11,color:COLORS.muted,
                            background:COLORS.bg,borderRadius:20,padding:"2px 10px"}}>
                            {f.fotos.length} foto{f.fotos.length!==1?"s":""}
                          </span>
                          <span style={{fontSize:11,color:COLORS.muted}}>→</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

function Documents({ trabajadores, hojesTreball, albaranes, solaLectura=false, initialTab="fotos" }) {
  const [tab, setTab] = useState(initialTab);
  const TABS = [
    {id:"fotos",       label:"Fotos",        icon:"📷"},
    {id:"fotos-local", label:"Fotos Servidor",icon:"🗄️"},
    {id:"albarans",    label:"Albarans",     icon:"🧾"},
    {id:"fulls",       label:"Fulls",        icon:"📄"},
  ];
  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:20,background:"#fff",borderRadius:12,padding:6,border:`1px solid ${COLORS.border}`,width:"fit-content"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,
            fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all .15s",
            background:tab===t.id?COLORS.accent:"transparent",
            color:tab===t.id?"#fff":COLORS.muted
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      {tab==="fotos"       && <DocFotos hojesTreball={hojesTreball} solaLectura={solaLectura} />}
      {tab==="fotos-local" && <DocFotosLocal />}
      {tab==="albarans"    && <DocAlbarans albaranes={albaranes} />}
      {tab==="fulls"       && <DocFulls hojesTreball={hojesTreball} trabajadores={trabajadores} />}
    </div>
  );
}

// ─── NOTIFICACIONS ADMIN ─────────────────────────────────────────────────────
function NotificacionsAdmin() {
  const [notifs, setNotifs] = useState([]);
  const [obert, setObert] = useState(false);

  useEffect(() => {
    const q = query(collection(db,"notificacions"), orderBy("createdAt","desc"));
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  const nollegides = notifs.filter(n=>!n.llegida).length;

  const marcarLlegida = async (id) => {
    await updateDoc(doc(db,"notificacions",id), { llegida: true });
  };

  const marcarTotes = async () => {
    for (const n of notifs.filter(n=>!n.llegida)) {
      await updateDoc(doc(db,"notificacions",n.id), { llegida: true });
    }
  };

  const obrirPanel = () => {
    setObert(o => !o);
    if (!obert) marcarTotes();
  };

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <button onClick={obrirPanel} style={{ background:"transparent", border:"none", cursor:"pointer", position:"relative", padding:"6px 10px" }}>
        <span style={{ fontSize:22 }}>🔔</span>
        {nollegides>0&&<span style={{ position:"absolute", top:0, right:0, background:COLORS.warm, color:"#fff", borderRadius:"50%", fontSize:10, fontWeight:700, width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>{nollegides}</span>}
      </button>
      {obert&&(
        <div style={{ position:"absolute", right:0, top:"110%", width:340, background:"#fff", border:`1px solid ${COLORS.border}`, borderRadius:14, zIndex:100, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", borderBottom:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"'DM Serif Display',serif", fontWeight:400, fontSize:17 }}>Notificacions</span>
            {nollegides>0&&<button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 8px" }} onClick={marcarTotes}>Marcar totes</button>}
          </div>
          <div style={{ maxHeight:320, overflowY:"auto" }}>
            {notifs.length===0
              ? <div style={{ padding:24, textAlign:"center", color:COLORS.muted, fontSize:13 }}>Sense notificacions</div>
              : notifs.slice(0,20).map(n=>(
                <div key={n.id} onClick={()=>marcarLlegida(n.id)} style={{ padding:"12px 16px", borderBottom:`1px solid ${COLORS.border}`, cursor:"pointer", background:n.llegida?"transparent":COLORS.accentLight, display:"flex", gap:10, alignItems:"flex-start" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{n.tipus==="full_enviat"?"📋":"🔔"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:n.llegida?COLORS.muted:COLORS.text }}>{n.missatge}</div>
                    <div style={{ fontSize:11, color:COLORS.muted, marginTop:3 }}>{n.createdAt?.slice(0,16).replace("T"," ")}</div>
                  </div>
                  {!n.llegida&&<span style={{ width:8, height:8, borderRadius:"50%", background:COLORS.accent, flexShrink:0, marginTop:5 }}></span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}


// ─── VISTA SECRETARIA ─────────────────────────────────────────────────────────
function VistaSecretaria({ usuarioInfo, fichajes, encargos, albaranes, trabajadores, hojesTreball }) {
  const permes = usuarioInfo.seccionsPermeses || [];
  const navItems = NAV_ITEMS.filter(item => permes.includes(item.id));
  const [section, setSection] = useState(navItems[0]?.id || null);

  const secLabel = NAV_ITEMS.find(i=>i.id===section)?.label || "";
  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <div style={{width:220,background:"#fff",borderRight:`1px solid ${COLORS.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
          <div style={{padding:"28px 24px 20px",borderBottom:`1px solid ${COLORS.border}`}}>
            <img src={NOUAIRE_LOGO} alt="Nouaire" style={{height:30,maxWidth:"100%"}} />
            <div style={{fontSize:10,color:COLORS.muted,marginTop:8,letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:500}}>Espai de gestió</div>
          </div>
          <nav style={{padding:"16px 12px",flex:1,display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setSection(item.id)}
                style={{width:"100%",background:section===item.id?COLORS.accentLight:"transparent",
                  borderRadius:8,border:"none",
                  color:section===item.id?COLORS.accent:COLORS.muted,
                  padding:"10px 12px",textAlign:"left",cursor:"pointer",
                  fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:section===item.id?500:400,
                  display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                <span style={{fontSize:14,width:18,textAlign:"center",opacity:0.7}}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{padding:"16px 20px",borderTop:`1px solid ${COLORS.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:COLORS.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:COLORS.accent,flexShrink:0}}>
                {(usuarioInfo?.nombre||"S").charAt(0).toUpperCase()}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:COLORS.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{usuarioInfo?.nombre||"Secretaria"}</div>
                <div style={{fontSize:11,color:COLORS.muted}}>Secretaria</div>
              </div>
            </div>
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12}} onClick={()=>signOut(auth)}>Tancar sessió</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:"100vh",background:COLORS.bg}}>
          <div style={{padding:"36px 40px",maxWidth:1100}}>
            {!section
              ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:COLORS.muted,fontSize:14}}>Sense seccions assignades</div>
              : <>
                  <div style={{marginBottom:28}}>
                    <h2 className="page-title">{secLabel}</h2>
                    <div style={{fontSize:13,color:COLORS.muted,marginTop:4,fontWeight:300}}>
                      {new Date().toLocaleDateString("ca-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                    </div>
                  </div>
                  {section==="dashboard"&&<Dashboard encargos={encargos} fichajes={fichajes} trabajadores={trabajadores} albaranes={albaranes} hojesTreball={hojesTreball}/>}
                  {section==="trabajadores"&&<Trabajadores trabajadores={trabajadores} cargandoT={false} hojesTreball={hojesTreball}/>}
                  {section==="fichajes"&&<Fichajes trabajadores={trabajadores} fichajes={fichajes}/>}
                  {section==="encargos"&&<Encargos trabajadores={trabajadores}/>}
                  {section==="hojesTreball"&&<HojesTreball trabajadores={trabajadores} encargos={encargos}/>}
                  {section==="albaranes"&&<Albaranes albaranes={albaranes}/>}
                </>
            }
          </div>
        </div>
      </div>
    </>
  );
}

// ─── VISTA ENCARREGAT ─────────────────────────────────────────────────────────
function VistaEncarregat({ usuarioInfo, fichajes, encargos, albaranes, trabajadores, hojesTreball }) {
  const SECCIONS = ["dashboard","trabajadores","fichajes","encargos","hojesTreball","documents"];
  const navItems = NAV_ITEMS.filter(i=>SECCIONS.includes(i.id));
  const [section, setSection] = useState("dashboard");
  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <div style={{width:220,background:"#fff",borderRight:`1px solid ${COLORS.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
          <div style={{padding:"28px 24px 20px",borderBottom:`1px solid ${COLORS.border}`}}>
            <img src={NOUAIRE_LOGO} alt="Nouaire" style={{height:30,maxWidth:"100%"}} />
            <div style={{fontSize:10,color:COLORS.muted,marginTop:8,letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:500}}>Encarregat</div>
          </div>
          <nav style={{padding:"16px 12px",flex:1,display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setSection(item.id)}
                style={{width:"100%",background:section===item.id?COLORS.accentLight:"transparent",
                  borderRadius:8,border:"none",color:section===item.id?COLORS.accent:COLORS.muted,
                  padding:"10px 12px",textAlign:"left",cursor:"pointer",fontSize:13,
                  fontFamily:"'DM Sans',sans-serif",fontWeight:section===item.id?500:400,
                  display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                <span style={{fontSize:14,width:18,textAlign:"center",opacity:0.7}}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{padding:"16px 20px",borderTop:`1px solid ${COLORS.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:COLORS.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:COLORS.accent,flexShrink:0}}>
                {(usuarioInfo?.nombre||"E").charAt(0).toUpperCase()}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:COLORS.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{usuarioInfo?.nombre||"Encarregat"}</div>
                <div style={{fontSize:11,color:COLORS.muted}}>Encarregat</div>
              </div>
              <NotificacionsAdmin />
            </div>
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12}} onClick={()=>signOut(auth)}>Tancar sessió</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:"100vh",background:COLORS.bg}}>
          <div style={{padding:"36px 40px",maxWidth:1100}}>
            <div style={{marginBottom:28}}>
              <h2 className="page-title">{NAV_ITEMS.find(i=>i.id===section)?.label||"Inici"}</h2>
              <div style={{fontSize:13,color:COLORS.muted,marginTop:4,fontWeight:300}}>
                {new Date().toLocaleDateString("ca-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </div>
            </div>
            {section==="dashboard"   && <Dashboard encargos={encargos} fichajes={fichajes} trabajadores={trabajadores} albaranes={albaranes} hojesTreball={hojesTreball}/>}
            {section==="trabajadores"&& <Trabajadores trabajadores={trabajadores} cargandoT={false} hojesTreball={hojesTreball} podeEliminar={false}/>}
            {section==="fichajes"    && <Fichajes trabajadores={trabajadores} fichajes={fichajes}/>}
            {section==="encargos"    && <Encargos trabajadores={trabajadores} podeEliminar={false}/>}
            {section==="hojesTreball"&& <HojesTreball trabajadores={trabajadores} encargos={encargos} podeAprovar={true}/>}
            {section==="documents"   && <Documents trabajadores={trabajadores} hojesTreball={hojesTreball} albaranes={albaranes}/>}
          </div>
        </div>
      </div>
    </>
  );
}

function Dashboard({ encargos, fichajes, trabajadores, albaranes, hojesTreball }) {
  const fichajesHoy=[...new Set(fichajes.filter(f=>f.fecha===hoy).map(f=>f.trabajador))].length;
  const encargosActivos=encargos.filter(e=>!e.archivado&&(e.estado==="En curs"||e.estado==="Pendent")).length;
  const materialFaltante=encargos.filter(e=>e.notasTrabajador&&e.estado!=="Completat"&&!e.archivado).length;
  const totalFacturado=albaranes.filter(a=>a.estado==="Cobrat").reduce((s,a)=>s+a.importe,0);
  const fullsPendents=(hojesTreball||[]).filter(h=>h.estat==="Pendent"||!h.estat).length;

  const stats=[
    {label:"Treballadors actius",value:trabajadores.filter(t=>t.estado!=="Inactiu").length,color:COLORS.accent,icon:"👷"},
    {label:"Fitxats avui",value:fichajesHoy,color:COLORS.green,icon:"⏱"},
    {label:"Encàrrecs actius",value:encargosActivos,color:COLORS.warm,icon:"🔧"},
    {label:"Fulls pendents",value:fullsPendents,color:COLORS.yellow,icon:"📋"},
  ];

  const urgentes=encargos.filter(e=>e.prioridad==="Urgent"&&e.estado!=="Completat"&&!e.archivado);
  const conMaterial=encargos.filter(e=>e.notasTrabajador&&e.estado!=="Completat"&&!e.archivado);
  const fichajesHoyList=fichajes.filter(f=>f.fecha===hoy).slice(0,6);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:28}}>
        {stats.map((s,i)=>(
          <div key={s.label} className="card fade-up" style={{padding:22,animationDelay:`${i*0.07}s`}}>
            <div style={{fontSize:22,marginBottom:12}}>{s.icon}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:32,fontWeight:400,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:COLORS.muted,marginTop:6}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div className="card fade-up" style={{padding:24,animationDelay:"0.28s"}}>
          <div className="section-title" style={{marginBottom:16}}>Fitxatges d'avui</div>
          {fichajesHoyList.length===0
            ? <div style={{color:COLORS.muted,fontSize:13,padding:"20px 0",textAlign:"center"}}>Sense fitxatges avui</div>
            : fichajesHoyList.map(f=>(
              <div key={f.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:500}}>{f.trabajador}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,color:COLORS.muted}}>{f.entrada} → {f.salida||"..."}</span>
                  {f.ubicacionEntrada&&<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} />}
                </div>
              </div>
            ))
          }
        </div>
        <div className="card fade-up" style={{padding:24,animationDelay:"0.35s"}}>
          <div className="section-title" style={{marginBottom:16}}>Encàrrecs urgents</div>
          {urgentes.length===0
            ? <div style={{color:COLORS.muted,fontSize:13,padding:"20px 0",textAlign:"center"}}>Cap encàrrec urgent</div>
            : urgentes.map(e=>(
              <div key={e.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`}}>
                <div style={{fontSize:13,fontWeight:500}}>{e.titulo}</div>
                <div style={{fontSize:12,color:COLORS.muted,marginTop:3}}>{(Array.isArray(e.asignados)?e.asignados.join(", "):e.asignado)||"Sense assignar"} · {e.localidad||e.fecha}</div>
              </div>
            ))
          }
        </div>
      </div>
      {conMaterial.length>0&&(
        <div className="card fade-up" style={{padding:24,borderLeft:`3px solid ${COLORS.yellow}`,animationDelay:"0.42s"}}>
          <div className="section-title" style={{marginBottom:16,color:COLORS.yellow}}>Material pendent</div>
          {conMaterial.map(e=>(
            <div key={e.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.titulo} <span style={{fontSize:12,color:COLORS.muted}}>— {Array.isArray(e.asignados)?e.asignados.join(", "):e.asignado}</span></div>
              <div style={{fontSize:12,color:"#A16207",marginTop:3,background:"#FEF9C3",padding:"4px 8px",borderRadius:6,display:"inline-block"}}>⚠ {e.notasTrabajador}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  {id:"dashboard",   label:"Inici",           icon:"🏠"},
  {id:"usuarios",    label:"Usuaris",          icon:"👥"},
  {id:"trabajadores",label:"Treballadors",     icon:"👷"},
  {id:"fichajes",    label:"Control Horari",   icon:"🕐"},
  {id:"encargos",    label:"Encàrrecs",        icon:"📋"},
  {id:"hojesTreball",label:"Fulls de Treball", icon:"📄"},
  {id:"albaranes",   label:"Albarans",         icon:"🧾"},
  {id:"documents",   label:"Documents",        icon:"📁"},
];

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [cuentaSinConfigurar, setCuentaSinConfigurar] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [fichajes, setFichajes] = useState([]);
  const [encargos, setEncargos] = useState([]);
  const [albaranes, setAlbaranes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [hojesTreball, setHojesTreball] = useState([]);
  const [cargandoT, setCargandoT] = useState(true);

  useEffect(()=>{ return onAuthStateChanged(auth,async(u)=>{ if(u){setUsuario(u);setCuentaSinConfigurar(false);const snap=await getDoc(doc(db,"usuarios",u.uid));if(snap.exists()){setUsuarioInfo(snap.data());}else{console.warn('[Auth] Usuari autenticat sense document a Firestore "usuarios". UID:',u.uid);setCuentaSinConfigurar(true);}}else{setUsuario(null);setUsuarioInfo(null);setCuentaSinConfigurar(false);}setCargandoAuth(false); }); },[]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol==="trabajador") return; const q=query(collection(db,"fichajes"),orderBy("fecha","desc")); return onSnapshot(q,snap=>setFichajes(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol!=="trabajador") return; const q=query(collection(db,"fichajes"),where("trabajador","==",usuarioInfo.nombre),where("fecha","==",hoy)); return onSnapshot(q,snap=>setFichajes(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{ const q=query(collection(db,"trabajadores"),orderBy("nombre")); return onSnapshot(q,snap=>{setTrabajadores(snap.docs.map(d=>({id:d.id,...d.data()})));setCargandoT(false);}); },[]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol==="trabajador") return; const q=query(collection(db,"encargos"),orderBy("fecha","desc")); return onSnapshot(q,snap=>setEncargos(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol!=="trabajador") return; const q=query(collection(db,"encargos"),where("asignados","array-contains",usuarioInfo.nombre)); return onSnapshot(q,snap=>setEncargos(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol==="trabajador") return; const q=query(collection(db,"albaranes"),orderBy("fecha","desc")); return onSnapshot(q,snap=>setAlbaranes(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{ if(!usuarioInfo||usuarioInfo.rol==="trabajador") return; const q=query(collection(db,"hojesTreball"),orderBy("createdAt","desc")); return onSnapshot(q,snap=>setHojesTreball(snap.docs.map(d=>({id:d.id,...d.data()})))); },[usuarioInfo]);
  useEffect(()=>{
    if(!usuarioInfo||usuarioInfo.rol!=="trabajador") return;
    console.log("[hojesTreball] usuarioInfo.nombre:", JSON.stringify(usuarioInfo.nombre));
    const q=query(collection(db,"hojesTreball"),where("operaris","array-contains",usuarioInfo.nombre),orderBy("createdAt","desc"));
    return onSnapshot(q,snap=>{
      console.log("[hojesTreball] documents trobats:", snap.docs.length, snap.docs.map(d=>d.data().numero));
      setHojesTreball(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  },[usuarioInfo]);

  if(cargandoAuth) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:COLORS.bg,color:COLORS.muted,fontFamily:"'DM Sans',sans-serif"}}>Carregant...</div>;
  if(!usuario) return <Login />;
  if(cuentaSinConfigurar) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:COLORS.bg,fontFamily:"'DM Sans',sans-serif",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>⚠️</div>
      <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,fontWeight:400,color:COLORS.text}}>Compte sense configurar</div>
      <div style={{fontSize:14,color:COLORS.muted,textAlign:"center",maxWidth:340,fontWeight:300}}>El teu compte no té accés configurat. Contacta amb l'administrador.</div>
      <button className="btn btn-danger" onClick={()=>signOut(auth)}>Tancar sessió</button>
    </div>
  );
  if(usuarioInfo?.rol==="trabajador")  return <VistaTrabajador usuarioInfo={usuarioInfo} fichajes={fichajes} encargos={encargos} usuarioUid={usuario.uid} trabajadores={trabajadores} hojesTreball={hojesTreball} />;
  if(usuarioInfo?.rol==="encarregat") return <VistaEncarregat usuarioInfo={usuarioInfo} fichajes={fichajes} encargos={encargos} albaranes={albaranes} trabajadores={trabajadores} hojesTreball={hojesTreball} />;
  if(usuarioInfo?.rol==="secretaria") return <VistaSecretaria usuarioInfo={usuarioInfo} fichajes={fichajes} encargos={encargos} albaranes={albaranes} trabajadores={trabajadores} hojesTreball={hojesTreball} />;

  const pendentsCount = hojesTreball.filter(h=>h.estat==="Pendent"||!h.estat).length;
  const currentNavLabel = NAV_ITEMS.find(i=>i.id===section)?.label || "Inici";

  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* SIDEBAR */}
        <div style={{width:220,background:"#fff",borderRight:`1px solid ${COLORS.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
          <div style={{padding:"28px 24px 20px",borderBottom:`1px solid ${COLORS.border}`}}>
            <img src={NOUAIRE_LOGO} alt="Nouaire" style={{height:30,maxWidth:"100%"}} />
            <div style={{fontSize:10,color:COLORS.muted,marginTop:8,letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:500}}>Espai de gestió</div>
          </div>
          <nav style={{padding:"16px 12px",flex:1,display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
            {NAV_ITEMS.map(item=>(
              <button key={item.id} onClick={()=>setSection(item.id)}
                style={{width:"100%",background:section===item.id?COLORS.accentLight:"transparent",
                  borderRadius:8,border:"none",
                  color:section===item.id?COLORS.accent:COLORS.muted,
                  padding:"10px 12px",textAlign:"left",cursor:"pointer",
                  fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:section===item.id?500:400,
                  display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                <span style={{fontSize:14,width:18,textAlign:"center",opacity:0.7}}>{item.icon}</span>
                {item.label}
                {item.id==="hojesTreball" && pendentsCount>0 && (
                  <span style={{marginLeft:"auto",background:COLORS.yellow,color:"#fff",fontSize:10,fontWeight:600,borderRadius:10,padding:"1px 7px"}}>
                    {pendentsCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div style={{padding:"16px 20px",borderTop:`1px solid ${COLORS.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:COLORS.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:COLORS.accent,flexShrink:0}}>
                {(usuarioInfo?.nombre||"A").charAt(0).toUpperCase()}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:COLORS.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{usuarioInfo?.nombre||"Admin"}</div>
                <div style={{fontSize:11,color:COLORS.muted}}>Administrador</div>
              </div>
              <NotificacionsAdmin />
            </div>
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12}} onClick={()=>signOut(auth)}>Tancar sessió</button>
          </div>
        </div>
        {/* MAIN */}
        <div style={{flex:1,overflowY:"auto",maxHeight:"100vh",background:COLORS.bg}}>
          <div style={{padding:"36px 40px",maxWidth:1100}}>
            <div style={{marginBottom:28}}>
              <h2 className="page-title">{currentNavLabel}</h2>
              <div style={{fontSize:13,color:COLORS.muted,marginTop:4,fontWeight:300}}>
                {new Date().toLocaleDateString("ca-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </div>
            </div>
            {section==="dashboard"&&<Dashboard encargos={encargos} fichajes={fichajes} trabajadores={trabajadores} albaranes={albaranes} hojesTreball={hojesTreball}/>}
            {section==="usuarios"&&<GestionUsuarios trabajadores={trabajadores}/>}
            {section==="trabajadores"&&<Trabajadores trabajadores={trabajadores} cargandoT={cargandoT} hojesTreball={hojesTreball}/>}
            {section==="fichajes"&&<Fichajes trabajadores={trabajadores} fichajes={fichajes}/>}
            {section==="encargos"&&<Encargos trabajadores={trabajadores}/>}
            {section==="hojesTreball"&&<HojesTreball trabajadores={trabajadores} encargos={encargos}/>}
            {section==="albaranes"&&<Albaranes albaranes={albaranes}/>}
            {section==="documents"&&<Documents trabajadores={trabajadores} hojesTreball={hojesTreball} albaranes={albaranes}/>}
          </div>
        </div>
      </div>
    </>
  );
}