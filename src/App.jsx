import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  deleteDoc, doc, updateDoc, setDoc, getDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";
import * as XLSX from "xlsx";

const COLORS = {
  bg: "#0f1117", surface: "#1a1d27", card: "#1e2130", border: "#2a2d3e",
  accent: "#00c4ff", accentDim: "#0099cc", accentGlow: "rgba(0,196,255,0.15)",
  warm: "#ff6b35", green: "#00e676", yellow: "#ffd600",
  text: "#e8eaf0", muted: "#8b8fa8", danger: "#ff4757",
};

const CLOUDINARY_CLOUD = "dekjrcfef";
const CLOUDINARY_PRESET = "climapro";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${COLORS.bg}; color: ${COLORS.text}; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
  .badge { display:inline-flex; align-items:center; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:.5px; }
  .btn { cursor:pointer; border:none; font-family:'Inter',sans-serif; font-size:13px; font-weight:500; border-radius:8px; padding:8px 16px; transition:all .2s; }
  .btn-primary { background:${COLORS.accent}; color:#000; }
  .btn-primary:hover { background:${COLORS.accentDim}; transform:translateY(-1px); }
  .btn-ghost { background:transparent; color:${COLORS.muted}; border:1px solid ${COLORS.border}; }
  .btn-ghost:hover { border-color:${COLORS.accent}; color:${COLORS.accent}; }
  .btn-danger { background:transparent; color:${COLORS.danger}; border:1px solid ${COLORS.danger}33; font-size:12px; padding:5px 10px; }
  .btn-danger:hover { background:${COLORS.danger}22; }
  .input { background:${COLORS.surface}; border:1px solid ${COLORS.border}; color:${COLORS.text}; border-radius:8px; padding:9px 13px; font-size:13px; font-family:'Inter',sans-serif; width:100%; outline:none; transition:border .2s; }
  .input:focus { border-color:${COLORS.accent}; }
  .select { background:${COLORS.surface}; border:1px solid ${COLORS.border}; color:${COLORS.text}; border-radius:8px; padding:9px 13px; font-size:13px; font-family:'Inter',sans-serif; outline:none; cursor:pointer; }
  .card { background:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:14px; }
  .card:hover { border-color:rgba(0,196,255,0.25); }
  label { font-size:12px; color:${COLORS.muted}; font-weight:500; letter-spacing:.5px; text-transform:uppercase; display:block; margin-bottom:5px; }
  .folder-row { display:flex; align-items:center; gap:10; padding:12px 16px; cursor:pointer; border-radius:10px; transition:background .15s; }
  .folder-row:hover { background:rgba(0,196,255,0.07); }
  tr:hover td { background:rgba(255,255,255,0.02); }
  .foto-thumb { cursor:pointer; transition:transform .15s; }
  .foto-thumb:hover { transform:scale(1.05); }
`;

const ESTADOS_ALBARAN = ["Borrador", "Enviado", "Cobrado", "Pendiente"];
const ESTADOS_ENCARGO = ["Pendiente", "En curso", "Completado", "Cancelado"];

function calcHoras(entrada, salida) {
  if (!entrada || !salida) return "-";
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) return "-";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function calcMinutos(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return mins > 0 ? mins : 0;
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
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

function LinkMapa({ lat, lng, precision }) {
  if (!lat || !lng) return <span style={{ fontSize:11, color:COLORS.muted }}>Sin ubicación</span>;
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
      style={{ fontSize:11, color:COLORS.accent, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
      📍 Ver mapa {precision ? `(±${precision}m)` : ""}
    </a>
  );
}

// ─── DIRECCIÓN CLICABLE → GOOGLE MAPS ────────────────────────────────────────
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

// ─── LIGHTBOX FOTOS ───────────────────────────────────────────────────────────
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
        <img src={fotos[actual]} alt={`foto ${actual+1}`} style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:12 }} />
        {fotos.length > 1 && (
          <>
            <button onClick={e=>{e.stopPropagation();setActual(a=>Math.max(a-1,0));}}
              style={{ position:"absolute", left:-48, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.15)", border:"none", color:"#fff", fontSize:24, width:40, height:40, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <button onClick={e=>{e.stopPropagation();setActual(a=>Math.min(a+1,fotos.length-1));}}
              style={{ position:"absolute", right:-48, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.15)", border:"none", color:"#fff", fontSize:24, width:40, height:40, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </>
        )}
      </div>
      <div style={{ color:"rgba(255,255,255,.6)", fontSize:13 }}>{actual+1} / {fotos.length} · Pulsa ESC para cerrar</div>
      {fotos.length > 1 && (
        <div style={{ display:"flex", gap:8 }}>
          {fotos.map((url, i) => (
            <img key={i} src={url} alt="" onClick={e=>{e.stopPropagation();setActual(i);}}
              style={{ width:50, height:50, objectFit:"cover", borderRadius:6, cursor:"pointer", opacity: i===actual?1:0.5, border: i===actual?`2px solid ${COLORS.accent}`:"2px solid transparent" }} />
          ))}
        </div>
      )}
    </div>
  );
}

async function subirFoto(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await axios.post(CLOUDINARY_URL, formData);
  return res.data.secure_url;
}

function parsearFecha(valor) {
  if (!valor) return "";
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha) {
      const m = String(fecha.m).padStart(2,"0");
      const d = String(fecha.d).padStart(2,"0");
      return `${fecha.y}-${m}-${d}`;
    }
  }
  if (typeof valor === "string" && valor.trim()) {
    const partes = valor.trim().split(/[\/\-\.]/);
    if (partes.length === 3) {
      const [a, b, c] = partes;
      if (c.length === 4) return `${c}-${b.padStart(2,"0")}-${a.padStart(2,"0")}`;
      if (a.length === 4) return `${a}-${b.padStart(2,"0")}-${c.padStart(2,"0")}`;
    }
    return valor.trim();
  }
  return String(valor);
}

function generarPDFHorario(trabajador, fichajes, empresa = "ClimaPro") {
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
  pdf.text("REGISTRO DE JORNADA LABORAL", 105, 15, { align: "center" });
  pdf.setTextColor(200, 200, 200); pdf.setFontSize(11);
  pdf.text(`Empresa: ${empresa}`, 105, 23, { align: "center" });
  pdf.setTextColor(150, 150, 150); pdf.setFontSize(9);
  pdf.text("Art. 34.9 del Estatuto de los Trabajadores — RDL 8/2019", 105, 30, { align: "center" });
  pdf.setTextColor(30, 30, 30); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DEL TRABAJADOR", 14, 50);
  pdf.setDrawColor(0, 196, 255); pdf.setLineWidth(0.5); pdf.line(14, 52, 196, 52);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(50, 50, 50);
  pdf.text(`Nombre: ${trabajador}`, 14, 60);
  pdf.text(`Período: ${hace4años.toLocaleDateString("es-ES")} — ${ahora.toLocaleDateString("es-ES")}`, 14, 67);
  const totalMins = registros.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
  pdf.text(`Total horas: ${Math.floor(totalMins/60)}h ${totalMins%60}m`, 120, 60);
  pdf.text(`Generado: ${ahora.toLocaleDateString("es-ES")} ${ahora.toLocaleTimeString("es-ES")}`, 120, 67);
  pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(30, 30, 30);
  pdf.text("REGISTROS DE JORNADA", 14, 80); pdf.line(14, 82, 196, 82);

  if (registros.length === 0) {
    pdf.setFont("helvetica", "italic"); pdf.setFontSize(10); pdf.setTextColor(150, 150, 150);
    pdf.text("No hay registros.", 14, 92);
  } else {
    const rows = [];
    Object.entries(porDia).forEach(([fecha, tramos]) => {
      const totalDia = tramos.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
      const fechaObj = new Date(fecha + "T00:00:00");
      const dia = fechaObj.toLocaleDateString("es-ES", { weekday: "short" });
      tramos.forEach((f, i) => {
        const ubEntrada = f.ubicacionEntrada ? `${f.ubicacionEntrada.lat.toFixed(4)},${f.ubicacionEntrada.lng.toFixed(4)}` : "—";
        rows.push([
          i === 0 ? fecha : "", i === 0 ? dia.charAt(0).toUpperCase() + dia.slice(1) : "",
          `T${i+1}`, f.entrada||"—", f.salida||"—", calcHoras(f.entrada, f.salida),
          i === tramos.length-1 ? `${Math.floor(totalDia/60)}h ${totalDia%60}m` : "", ubEntrada
        ]);
      });
    });
    autoTable(pdf, {
      startY: 87,
      head: [["Fecha","Día","T.","Entrada","Salida","Horas","Total día","GPS entrada"]],
      body: rows,
      headStyles: { fillColor:[15,17,23], textColor:[0,196,255], fontStyle:"bold", fontSize:7 },
      bodyStyles: { fontSize:7, textColor:[50,50,50] },
      alternateRowStyles: { fillColor:[245,247,250] },
      columnStyles: { 0:{cellWidth:22},1:{cellWidth:12},2:{cellWidth:10},3:{cellWidth:16},4:{cellWidth:16},5:{cellWidth:16},6:{cellWidth:18},7:{cellWidth:"auto"} },
      margin: { left:14, right:14 },
    });
  }
  const totalPaginas = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150,150,150);
    pdf.text(`Página ${i} de ${totalPaginas}`, 105, 290, { align:"center" });
    pdf.text("Documento generado por ClimaPro — Registro obligatorio según RDL 8/2019", 105, 295, { align:"center" });
  }
  pdf.save(`registro_horario_${trabajador.replace(/\s/g,"_")}_${ahora.getFullYear()}.pdf`);
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
    catch (e) { setError("Email o contraseña incorrectos"); }
    setCargando(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:COLORS.bg }}>
      <div style={{ width:"100%", maxWidth:400, padding:24 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>❄</div>
          <div style={{ fontFamily:"Rajdhani", fontSize:32, fontWeight:700, color:COLORS.accent }}>ClimaPro</div>
          <div style={{ fontSize:13, color:COLORS.muted, marginTop:6 }}>Gestión de empresa</div>
        </div>
        <div className="card" style={{ padding:28 }}>
          <div style={{ display:"grid", gap:16 }}>
            <div><label>Email</label><input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
            <div><label>Contraseña</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
            {error && <div style={{ fontSize:13, color:COLORS.danger, textAlign:"center" }}>{error}</div>}
            <button className="btn btn-primary" onClick={handleLogin} disabled={cargando} style={{ width:"100%", padding:12, fontSize:14 }}>
              {cargando ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div className="card" style={{ width:"100%", maxWidth: wide ? 720 : 540, padding:24, margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontFamily:"Rajdhani", fontSize:18, fontWeight:700, color:COLORS.accent }}>{title}</span>
          <button className="btn btn-ghost" style={{ padding:"4px 10px" }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const colors = {
    Cobrado:{bg:"rgba(0,230,118,.15)",color:COLORS.green}, Enviado:{bg:"rgba(0,196,255,.15)",color:COLORS.accent},
    Borrador:{bg:"rgba(139,143,168,.15)",color:COLORS.muted}, Pendiente:{bg:"rgba(255,214,0,.15)",color:COLORS.yellow},
    "En curso":{bg:"rgba(0,196,255,.15)",color:COLORS.accent}, Completado:{bg:"rgba(0,230,118,.15)",color:COLORS.green},
    Cancelado:{bg:"rgba(255,71,87,.15)",color:COLORS.danger}, Urgente:{bg:"rgba(255,71,87,.2)",color:COLORS.danger},
    Alta:{bg:"rgba(255,107,53,.2)",color:COLORS.warm}, Media:{bg:"rgba(255,214,0,.15)",color:COLORS.yellow},
    Baja:{bg:"rgba(139,143,168,.15)",color:COLORS.muted}, Activo:{bg:"rgba(0,230,118,.15)",color:COLORS.green},
    Inactivo:{bg:"rgba(139,143,168,.15)",color:COLORS.muted},
  };
  const c = colors[estado]||{bg:"rgba(139,143,168,.15)",color:COLORS.muted};
  return <span className="badge" style={{background:c.bg,color:c.color}}>{estado}</span>;
}

function Header({ title, onAdd, addLabel }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
      <h2 style={{ fontFamily:"Rajdhani", fontSize:24, fontWeight:700 }}>{title}</h2>
      {onAdd && <button className="btn btn-primary" onClick={onAdd}>{addLabel}</button>}
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
      setProgreso(`Subiendo foto ${i+1} de ${archivos.length}...`);
      const url = await subirFoto(archivos[i]);
      urls.push(url);
    }
    setFotos(urls); setSubiendo(false); setProgreso("");
  };

  const guardar = async () => {
    setGuardando(true);
    const ahora = new Date().toISOString().split("T")[0];
    await updateDoc(doc(db, "encargos", encargo.id), {
      estado,
      notasTrabajador: notas,
      fotos,
      fechaCompletado: estado === "Completado" ? ahora : null,
    });
    setGuardando(false); onClose();
  };

  return (
    <>
      <Modal title={`✏ ${encargo.titulo}`} onClose={onClose} wide>
        <div style={{ display:"grid", gap:16 }}>
          {/* INFO ENCARGO */}
          <div style={{ background:COLORS.surface, padding:14, borderRadius:10, display:"grid", gap:6 }}>
            <div style={{ fontSize:13, color:COLORS.text, fontWeight:500 }}>{encargo.cliente}</div>
            {(encargo.direccion || encargo.localidad) && (
              <DireccionMaps direccion={encargo.direccion} localidad={encargo.localidad} />
            )}
            {encargo.telefono && (
              <a href={`tel:${encargo.telefono}`} style={{ fontSize:12, color:COLORS.accent, textDecoration:"none" }}>📱 {encargo.telefono}</a>
            )}
            {encargo.notas && <div style={{ fontSize:12, color:COLORS.muted, fontStyle:"italic" }}>📋 {encargo.notas}</div>}
          </div>

          {/* ESTADO — MÁS VISUAL */}
          <div>
            <label>Estado del encargo</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:6 }}>
              {[
                { s:"Pendiente", icon:"⏳", color:COLORS.yellow },
                { s:"En curso", icon:"🔄", color:COLORS.accent },
                { s:"Completado", icon:"✅", color:COLORS.green },
              ].map(({ s, icon, color }) => (
                <button key={s} onClick={() => setEstado(s)}
                  style={{
                    padding:"14px 8px", borderRadius:12, cursor:"pointer", border:"none",
                    background: estado===s ? color : COLORS.surface,
                    color: estado===s ? "#000" : COLORS.muted,
                    fontSize:13, fontWeight:700, fontFamily:"Inter",
                    outline: estado===s ? `3px solid ${color}` : `1px solid ${COLORS.border}`,
                    display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                    transition:"all .15s",
                    transform: estado===s ? "scale(1.04)" : "scale(1)",
                  }}>
                  <span style={{ fontSize:22 }}>{icon}</span>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* NOTAS MATERIALES */}
          <div>
            <label>⚠ Materiales o recambios que faltan</label>
            <textarea className="input" placeholder="Ej: Falta válvula de expansión, filtro G4..." value={notas}
              onChange={e => setNotas(e.target.value)} style={{ minHeight:70, resize:"vertical" }} />
          </div>

          {/* FOTOS */}
          <div>
            <label>📷 Fotos del trabajo</label>
            {fotos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, marginTop:6 }}>
                {fotos.map((url, i) => (
                  <div key={i} style={{ position:"relative" }}>
                    <img src={url} alt={`foto ${i+1}`} className="foto-thumb"
                      onClick={() => setLightbox(i)}
                      style={{ width:80, height:80, objectFit:"cover", borderRadius:8, border:`2px solid ${COLORS.border}` }} />
                    <button onClick={() => setFotos(fotos.filter((_,j)=>j!==i))}
                      style={{ position:"absolute", top:-6, right:-6, background:COLORS.danger, border:"none", borderRadius:"50%", width:20, height:20, cursor:"pointer", color:"#fff", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <label htmlFor="foto-input" className="btn btn-ghost" style={{ cursor:"pointer", margin:0 }}>
                {subiendo ? progreso : "📷 Añadir fotos"}
              </label>
              <input id="foto-input" type="file" accept="image/*" multiple style={{ display:"none" }}
                onChange={e => subirFotos(Array.from(e.target.files))} disabled={subiendo} />
              {fotos.length > 0 && <span style={{ fontSize:12, color:COLORS.muted }}>{fotos.length} foto{fotos.length!==1?"s":""} · toca para ampliar</span>}
            </div>
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando||subiendo}
              style={{ padding:"10px 24px", fontSize:14 }}>
              {guardando ? "Guardando..." : "💾 Guardar"}
            </button>
          </div>
        </div>
      </Modal>
      {lightbox !== null && <Lightbox fotos={fotos} indice={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ─── VISTA TRABAJADOR ─────────────────────────────────────────────────────────
function VistaTrabajador({ usuarioInfo, fichajes, encargos }) {
  const [fichando, setFichando] = useState(false);
  const [mensajeGPS, setMensajeGPS] = useState("");
  const [encargoSeleccionado, setEncargoSeleccionado] = useState(null);
  const hoy = new Date().toISOString().split("T")[0];

  const misFichajesHoy = fichajes
    .filter(f => f.trabajador === usuarioInfo.nombre && f.fecha === hoy)
    .sort((a, b) => (a.entrada||"").localeCompare(b.entrada||""));

  const misUltimos = fichajes.filter(f => f.trabajador === usuarioInfo.nombre).slice(0, 20);

  // Encargos: el trabajador puede estar en asignados[] o en asignado (legacy)
  // Ocultar Completados del día anterior
  const misEncargos = encargos.filter(e => {
    const asignados = Array.isArray(e.asignados) ? e.asignados : (e.asignado ? [e.asignado] : []);
    if (!asignados.includes(usuarioInfo.nombre)) return false;
    if (e.estado === "Cancelado") return false;
    // Ocultar completados de días anteriores
    if (e.estado === "Completado" && e.fechaCompletado && e.fechaCompletado < hoy) return false;
    return true;
  });

  const ultimoTramo = misFichajesHoy[misFichajesHoy.length - 1];
  const hayTramoAbierto = ultimoTramo != null && (!ultimoTramo.salida || ultimoTramo.salida === "");
  const totalHoyMins = misFichajesHoy.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);

  const ficharEntrada = async () => {
    setFichando(true); setMensajeGPS("Obteniendo ubicación...");
    const ubicacion = await obtenerUbicacion();
    setMensajeGPS(ubicacion ? "📍 Ubicación registrada" : "⚠ No se pudo obtener ubicación");
    await addDoc(collection(db, "fichajes"), {
      trabajador: usuarioInfo.nombre, fecha: hoy,
      entrada: horaActual(), salida: "", notas: "",
      tramo: misFichajesHoy.length + 1, ubicacionEntrada: ubicacion,
    });
    setFichando(false); setTimeout(() => setMensajeGPS(""), 3000);
  };

  const ficharSalida = async () => {
    if (!ultimoTramo) return;
    setFichando(true); setMensajeGPS("Obteniendo ubicación...");
    const ubicacion = await obtenerUbicacion();
    setMensajeGPS(ubicacion ? "📍 Ubicación registrada" : "⚠ No se pudo obtener ubicación");
    await updateDoc(doc(db, "fichajes", ultimoTramo.id), { salida: horaActual(), ubicacionSalida: ubicacion });
    setFichando(false); setTimeout(() => setMensajeGPS(""), 3000);
  };

  const porFecha = {};
  misUltimos.forEach(f => { if (!porFecha[f.fecha]) porFecha[f.fecha] = []; porFecha[f.fecha].push(f); });

  const colorEstado = { "Pendiente": COLORS.yellow, "En curso": COLORS.accent, "Completado": COLORS.green };

  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg }}>
      <div style={{ background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}`, padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"Rajdhani", fontSize:20, fontWeight:700, color:COLORS.accent }}>❄ ClimaPro</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:13, color:COLORS.muted }}>👷 {usuarioInfo.nombre}</span>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>

      <div style={{ padding:20, maxWidth:860, margin:"0 auto" }}>
        {/* FICHAR */}
        <div className="card" style={{ padding:24, marginBottom:20, borderTop:`3px solid ${COLORS.accent}` }}>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontFamily:"Rajdhani", fontSize:20, fontWeight:700 }}>
              {new Date().toLocaleDateString("es-ES", { weekday:"long", day:"numeric", month:"long" })}
            </div>
            {totalHoyMins > 0 && <div style={{ fontSize:13, color:COLORS.accent, marginTop:4 }}>⏱ Total hoy: {Math.floor(totalHoyMins/60)}h {totalHoyMins%60}m</div>}
          </div>
          {misFichajesHoy.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {misFichajesHoy.map((f, i) => (
                <div key={f.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", background:COLORS.surface, borderRadius:8, marginBottom:6 }}>
                  <span style={{ fontSize:12, color:COLORS.muted, minWidth:55 }}>Tramo {i+1}</span>
                  <span style={{ fontSize:13, color:COLORS.green }}>{f.entrada}</span>
                  <span style={{ color:COLORS.muted }}>→</span>
                  <span style={{ fontSize:13, color:f.salida ? COLORS.warm : COLORS.muted }}>{f.salida || "en curso..."}</span>
                  {f.salida ? <span style={{ fontSize:12, color:COLORS.accent, marginLeft:"auto" }}>{calcHoras(f.entrada, f.salida)}</span>
                    : <span className="badge" style={{ background:"rgba(0,196,255,.15)", color:COLORS.accent, marginLeft:"auto" }}>Activo</span>}
                  {f.ubicacionEntrada && <LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} />}
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            {!hayTramoAbierto && (
              <button className="btn btn-primary" style={{ padding:"14px 40px", fontSize:16, borderRadius:12 }} onClick={ficharEntrada} disabled={fichando}>
                {fichando ? "Registrando..." : misFichajesHoy.length === 0 ? "🟢 Registrar entrada" : "🟢 Inicio tramo tarde"}
              </button>
            )}
            {hayTramoAbierto && (
              <button className="btn" style={{ background:COLORS.warm, color:"#fff", padding:"14px 40px", fontSize:16, borderRadius:12 }} onClick={ficharSalida} disabled={fichando}>
                {fichando ? "Registrando..." : "🔴 Registrar salida"}
              </button>
            )}
            {mensajeGPS && <div style={{ fontSize:12, color:COLORS.muted }}>{mensajeGPS}</div>}
            {misFichajesHoy.length === 0 && !fichando && <div style={{ fontSize:12, color:COLORS.muted }}>📍 Se registrará tu ubicación al fichar</div>}
          </div>
        </div>

        {/* ENCARGOS */}
        <div className="card" style={{ padding:20, marginBottom:20 }}>
          <div style={{ fontFamily:"Rajdhani", fontWeight:700, fontSize:18, marginBottom:16, color:COLORS.warm }}>🔧 Mis encargos ({misEncargos.length})</div>
          {misEncargos.length === 0
            ? <div style={{ color:COLORS.muted, fontSize:13, textAlign:"center", padding:20 }}>Sin encargos asignados hoy</div>
            : misEncargos.map(e => {
              const estadoColor = colorEstado[e.estado] || COLORS.muted;
              return (
                <div key={e.id} style={{
                  padding:"16px", marginBottom:10, borderRadius:12,
                  background: e.estado==="Completado" ? "rgba(0,230,118,.06)" : COLORS.surface,
                  border:`1px solid ${e.estado==="Completado" ? COLORS.green+"44" : COLORS.border}`,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                        <EstadoBadge estado={e.prioridad} />
                        <span className="badge" style={{ background:`${estadoColor}22`, color:estadoColor }}>{e.estado}</span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{e.titulo}</div>
                      <div style={{ fontSize:12, color:COLORS.muted, marginBottom:4 }}>{e.cliente}</div>
                      {(e.direccion || e.localidad) && <div style={{ marginBottom:4 }}><DireccionMaps direccion={e.direccion} localidad={e.localidad} /></div>}
                      {e.telefono && <a href={`tel:${e.telefono}`} style={{ fontSize:12, color:COLORS.accent, textDecoration:"none", display:"block", marginBottom:4 }}>📱 {e.telefono}</a>}
                      {e.notasTrabajador && (
                        <div style={{ fontSize:12, color:COLORS.yellow, marginTop:6, background:"rgba(255,214,0,.08)", padding:"6px 10px", borderRadius:6 }}>
                          ⚠ {e.notasTrabajador}
                        </div>
                      )}
                      {e.fotos?.length > 0 && (
                        <div style={{ fontSize:11, color:COLORS.green, marginTop:4 }}>📷 {e.fotos.length} foto{e.fotos.length!==1?"s":""} subida{e.fotos.length!==1?"s":""}</div>
                      )}
                    </div>
                    <button
                      onClick={() => setEncargoSeleccionado(e)}
                      style={{
                        padding:"10px 16px", borderRadius:10, cursor:"pointer", border:"none",
                        background: e.estado==="Completado" ? COLORS.green : COLORS.accent,
                        color:"#000", fontSize:13, fontWeight:700, fontFamily:"Inter",
                        whiteSpace:"nowrap", flexShrink:0,
                      }}>
                      {e.estado==="Completado" ? "✅ Ver" : "✏ Gestionar"}
                    </button>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* HISTORIAL */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontFamily:"Rajdhani", fontWeight:700, fontSize:16, marginBottom:16, color:COLORS.accent }}>⏱ Mis últimos días</div>
          {Object.keys(porFecha).length === 0 ? <div style={{ color:COLORS.muted, fontSize:13 }}>Sin registros</div>
            : Object.entries(porFecha).slice(0, 5).map(([fecha, tramos]) => {
              const totalDia = tramos.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
              return (
                <div key={fecha} style={{ padding:"8px 0", borderBottom:`1px solid ${COLORS.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{fecha}</span>
                    <span style={{ fontSize:12, color:COLORS.accent }}>{Math.floor(totalDia/60)}h {totalDia%60}m</span>
                  </div>
                  {tramos.sort((a,b)=>(a.entrada||"").localeCompare(b.entrada||"")).map((f, i) => (
                    <div key={f.id} style={{ fontSize:11, color:COLORS.muted, paddingLeft:8 }}>
                      Tramo {i+1}: {f.entrada} → {f.salida||"—"} {f.salida?`(${calcHoras(f.entrada,f.salida)})` : ""}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>

      {encargoSeleccionado && <GestionarEncargo encargo={encargoSeleccionado} onClose={() => setEncargoSeleccionado(null)} />}
    </div>
  );
}

// ─── GESTIÓN USUARIOS ────────────────────────────────────────────────────────
function GestionUsuarios({ trabajadores }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", nombre:"", rol:"trabajador" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => { return onSnapshot(collection(db,"usuarios"), snap => setUsuarios(snap.docs.map(d=>({id:d.id,...d.data()})))); }, []);

  const crearUsuario = async () => {
    if (!form.email||!form.password||!form.nombre) return;
    setGuardando(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db,"usuarios",cred.user.uid), { email:form.email, nombre:form.nombre, rol:form.rol });
      setModal(false); setForm({ email:"", password:"", nombre:"", rol:"trabajador" });
    } catch(e) { setError(e.code==="auth/email-already-in-use"?"Este email ya está en uso":"Error al crear el usuario"); }
    setGuardando(false);
  };

  return (
    <div>
      <Header title="Gestión de Usuarios ☁" onAdd={() => setModal(true)} addLabel="+ Crear usuario" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {usuarios.map(u => (
          <div key={u.id} className="card" style={{ padding:20, borderLeft:`3px solid ${u.rol==="admin"?COLORS.yellow:COLORS.accent}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:28 }}>{u.rol==="admin"?"👑":"👷"}</div>
              <span className="badge" style={{ background:u.rol==="admin"?"rgba(255,214,0,.2)":"rgba(0,196,255,.15)", color:u.rol==="admin"?COLORS.yellow:COLORS.accent }}>
                {u.rol==="admin"?"Administrador":"Trabajador"}
              </span>
            </div>
            <div style={{ fontWeight:700, fontSize:15 }}>{u.nombre}</div>
            <div style={{ fontSize:12, color:COLORS.muted, marginTop:4 }}>{u.email}</div>
            <div style={{ marginTop:12 }}><button className="btn btn-danger" onClick={() => deleteDoc(doc(db,"usuarios",u.id))}>🗑 Eliminar acceso</button></div>
          </div>
        ))}
      </div>
      {modal && <Modal title="Crear usuario" onClose={() => setModal(false)}>
        <div style={{ display:"grid", gap:14 }}>
          <div><label>Trabajador</label>
            <select className="select" style={{ width:"100%" }} value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}>
              <option value="">Selecciona trabajador</option>
              {trabajadores.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>
          <div><label>Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label>Contraseña</label><input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          <div><label>Rol</label>
            <select className="select" style={{ width:"100%" }} value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>
              <option value="trabajador">Trabajador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {error && <div style={{ fontSize:13, color:COLORS.danger }}>{error}</div>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={crearUsuario} disabled={guardando}>{guardando?"Creando...":"Crear usuario"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── TRABAJADORES ────────────────────────────────────────────────────────────
function Trabajadores({ trabajadores, cargandoT }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre:"", telefono:"", email:"", cargo:"Técnico", estado:"Activo", notas:"" });

  const abrirNuevo = () => { setEditando(null); setForm({ nombre:"", telefono:"", email:"", cargo:"Técnico", estado:"Activo", notas:"" }); setModal(true); };
  const abrirEditar = (t) => { setEditando(t); setForm({ nombre:t.nombre, telefono:t.telefono||"", email:t.email||"", cargo:t.cargo||"Técnico", estado:t.estado||"Activo", notas:t.notas||"" }); setModal(true); };
  const guardar = async () => {
    if (!form.nombre) return; setGuardando(true);
    if (editando) await updateDoc(doc(db,"trabajadores",editando.id), form);
    else await addDoc(collection(db,"trabajadores"), form);
    setGuardando(false); setModal(false);
  };
  const eliminar = async (id) => { await deleteDoc(doc(db,"trabajadores",id)); setConfirmarEliminar(null); };
  const activos = trabajadores.filter(t=>t.estado!=="Inactivo");
  const inactivos = trabajadores.filter(t=>t.estado==="Inactivo");

  return (
    <div>
      <Header title="Trabajadores ☁" onAdd={abrirNuevo} addLabel="+ Añadir trabajador" />
      {cargandoT ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Cargando...</div> : trabajadores.length===0 ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Añade el primer trabajador</div> : (
        <>
          <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Activos ({activos.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14,marginBottom:28}}>
            {activos.map(t => (
              <div key={t.id} className="card" style={{padding:20,borderLeft:`3px solid ${COLORS.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div><div style={{fontSize:32,marginBottom:4}}>👷</div><div style={{fontWeight:700,fontSize:15}}>{t.nombre}</div><div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{t.cargo}</div></div>
                  <EstadoBadge estado={t.estado||"Activo"} />
                </div>
                {t.telefono&&<div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>📱 {t.telefono}</div>}
                {t.email&&<div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>✉ {t.email}</div>}
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>abrirEditar(t)}>✏ Editar</button>
                  <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(t)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          {inactivos.length>0&&<>
            <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Inactivos ({inactivos.length})</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {inactivos.map(t=>(
                <div key={t.id} className="card" style={{padding:20,opacity:0.6}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{t.nombre}</div>
                  <div style={{fontSize:12,color:COLORS.muted}}>{t.cargo}</div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>abrirEditar(t)}>✏ Editar</button>
                    <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(t)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </>
      )}
      {modal&&<Modal title={editando?"Editar Trabajador":"Nuevo Trabajador"} onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Cargo</label><select className="select" style={{width:"100%"}} value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})}>{["Técnico","Oficial","Ayudante","Jefe de obra","Administrativo","Otro"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option>Activo</option><option>Inactivo</option></select></div>
          </div>
          <div><label>Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
          <div><label>Email</label><input className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label>Notas</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":editando?"Guardar cambios":"Añadir"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="¿Eliminar?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.nombre}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>No se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
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
  const [filtroTrabajador, setFiltroTrabajador] = useState("Todos");
  const [modalPDF, setModalPDF] = useState(false);
  const [trabajadorPDF, setTrabajadorPDF] = useState("");
  const [vistaAgrupada, setVistaAgrupada] = useState(true);
  const nombresActivos = trabajadores.filter(t=>t.estado!=="Inactivo").map(t=>t.nombre);
  const todosNombres = trabajadores.map(t=>t.nombre);
  const [form, setForm] = useState({ trabajador:nombresActivos[0]||"", fecha:new Date().toISOString().split("T")[0], entrada:"08:00", salida:"", notas:"" });

  useEffect(() => { if (nombresActivos.length>0&&!form.trabajador) setForm(f=>({...f,trabajador:nombresActivos[0]})); }, [trabajadores]);

  const guardar = async () => {
    if (!form.trabajador||!form.fecha||!form.entrada) return;
    setGuardando(true); await addDoc(collection(db,"fichajes"), form); setGuardando(false); setModal(false);
  };
  const eliminar = async (id) => { await deleteDoc(doc(db,"fichajes",id)); setConfirmarEliminar(null); };
  const registrarSalida = async (f) => { await updateDoc(doc(db,"fichajes",f.id), { salida: horaActual() }); };

  const lista = fichajes.filter(f=>filtroTrabajador==="Todos"||f.trabajador===filtroTrabajador).filter(f=>!filtroFecha||f.fecha===filtroFecha);
  const horasTotal = lista.reduce((s,f)=>s+calcMinutos(f.entrada,f.salida),0);
  const grupos = {};
  lista.forEach(f => {
    const clave = `${f.trabajador}__${f.fecha}`;
    if (!grupos[clave]) grupos[clave] = { trabajador:f.trabajador, fecha:f.fecha, tramos:[], totalMins:0 };
    grupos[clave].tramos.push(f); grupos[clave].totalMins += calcMinutos(f.entrada, f.salida);
  });
  const listaAgrupada = Object.values(grupos).sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.trabajador.localeCompare(b.trabajador));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontFamily:"Rajdhani",fontSize:24,fontWeight:700}}>Control Horario ☁</h2>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={()=>setVistaAgrupada(!vistaAgrupada)} style={{fontSize:12}}>{vistaAgrupada?"Vista detallada":"Vista agrupada"}</button>
          <button className="btn btn-ghost" onClick={()=>{setTrabajadorPDF(todosNombres[0]||"");setModalPDF(true);}}>📄 PDF 4 años</button>
          <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar fichaje</button>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <select className="select" value={filtroTrabajador} onChange={e=>setFiltroTrabajador(e.target.value)}>
          <option value="Todos">Todos los trabajadores</option>
          {nombresActivos.map(t=><option key={t}>{t}</option>)}
        </select>
        <input className="input" type="date" style={{width:"auto"}} value={filtroFecha} onChange={e=>setFiltroFecha(e.target.value)} />
        {filtroFecha&&<button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setFiltroFecha("")}>✕ Limpiar</button>}
        <span style={{marginLeft:"auto",fontFamily:"Rajdhani",fontSize:14,fontWeight:700,color:COLORS.accent}}>Total: {Math.floor(horasTotal/60)}h {horasTotal%60}m</span>
      </div>
      {vistaAgrupada ? (
        <div style={{display:"grid",gap:12}}>
          {listaAgrupada.length===0 ? <div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>No hay fichajes</div>
            : listaAgrupada.map(g => (
              <div key={`${g.trabajador}__${g.fecha}`} className="card" style={{padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div><span style={{fontWeight:600,fontSize:14}}>{g.trabajador}</span><span style={{fontSize:13,color:COLORS.muted,marginLeft:12}}>{g.fecha}</span></div>
                  <span style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,color:COLORS.accent}}>{Math.floor(g.totalMins/60)}h {g.totalMins%60}m total</span>
                </div>
                <div style={{display:"grid",gap:6}}>
                  {g.tramos.sort((a,b)=>(a.entrada||"").localeCompare(b.entrada||"")).map((f,i)=>(
                    <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px",background:COLORS.surface,borderRadius:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,color:COLORS.muted,minWidth:55}}>Tramo {i+1}</span>
                      <span style={{fontSize:13,color:COLORS.green}}>{f.entrada}</span>
                      <span style={{color:COLORS.muted}}>→</span>
                      <span style={{fontSize:13,color:f.salida?COLORS.warm:COLORS.muted}}>{f.salida||<button className="btn btn-primary" style={{fontSize:11,padding:"2px 8px"}} onClick={()=>registrarSalida(f)}>Registrar salida</button>}</span>
                      {f.salida&&<span style={{fontSize:12,color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</span>}
                      {f.ubicacionEntrada&&<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} precision={f.ubicacionEntrada.precision} />}
                      {f.ubicacionSalida&&<a href={`https://www.google.com/maps?q=${f.ubicacionSalida.lat},${f.ubicacionSalida.lng}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:COLORS.warm,textDecoration:"none"}}>📍 salida</a>}
                      <button className="btn btn-danger" style={{marginLeft:"auto"}} onClick={()=>setConfirmarEliminar(f)}>🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="card" style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Trabajador","Fecha","Entrada","GPS","Salida","Horas",""].map((h,i)=><th key={i} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{lista.map(f=>(
              <tr key={f.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
                <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{f.trabajador}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{f.fecha}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.green}}>{f.entrada}</td>
                <td style={{padding:"12px 16px"}}>{f.ubicacionEntrada?<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} precision={f.ubicacionEntrada.precision} />:<span style={{fontSize:11,color:COLORS.muted}}>—</span>}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:f.salida?COLORS.warm:COLORS.muted}}>{f.salida||<button className="btn btn-primary" style={{fontSize:11,padding:"3px 10px"}} onClick={()=>registrarSalida(f)}>Registrar salida</button>}</td>
                <td style={{padding:"12px 16px",fontSize:13,fontFamily:"Rajdhani",fontWeight:600,color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</td>
                <td style={{padding:"12px 16px"}}><button className="btn btn-danger" onClick={()=>setConfirmarEliminar(f)}>🗑</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {modalPDF&&<Modal title="📄 PDF — Últimos 4 años" onClose={()=>setModalPDF(false)}>
        <div style={{display:"grid",gap:16}}>
          <div><label>Trabajador</label><select className="select" style={{width:"100%"}} value={trabajadorPDF} onChange={e=>setTrabajadorPDF(e.target.value)}>{todosNombres.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModalPDF(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={()=>{generarPDFHorario(trabajadorPDF,fichajes);setModalPDF(false);}}>📥 Descargar</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="¿Eliminar tramo?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.trabajador} — {confirmarEliminar.fecha}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>No se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
      {modal&&<Modal title="Registrar Fichaje" onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:16}}>
          <div><label>Trabajador</label><select className="select" style={{width:"100%"}} value={form.trabajador} onChange={e=>setForm({...form,trabajador:e.target.value})}>{nombresActivos.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
            <div><label>Entrada</label><input className="input" type="time" value={form.entrada} onChange={e=>setForm({...form,entrada:e.target.value})} /></div>
          </div>
          <div><label>Salida (opcional)</label><input className="input" type="time" value={form.salida} onChange={e=>setForm({...form,salida:e.target.value})} /></div>
          <div><label>Notas</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":"Guardar ☁"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── ENCARGOS (admin) ─────────────────────────────────────────────────────────
function Encargos({ trabajadores }) {
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

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroTrabajador, setFiltroTrabajador] = useState("");
  const [filtroLocalidad, setFiltroLocalidad] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  const nombresActivos = trabajadores.filter(t=>t.estado!=="Inactivo").map(t=>t.nombre);
  const emptyForm = { titulo:"", cliente:"", asignados:[], prioridad:"Media", estado:"Pendiente", fecha:"", notas:"", localidad:"", direccion:"", telefono:"", archivado:false };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const q = query(collection(db,"encargos"), orderBy("fecha","desc"));
    return onSnapshot(q, snap => { setEncargos(snap.docs.map(d=>({id:d.id,...d.data()}))); setCargando(false); });
  }, []);

  const limpiarFiltros = () => { setFiltroEstado("Todos"); setFiltroFechaDesde(""); setFiltroFechaHasta(""); setFiltroTrabajador(""); setFiltroLocalidad(""); setFiltroBusqueda(""); };
  const hayFiltros = filtroEstado!=="Todos"||filtroFechaDesde||filtroFechaHasta||filtroTrabajador||filtroLocalidad||filtroBusqueda;

  const lista = encargos
    .filter(e => vistaArchivados ? e.archivado : !e.archivado)
    .filter(e => filtroEstado==="Todos" || e.estado===filtroEstado)
    .filter(e => !filtroFechaDesde || e.fecha>=filtroFechaDesde)
    .filter(e => !filtroFechaHasta || e.fecha<=filtroFechaHasta)
    .filter(e => !filtroTrabajador || (Array.isArray(e.asignados)?e.asignados.includes(filtroTrabajador):e.asignado===filtroTrabajador))
    .filter(e => !filtroLocalidad || (e.localidad||"").toLowerCase().includes(filtroLocalidad.toLowerCase()))
    .filter(e => !filtroBusqueda || e.titulo?.toLowerCase().includes(filtroBusqueda.toLowerCase()) || e.cliente?.toLowerCase().includes(filtroBusqueda.toLowerCase()));

  const abrirNuevo = () => { setEditando(null); setForm(emptyForm); setModal(true); };
  const abrirEditar = (e) => {
    setEditando(e);
    const asignados = Array.isArray(e.asignados) ? e.asignados : (e.asignado ? [e.asignado] : []);
    setForm({ titulo:e.titulo, cliente:e.cliente, asignados, prioridad:e.prioridad, estado:e.estado, fecha:e.fecha, notas:e.notas||"", localidad:e.localidad||"", direccion:e.direccion||"", telefono:e.telefono||"", archivado:e.archivado||false });
    setModal(true);
  };
  const guardar = async () => {
    if (!form.titulo) return; setGuardando(true);
    const datos = { ...form, asignado: form.asignados[0] || "" }; // compatibilidad legacy
    if (editando) await updateDoc(doc(db,"encargos",editando.id), datos);
    else await addDoc(collection(db,"encargos"), datos);
    setGuardando(false); setModal(false);
  };
  const eliminar = async (id) => { await deleteDoc(doc(db,"encargos",id)); setConfirmarEliminar(null); };
  const cambiarEstado = async (id, estado) => {
    const ahora = new Date().toISOString().split("T")[0];
    await updateDoc(doc(db,"encargos",id), { estado, fechaCompletado: estado==="Completado" ? ahora : null });
  };
  const archivar = async (id, archivado) => { await updateDoc(doc(db,"encargos",id), { archivado }); };
  const archivarTodosCompletados = async () => {
    const completados = encargos.filter(e=>e.estado==="Completado"&&!e.archivado);
    for (const e of completados) await updateDoc(doc(db,"encargos",e.id), { archivado:true });
  };

  const toggleAsignado = (nombre) => {
    const actual = form.asignados || [];
    setForm({ ...form, asignados: actual.includes(nombre) ? actual.filter(n=>n!==nombre) : [...actual, nombre] });
  };

  const importarSmartsheet = async (archivo) => {
    setImportando(true); setResultadoImport(null);
    try {
      const buffer = await archivo.arrayBuffer();
      const wb = XLSX.read(buffer, { type:"array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(ws, { defval:"" });
      let importados = 0, saltados = 0;
      for (const fila of filas) {
        const titulo = String(fila["ENCÀRREC / COMENTARI"] || fila["ENCARGO"] || "").trim();
        const cliente = String(fila["CLIENT"] || fila["CLIENTE"] || "").trim();
        const fecha = parsearFecha(fila["DATA"] || fila["FECHA"] || "");
        const asignado = String(fila["ASSIGNAT"] || fila["ASIGNADO"] || "").trim();
        const localidad = String(fila["Localitat"] || fila["Localidad"] || "").trim();
        const direccion = String(fila["DIRECCIÓ"] || fila["DIRECCION"] || "").trim();
        const telefono = String(fila["TELÈFON"] || fila["TELÉFONO"] || "").trim();
        const notas = String(fila["Comentarios"] || "").trim();
        if (!titulo && !cliente) { saltados++; continue; }
        await addDoc(collection(db,"encargos"), {
          titulo: titulo || `Encargo ${cliente}`, cliente, asignados: asignado ? [asignado] : [],
          asignado, localidad, direccion, telefono, notas, fecha, prioridad:"Media", estado:"Pendiente", archivado:false
        });
        importados++;
      }
      setResultadoImport({ importados, saltados });
    } catch(e) { setResultadoImport({ error: "No se pudo leer el archivo." }); }
    setImportando(false);
  };

  return (
    <div>
      {/* CABECERA */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontFamily:"Rajdhani",fontSize:24,fontWeight:700}}>Encargos ☁</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setVistaArchivados(!vistaArchivados)}>
            {vistaArchivados ? "📋 Ver activos" : "📦 Ver archivados"}
          </button>
          {!vistaArchivados && (
            <button className="btn btn-ghost" style={{fontSize:12}} onClick={archivarTodosCompletados}>
              ✅ Archivar completados
            </button>
          )}
          <label className="btn btn-ghost" style={{cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>
            {importando ? "⏳ Importando..." : "📊 Importar Smartsheet"}
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&importarSmartsheet(e.target.files[0])} disabled={importando} />
          </label>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo encargo</button>
        </div>
      </div>

      {resultadoImport && (
        <div style={{marginBottom:12,padding:12,borderRadius:10,background:resultadoImport.error?"rgba(255,71,87,.1)":"rgba(0,230,118,.1)",border:`1px solid ${resultadoImport.error?COLORS.danger:COLORS.green}`}}>
          {resultadoImport.error ? <span style={{color:COLORS.danger,fontSize:13}}>❌ {resultadoImport.error}</span>
            : <span style={{color:COLORS.green,fontSize:13}}>✅ {resultadoImport.importados} importados · {resultadoImport.saltados} saltados</span>}
          <button className="btn btn-ghost" style={{fontSize:11,padding:"2px 8px",marginLeft:12}} onClick={()=>setResultadoImport(null)}>✕</button>
        </div>
      )}

      {/* FILTROS ESTADO */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {["Todos",...ESTADOS_ENCARGO].map(f=>(
          <button key={f} className="btn" onClick={()=>setFiltroEstado(f)}
            style={{background:filtroEstado===f?COLORS.accent:COLORS.surface,color:filtroEstado===f?"#000":COLORS.muted,border:`1px solid ${filtroEstado===f?COLORS.accent:COLORS.border}`,fontSize:12}}>
            {f}
          </button>
        ))}
      </div>

      {/* FILTROS AVANZADOS */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center",padding:"10px 14px",background:COLORS.surface,borderRadius:10,border:`1px solid ${COLORS.border}`}}>
        <input className="input" type="date" style={{width:"auto",fontSize:12}} value={filtroFechaDesde} onChange={e=>setFiltroFechaDesde(e.target.value)} />
        <span style={{color:COLORS.muted,fontSize:12}}>→</span>
        <input className="input" type="date" style={{width:"auto",fontSize:12}} value={filtroFechaHasta} onChange={e=>setFiltroFechaHasta(e.target.value)} />
        <input className="input" placeholder="📍 Localidad..." style={{width:130,fontSize:12}} value={filtroLocalidad} onChange={e=>setFiltroLocalidad(e.target.value)} />
        <select className="select" style={{fontSize:12,padding:"9px 10px"}} value={filtroTrabajador} onChange={e=>setFiltroTrabajador(e.target.value)}>
          <option value="">👷 Todos</option>
          {nombresActivos.map(t=><option key={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="🔍 Buscar..." style={{flex:1,minWidth:140,fontSize:12}} value={filtroBusqueda} onChange={e=>setFiltroBusqueda(e.target.value)} />
        {hayFiltros && <button className="btn btn-ghost" style={{fontSize:12}} onClick={limpiarFiltros}>✕</button>}
        <span style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:14,color:COLORS.accent,whiteSpace:"nowrap"}}>{lista.length} enc.</span>
      </div>

      {/* LISTA */}
      {cargando ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Cargando...</div> : (
        <div style={{display:"grid",gap:10}}>
          {lista.length===0
            ? <div className="card" style={{padding:40,textAlign:"center",color:COLORS.muted}}>{vistaArchivados?"No hay encargos archivados":hayFiltros?"Sin resultados con estos filtros":"No hay encargos"}</div>
            : lista.map(e=>{
              const asignados = Array.isArray(e.asignados) ? e.asignados : (e.asignado ? [e.asignado] : []);
              return (
                <div key={e.id} className="card" style={{padding:16, opacity: e.archivado?0.7:1 }}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                        <EstadoBadge estado={e.prioridad}/><EstadoBadge estado={e.estado}/>
                        {e.notasTrabajador && <span className="badge" style={{background:"rgba(255,214,0,.15)",color:COLORS.yellow}}>⚠ Falta material</span>}
                        {e.fotos?.length > 0 && <span className="badge" style={{background:"rgba(0,230,118,.15)",color:COLORS.green}}>📷 {e.fotos.length}</span>}
                        {e.archivado && <span className="badge" style={{background:"rgba(139,143,168,.15)",color:COLORS.muted}}>📦 Archivado</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{e.titulo}</div>
                      <div style={{fontSize:12,color:COLORS.muted,marginBottom:2}}>
                        {e.cliente}{asignados.length>0?` · 👷 ${asignados.join(", ")}`:""}{e.fecha?` · ${e.fecha}`:""}
                      </div>
                      {(e.direccion || e.localidad) && <div style={{marginBottom:2}}><DireccionMaps direccion={e.direccion} localidad={e.localidad} /></div>}
                      {e.telefono && <div style={{fontSize:12,color:COLORS.muted}}>📱 {e.telefono}</div>}
                      {e.notasTrabajador && <div style={{fontSize:12,color:COLORS.yellow,marginTop:6,background:"rgba(255,214,0,.08)",padding:"5px 10px",borderRadius:6}}>⚠ {e.notasTrabajador}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                      <select className="select" style={{fontSize:12,padding:"4px 7px"}} value={e.estado} onChange={ev=>cambiarEstado(e.id,ev.target.value)}>
                        {ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}
                      </select>
                      <div style={{display:"flex",gap:5}}>
                        {(e.fotos?.length>0||e.notasTrabajador) && <button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>setVerDetalle(e)}>🔍</button>}
                        <button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>abrirEditar(e)}>✏</button>
                        <button className="btn btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>archivar(e.id,!e.archivado)} title={e.archivado?"Restaurar":"Archivar"}>
                          {e.archivado?"📤":"📦"}
                        </button>
                        <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(e)}>🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* MODAL VER DETALLE */}
      {verDetalle && (
        <Modal title={`Detalle: ${verDetalle.titulo}`} onClose={()=>setVerDetalle(null)} wide>
          <div style={{display:"grid",gap:16}}>
            {verDetalle.notasTrabajador && (
              <div>
                <label>⚠ Materiales que faltan</label>
                <div style={{background:"rgba(255,214,0,.08)",border:`1px solid ${COLORS.yellow}33`,borderRadius:8,padding:12,fontSize:13,color:COLORS.yellow}}>{verDetalle.notasTrabajador}</div>
              </div>
            )}
            {verDetalle.fotos?.length > 0 && (
              <div>
                <label>📷 Fotos ({verDetalle.fotos.length}) — toca para ampliar</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginTop:8}}>
                  {verDetalle.fotos.map((url,i)=>(
                    <img key={i} src={url} alt={`foto ${i+1}`} className="foto-thumb"
                      onClick={()=>setLightboxAdmin(i)}
                      style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8,border:`2px solid ${COLORS.border}`}} />
                  ))}
                </div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setVerDetalle(null)}>Cerrar</button></div>
          </div>
        </Modal>
      )}
      {lightboxAdmin !== null && verDetalle && <Lightbox fotos={verDetalle.fotos} indice={lightboxAdmin} onClose={()=>setLightboxAdmin(null)} />}

      {/* MODAL EDITAR/CREAR */}
      {modal && <Modal title={editando?"Editar Encargo":"Nuevo Encargo"} onClose={()=>setModal(false)} wide>
        <div style={{display:"grid",gap:14}}>
          <div><label>Título *</label><input className="input" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Cliente</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
            <div><label>Fecha prevista</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Localidad</label><input className="input" value={form.localidad} onChange={e=>setForm({...form,localidad:e.target.value})} /></div>
            <div><label>Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
          </div>
          <div><label>Dirección</label><input className="input" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} /></div>

          {/* MÚLTIPLES TRABAJADORES */}
          <div>
            <label>👷 Trabajadores asignados</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
              {nombresActivos.map(nombre => {
                const sel = (form.asignados||[]).includes(nombre);
                return (
                  <button key={nombre} type="button" onClick={()=>toggleAsignado(nombre)}
                    style={{ padding:"6px 14px", borderRadius:20, cursor:"pointer", border:"none", fontFamily:"Inter", fontSize:12, fontWeight:500,
                      background: sel ? COLORS.accent : COLORS.surface,
                      color: sel ? "#000" : COLORS.muted,
                      outline: sel ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}` }}>
                    {sel ? "✓ " : ""}{nombre}
                  </button>
                );
              })}
            </div>
            {(form.asignados||[]).length > 0 && (
              <div style={{fontSize:11,color:COLORS.muted,marginTop:6}}>Asignado a: {form.asignados.join(", ")}</div>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Prioridad</label><select className="select" style={{width:"100%"}} value={form.prioridad} onChange={e=>setForm({...form,prioridad:e.target.value})}>{["Baja","Media","Alta","Urgente"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label>Notas para el trabajador</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":editando?"Guardar cambios":"Crear encargo"}</button>
          </div>
        </div>
      </Modal>}

      {confirmarEliminar&&<Modal title="¿Eliminar encargo?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.titulo}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>No se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
    </div>
  );
}

// ─── ALBARANES ───────────────────────────────────────────────────────────────
function Albaranes({ albaranes }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState("Todos");
  const emptyForm = { numero:"", cliente:"", fecha:new Date().toISOString().split("T")[0], importe:"", estado:"Borrador", descripcion:"" };
  const [form, setForm] = useState(emptyForm);

  const abrirNuevo = () => { setEditando(null); setForm(emptyForm); setModal(true); };
  const abrirEditar = (a) => { setEditando(a); setForm({ numero:a.numero, cliente:a.cliente, fecha:a.fecha, importe:String(a.importe), estado:a.estado, descripcion:a.descripcion||"" }); setModal(true); };
  const guardar = async () => {
    if (!form.cliente) return; setGuardando(true);
    const nextNum = `ALB-${new Date().getFullYear()}-${String(albaranes.length+1).padStart(3,"0")}`;
    const datos = { ...form, importe: Number(form.importe), numero: form.numero || nextNum };
    if (editando) await updateDoc(doc(db,"albaranes",editando.id), datos);
    else await addDoc(collection(db,"albaranes"), datos);
    setGuardando(false); setModal(false);
  };
  const eliminar = async (id) => { await deleteDoc(doc(db,"albaranes",id)); setConfirmarEliminar(null); };
  const cambiarEstado = async (id, estado) => { await updateDoc(doc(db,"albaranes",id), { estado }); };
  const lista = filtro==="Todos" ? albaranes : albaranes.filter(a=>a.estado===filtro);
  const total = lista.reduce((s,a)=>s+a.importe, 0);

  return (
    <div>
      <Header title="Albaranes ☁" onAdd={abrirNuevo} addLabel="+ Nuevo albarán" />
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["Todos",...ESTADOS_ALBARAN].map(f=><button key={f} className="btn" onClick={()=>setFiltro(f)} style={{background:filtro===f?COLORS.accent:COLORS.surface,color:filtro===f?"#000":COLORS.muted,border:`1px solid ${filtro===f?COLORS.accent:COLORS.border}`,fontSize:12}}>{f}</button>)}
        <span style={{marginLeft:"auto",alignSelf:"center",fontSize:14,fontFamily:"Rajdhani",fontWeight:700,color:COLORS.green}}>Total: {total.toLocaleString()}€</span>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        {lista.length===0 ? <div style={{padding:40,textAlign:"center",color:COLORS.muted}}>No hay albaranes</div> : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Número","Cliente","Descripción","Fecha","Importe","Estado",""].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{lista.map(a=>(
              <tr key={a.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
                <td style={{padding:"12px 16px",fontSize:13,fontFamily:"Rajdhani",fontWeight:600,color:COLORS.accent}}>{a.numero}</td>
                <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{a.cliente}</td>
                <td style={{padding:"12px 16px",fontSize:12,color:COLORS.muted,maxWidth:200}}>{a.descripcion}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{a.fecha}</td>
                <td style={{padding:"12px 16px",fontSize:14,fontFamily:"Rajdhani",fontWeight:700,color:COLORS.green}}>{a.importe.toLocaleString()}€</td>
                <td style={{padding:"12px 16px"}}><select className="select" style={{fontSize:12,padding:"4px 8px"}} value={a.estado} onChange={ev=>cambiarEstado(a.id,ev.target.value)}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></td>
                <td style={{padding:"12px 16px"}}><div style={{display:"flex",gap:6}}><button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>abrirEditar(a)}>✏</button><button className="btn btn-danger" onClick={()=>setConfirmarEliminar(a)}>🗑</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {modal&&<Modal title={editando?"Editar Albarán":"Nuevo Albarán"} onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Nº Albarán</label><input className="input" placeholder="Auto si vacío" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
            <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div><label>Cliente *</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
          <div><label>Descripción</label><input className="input" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Importe (€)</label><input className="input" type="number" value={form.importe} onChange={e=>setForm({...form,importe:e.target.value})} /></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":editando?"Guardar cambios":"Crear albarán"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar&&<Modal title="¿Eliminar albarán?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.numero} — {confirmarEliminar.cliente}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>No se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
    </div>
  );
}

// ─── MANUALES ────────────────────────────────────────────────────────────────
function Manuales({ onManualesChange }) {
  const [manuales, setManuales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [marcaAbierta, setMarcaAbierta] = useState(null);
  const [tipoAbierto, setTipoAbierto] = useState(null);
  const [form, setForm] = useState({titulo:"",marca:"",tipo:"Instalación",url:"",fecha:new Date().toISOString().split("T")[0]});

  useEffect(() => {
    const q=query(collection(db,"manuales"),orderBy("fecha","desc"));
    return onSnapshot(q,snap=>{const d=snap.docs.map(x=>({id:x.id,...x.data()}));setManuales(d);onManualesChange(d);setCargando(false);});
  },[]);

  const guardar=async()=>{if(!form.titulo||!form.marca)return;setGuardando(true);await addDoc(collection(db,"manuales"),form);setGuardando(false);setModal(false);setForm({titulo:"",marca:"",tipo:"Instalación",url:"",fecha:new Date().toISOString().split("T")[0]});};
  const eliminar=async(id)=>{await deleteDoc(doc(db,"manuales",id));setConfirmarEliminar(null);};
  const tipoColor={Instalación:COLORS.accent,Mantenimiento:COLORS.green,Técnico:COLORS.warm,Protocolo:COLORS.yellow,Otro:COLORS.muted};
  const porMarca={};
  const lf=buscar?manuales.filter(m=>m.titulo.toLowerCase().includes(buscar.toLowerCase())||m.marca.toLowerCase().includes(buscar.toLowerCase())):manuales;
  lf.forEach(m=>{if(!porMarca[m.marca])porMarca[m.marca]={};if(!porMarca[m.marca][m.tipo])porMarca[m.marca][m.tipo]=[];porMarca[m.marca][m.tipo].push(m);});
  const marcas=Object.keys(porMarca).sort();

  return (
    <div>
      <Header title="Biblioteca de Manuales ☁" onAdd={()=>setModal(true)} addLabel="+ Añadir manual" />
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <input className="input" placeholder="🔍 Buscar..." value={buscar} onChange={e=>{setBuscar(e.target.value);setMarcaAbierta(null);setTipoAbierto(null);}} style={{maxWidth:400}} />
      </div>
      {cargando?<div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Cargando...</div>:marcas.length===0?<div style={{color:COLORS.muted,textAlign:"center",padding:40}}>{buscar?"Sin resultados":"Añade el primer manual"}</div>:buscar?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {lf.map(m=><div key={m.id} className="card" style={{padding:18,borderTop:`3px solid ${tipoColor[m.tipo]||COLORS.muted}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span className="badge" style={{background:`${tipoColor[m.tipo]}22`,color:tipoColor[m.tipo]||COLORS.muted}}>{m.tipo}</span><span style={{fontSize:11,color:COLORS.muted}}>{m.marca}</span></div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{m.titulo}</div>
            <div style={{display:"flex",gap:8}}>
              {m.url&&m.url!=="#"&&<a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:COLORS.accent,textDecoration:"none",border:`1px solid ${COLORS.accent}33`,padding:"5px 12px",borderRadius:6}}>📥 Ver</a>}
              <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(m)}>🗑</button>
            </div>
          </div>)}
        </div>
      ):(
        <div className="card" style={{padding:8}}>
          {marcas.map(marca=>{
            const mo=marcaAbierta===marca;const tipos=Object.keys(porMarca[marca]).sort();const tot=Object.values(porMarca[marca]).reduce((s,a)=>s+a.length,0);
            return <div key={marca}>
              <div className="folder-row" onClick={()=>{setMarcaAbierta(mo?null:marca);setTipoAbierto(null);}}>
                <span style={{fontSize:18}}>{mo?"📂":"📁"}</span><span style={{fontWeight:600,fontSize:14,flex:1}}>{marca}</span>
                <span style={{fontSize:12,color:COLORS.muted}}>{tot} manual{tot!==1?"es":""}</span><span style={{color:COLORS.muted,fontSize:12,marginLeft:8}}>{mo?"▲":"▼"}</span>
              </div>
              {mo&&<div style={{paddingLeft:24}}>{tipos.map(tipo=>{
                const to=tipoAbierto===`${marca}-${tipo}`;const items=porMarca[marca][tipo];
                return <div key={tipo}>
                  <div className="folder-row" onClick={()=>setTipoAbierto(to?null:`${marca}-${tipo}`)}>
                    <span style={{fontSize:16}}>{to?"📂":"📁"}</span><span style={{fontSize:13,flex:1,color:tipoColor[tipo]||COLORS.muted}}>{tipo}</span>
                    <span style={{fontSize:12,color:COLORS.muted}}>{items.length} manual{items.length!==1?"es":""}</span><span style={{color:COLORS.muted,fontSize:12,marginLeft:8}}>{to?"▲":"▼"}</span>
                  </div>
                  {to&&<div style={{paddingLeft:24}}>{items.map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderRadius:8,borderBottom:`1px solid ${COLORS.border}`}}>
                      <span style={{fontSize:16}}>📄</span>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.titulo}</div><div style={{fontSize:11,color:COLORS.muted,marginTop:2}}>{m.fecha}</div></div>
                      <div style={{display:"flex",gap:8}}>
                        {m.url&&m.url!=="#"&&<a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:COLORS.accent,textDecoration:"none",border:`1px solid ${COLORS.accent}33`,padding:"4px 10px",borderRadius:6}}>📥 Ver</a>}
                        <button className="btn btn-danger" onClick={()=>setConfirmarEliminar(m)}>🗑</button>
                      </div>
                    </div>
                  ))}</div>}
                </div>;
              })}</div>}
            </div>;
          })}
        </div>
      )}
      {confirmarEliminar&&<Modal title="¿Eliminar?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.titulo}</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
      {modal&&<Modal title="Añadir Manual" onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Título *</label><input className="input" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Marca *</label><input className="input" value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} /></div>
            <div><label>Tipo</label><select className="select" style={{width:"100%"}} value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>{["Instalación","Mantenimiento","Técnico","Protocolo","Otro"].map(t=><option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label>URL</label><input className="input" placeholder="https://..." value={form.url} onChange={e=>setForm({...form,url:e.target.value})} /></div>
          <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":"Guardar ☁"}</button></div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ encargos, fichajes, trabajadores, albaranes }) {
  const hoy=new Date().toISOString().split("T")[0];
  const fichajesHoy=[...new Set(fichajes.filter(f=>f.fecha===hoy).map(f=>f.trabajador))].length;
  const encargosActivos=encargos.filter(e=>!e.archivado&&(e.estado==="En curso"||e.estado==="Pendiente")).length;
  const materialFaltante=encargos.filter(e=>e.notasTrabajador&&e.estado!=="Completado"&&!e.archivado).length;
  const totalFacturado=albaranes.filter(a=>a.estado==="Cobrado").reduce((s,a)=>s+a.importe,0);
  const stats=[
    {label:"Trabajadores activos",value:trabajadores.filter(t=>t.estado!=="Inactivo").length,color:COLORS.accent,icon:"👷"},
    {label:"Fichados hoy",value:fichajesHoy,color:COLORS.green,icon:"⏱"},
    {label:"Encargos activos",value:encargosActivos,color:COLORS.warm,icon:"🔧"},
    {label:"⚠ Falta material",value:materialFaltante,color:COLORS.yellow,icon:"📦"},
  ];
  const urgentes=encargos.filter(e=>e.prioridad==="Urgente"&&e.estado!=="Completado"&&!e.archivado);
  const conMaterial=encargos.filter(e=>e.notasTrabajador&&e.estado!=="Completado"&&!e.archivado);
  const fichajesHoyList=fichajes.filter(f=>f.fecha===hoy).slice(0,6);

  return (
    <div>
      <div style={{fontFamily:"Rajdhani",fontSize:28,fontWeight:700,marginBottom:24}}>Panel de Control <span style={{color:COLORS.accent}}>ClimaPro</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:28}}>
        {stats.map(s=><div key={s.label} className="card" style={{padding:20,borderLeft:`3px solid ${s.color}`}}>
          <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
          <div style={{fontSize:28,fontWeight:700,fontFamily:"Rajdhani",color:s.color}}>{s.value}</div>
          <div style={{fontSize:12,color:COLORS.muted,marginTop:4}}>{s.label}</div>
        </div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,marginBottom:16,color:COLORS.accent}}>⏱ Fichajes de hoy</div>
          {fichajesHoyList.length===0?<div style={{color:COLORS.muted,fontSize:13}}>Sin fichajes hoy</div>:fichajesHoyList.map(f=>(
            <div key={f.id} style={{padding:"6px 0",borderBottom:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:500}}>{f.trabajador}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,color:COLORS.muted}}>{f.entrada} → {f.salida||"..."}</span>
                {f.ubicacionEntrada&&<LinkMapa lat={f.ubicacionEntrada.lat} lng={f.ubicacionEntrada.lng} />}
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,marginBottom:16,color:COLORS.warm}}>⚠ Encargos Urgentes</div>
          {urgentes.length===0?<div style={{color:COLORS.muted,fontSize:13}}>Sin encargos urgentes</div>:urgentes.map(e=>(
            <div key={e.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.titulo}</div>
              <div style={{fontSize:12,color:COLORS.muted,marginTop:3}}>
                {(Array.isArray(e.asignados)?e.asignados.join(", "):e.asignado)||"Sin asignar"} · {e.localidad||e.fecha}
              </div>
            </div>
          ))}
        </div>
      </div>
      {conMaterial.length > 0 && (
        <div className="card" style={{padding:20,borderLeft:`3px solid ${COLORS.yellow}`}}>
          <div style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,marginBottom:16,color:COLORS.yellow}}>📦 Material pendiente</div>
          {conMaterial.map(e=>(
            <div key={e.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.titulo} <span style={{fontSize:12,color:COLORS.muted}}>— {Array.isArray(e.asignados)?e.asignados.join(", "):e.asignado}</span></div>
              <div style={{fontSize:12,color:COLORS.yellow,marginTop:3}}>⚠ {e.notasTrabajador}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  {id:"dashboard",label:"Dashboard",icon:"⬛"},
  {id:"usuarios",label:"Usuarios",icon:"👑"},
  {id:"trabajadores",label:"Trabajadores",icon:"👷"},
  {id:"fichajes",label:"Control Horario",icon:"⏱"},
  {id:"encargos",label:"Encargos",icon:"🔧"},
  {id:"albaranes",label:"Albaranes",icon:"📄"},
  {id:"manuales",label:"Manuales",icon:"📚"},
];

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [manuales, setManuales] = useState([]);
  const [fichajes, setFichajes] = useState([]);
  const [encargos, setEncargos] = useState([]);
  const [albaranes, setAlbaranes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [cargandoT, setCargandoT] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUsuario(u);
        const snap = await getDoc(doc(db,"usuarios",u.uid));
        if (snap.exists()) setUsuarioInfo(snap.data());
      } else { setUsuario(null); setUsuarioInfo(null); }
      setCargandoAuth(false);
    });
  }, []);

  useEffect(() => {
    const q=query(collection(db,"fichajes"),orderBy("fecha","desc"));
    return onSnapshot(q,snap=>setFichajes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  useEffect(() => {
    const q=query(collection(db,"trabajadores"),orderBy("nombre"));
    return onSnapshot(q,snap=>{setTrabajadores(snap.docs.map(d=>({id:d.id,...d.data()})));setCargandoT(false);});
  }, []);

  useEffect(() => {
    const q=query(collection(db,"encargos"),orderBy("fecha","desc"));
    return onSnapshot(q,snap=>setEncargos(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  useEffect(() => {
    const q=query(collection(db,"albaranes"),orderBy("fecha","desc"));
    return onSnapshot(q,snap=>setAlbaranes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  if (cargandoAuth) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:COLORS.bg,color:COLORS.muted,fontFamily:"Inter"}}>Cargando...</div>;
  if (!usuario) return <Login />;
  if (usuarioInfo?.rol==="trabajador") return <VistaTrabajador usuarioInfo={usuarioInfo} fichajes={fichajes} encargos={encargos} />;

  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <div style={{width:220,background:COLORS.surface,borderRight:`1px solid ${COLORS.border}`,padding:"24px 0",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"0 20px 28px",borderBottom:`1px solid ${COLORS.border}`}}>
            <div style={{fontFamily:"Rajdhani",fontSize:20,fontWeight:700,color:COLORS.accent,letterSpacing:1}}>❄ ClimaPro</div>
            <div style={{fontSize:11,color:COLORS.muted,marginTop:3}}>👑 {usuarioInfo?.nombre||"Admin"}</div>
          </div>
          <nav style={{padding:"16px 0",flex:1}}>
            {NAV_ITEMS.map(item=>(
              <button key={item.id} onClick={()=>setSection(item.id)}
                style={{width:"100%",background:section===item.id?COLORS.accentGlow:"transparent",
                  borderLeft:section===item.id?`3px solid ${COLORS.accent}`:"3px solid transparent",
                  color:section===item.id?COLORS.accent:COLORS.muted,
                  padding:"12px 20px",textAlign:"left",cursor:"pointer",border:"none",
                  fontSize:13,fontFamily:"Inter",fontWeight:section===item.id?600:400,
                  display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{padding:"16px 20px",borderTop:`1px solid ${COLORS.border}`}}>
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12}} onClick={()=>signOut(auth)}>Cerrar sesión</button>
          </div>
        </div>
        <div style={{flex:1,padding:32,overflowY:"auto",maxHeight:"100vh"}}>
          {section==="dashboard"&&<Dashboard encargos={encargos} manuales={manuales} fichajes={fichajes} trabajadores={trabajadores} albaranes={albaranes}/>}
          {section==="usuarios"&&<GestionUsuarios trabajadores={trabajadores}/>}
          {section==="trabajadores"&&<Trabajadores trabajadores={trabajadores} cargandoT={cargandoT}/>}
          {section==="fichajes"&&<Fichajes trabajadores={trabajadores} fichajes={fichajes}/>}
          {section==="encargos"&&<Encargos trabajadores={trabajadores}/>}
          {section==="albaranes"&&<Albaranes albaranes={albaranes}/>}
          {section==="manuales"&&<Manuales onManualesChange={setManuales}/>}
        </div>
      </div>
    </>
  );
}