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

const COLORS = {
  bg: "#0f1117", surface: "#1a1d27", card: "#1e2130", border: "#2a2d3e",
  accent: "#00c4ff", accentDim: "#0099cc", accentGlow: "rgba(0,196,255,0.15)",
  warm: "#ff6b35", green: "#00e676", yellow: "#ffd600",
  text: "#e8eaf0", muted: "#8b8fa8", danger: "#ff4757",
};

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
`;

const ESTADOS_ALBARAN = ["Borrador", "Enviado", "Cobrado", "Pendiente"];
const ESTADOS_ENCARGO = ["Pendiente", "En curso", "Completado", "Cancelado"];

const initialData = {
  albaranes: [
    { id: 1, numero: "ALB-2026-001", cliente: "Hotel Sol & Mar", fecha: "2026-04-05", importe: 1840, estado: "Cobrado", descripcion: "Mantenimiento anual 4 unidades" },
    { id: 2, numero: "ALB-2026-002", cliente: "Oficinas Central SA", fecha: "2026-04-07", importe: 3200, estado: "Enviado", descripcion: "Instalación sistema VRV" },
  ],
  encargos: [
    { id: 1, titulo: "Instalación split 3x1 - Clínica Salud", cliente: "Clínica Salud", asignado: "", prioridad: "Alta", estado: "En curso", fecha: "2026-04-10", notas: "Acceso por planta 2" },
    { id: 2, titulo: "Revisión anual - Hotel Mar Azul", cliente: "Hotel Mar Azul", asignado: "", prioridad: "Media", estado: "Pendiente", fecha: "2026-04-15", notas: "" },
  ],
};

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

function generarPDFHorario(trabajador, fichajes, empresa = "ClimaPro") {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ahora = new Date();
  const hace4años = new Date();
  hace4años.setFullYear(ahora.getFullYear() - 4);
  const registros = fichajes
    .filter(f => f.trabajador === trabajador && new Date(f.fecha) >= hace4años)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  pdf.setFillColor(15, 17, 23);
  pdf.rect(0, 0, 210, 40, "F");
  pdf.setTextColor(0, 196, 255);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("REGISTRO DE JORNADA LABORAL", 105, 15, { align: "center" });
  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(11);
  pdf.text(`Empresa: ${empresa}`, 105, 23, { align: "center" });
  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(9);
  pdf.text("Art. 34.9 del Estatuto de los Trabajadores — RDL 8/2019", 105, 30, { align: "center" });

  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DEL TRABAJADOR", 14, 50);
  pdf.setDrawColor(0, 196, 255);
  pdf.setLineWidth(0.5);
  pdf.line(14, 52, 196, 52);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(50, 50, 50);
  pdf.text(`Nombre: ${trabajador}`, 14, 60);
  pdf.text(`Período: ${hace4años.toLocaleDateString("es-ES")} — ${ahora.toLocaleDateString("es-ES")}`, 14, 67);
  pdf.text(`Total registros: ${registros.length}`, 14, 74);
  const totalMins = registros.reduce((s, f) => s + calcMinutos(f.entrada, f.salida), 0);
  pdf.text(`Total horas: ${Math.floor(totalMins / 60)}h ${totalMins % 60}m`, 120, 60);
  pdf.text(`Generado: ${ahora.toLocaleDateString("es-ES")} ${ahora.toLocaleTimeString("es-ES")}`, 120, 67);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 30, 30);
  pdf.text("REGISTROS DE JORNADA", 14, 85);
  pdf.line(14, 87, 196, 87);

  if (registros.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text("No hay registros en el período seleccionado.", 14, 97);
  } else {
    autoTable(pdf, {
      startY: 92,
      head: [["Fecha", "Día", "Entrada", "Salida", "Horas", "Notas"]],
      body: registros.map(f => {
        const fecha = new Date(f.fecha + "T00:00:00");
        const dia = fecha.toLocaleDateString("es-ES", { weekday: "short" });
        return [f.fecha, dia.charAt(0).toUpperCase() + dia.slice(1), f.entrada || "—", f.salida || "—", calcHoras(f.entrada, f.salida), f.notas || ""];
      }),
      headStyles: { fillColor: [15, 17, 23], textColor: [0, 196, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0:{cellWidth:28}, 1:{cellWidth:18}, 2:{cellWidth:22}, 3:{cellWidth:22}, 4:{cellWidth:22}, 5:{cellWidth:"auto"} },
      margin: { left: 14, right: 14 },
    });
  }

  const totalPaginas = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i} de ${totalPaginas}`, 105, 290, { align: "center" });
    pdf.text("Documento generado por ClimaPro — Registro obligatorio según RDL 8/2019", 105, 295, { align: "center" });
  }
  pdf.save(`registro_horario_${trabajador.replace(/\s/g, "_")}_${ahora.getFullYear()}.pdf`);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setCargando(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError("Email o contraseña incorrectos");
    }
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
            <div>
              <label>Email</label>
              <input className="input" type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <div>
              <label>Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
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

// ─── VISTA TRABAJADOR ─────────────────────────────────────────────────────────
function VistaTrabajador({ usuarioInfo, fichajes, encargos }) {
  const [fichando, setFichando] = useState(false);
  const hoy = new Date().toISOString().split("T")[0];
  const misFichajes = fichajes.filter(f => f.trabajador === usuarioInfo.nombre).slice(0, 10);
  const misEncargos = encargos.filter(e => e.asignado === usuarioInfo.nombre && e.estado !== "Completado" && e.estado !== "Cancelado");
  const fichajeHoy = fichajes.find(f => f.trabajador === usuarioInfo.nombre && f.fecha === hoy);

  const ficharEntrada = async () => {
    setFichando(true);
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    await addDoc(collection(db, "fichajes"), {
      trabajador: usuarioInfo.nombre,
      fecha: hoy,
      entrada: hora,
      salida: "",
      notas: ""
    });
    setFichando(false);
  };

  const ficharSalida = async () => {
    if (!fichajeHoy) return;
    setFichando(true);
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    await updateDoc(doc(db, "fichajes", fichajeHoy.id), { salida: hora });
    setFichando(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg }}>
      {/* Header */}
      <div style={{ background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}`, padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"Rajdhani", fontSize:20, fontWeight:700, color:COLORS.accent }}>❄ ClimaPro</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:13, color:COLORS.muted }}>👷 {usuarioInfo.nombre}</span>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>

      <div style={{ padding:24, maxWidth:800, margin:"0 auto" }}>
        {/* Fichar */}
        <div className="card" style={{ padding:28, marginBottom:24, textAlign:"center", borderTop:`3px solid ${COLORS.accent}` }}>
          <div style={{ fontFamily:"Rajdhani", fontSize:22, fontWeight:700, marginBottom:8 }}>
            {new Date().toLocaleDateString("es-ES", { weekday:"long", day:"numeric", month:"long" })}
          </div>
          <div style={{ fontSize:13, color:COLORS.muted, marginBottom:24 }}>
            {fichajeHoy
              ? fichajeHoy.salida
                ? `✅ Jornada completada: ${fichajeHoy.entrada} → ${fichajeHoy.salida} (${calcHoras(fichajeHoy.entrada, fichajeHoy.salida)})`
                : `⏱ Entrada registrada a las ${fichajeHoy.entrada}`
              : "No has fichado hoy"}
          </div>

          {!fichajeHoy && (
            <button className="btn btn-primary" style={{ padding:"14px 40px", fontSize:16 }} onClick={ficharEntrada} disabled={fichando}>
              {fichando ? "Registrando..." : "🟢 Registrar entrada"}
            </button>
          )}
          {fichajeHoy && !fichajeHoy.salida && (
            <button className="btn" style={{ background:COLORS.warm, color:"#fff", padding:"14px 40px", fontSize:16 }} onClick={ficharSalida} disabled={fichando}>
              {fichando ? "Registrando..." : "🔴 Registrar salida"}
            </button>
          )}
          {fichajeHoy && fichajeHoy.salida && (
            <div style={{ fontSize:28 }}>✅</div>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Mis encargos */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontFamily:"Rajdhani", fontWeight:700, fontSize:16, marginBottom:16, color:COLORS.warm }}>🔧 Mis encargos activos</div>
            {misEncargos.length === 0
              ? <div style={{ color:COLORS.muted, fontSize:13 }}>Sin encargos asignados</div>
              : misEncargos.map(e => (
                <div key={e.id} style={{ padding:"10px 0", borderBottom:`1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{e.titulo}</div>
                  <div style={{ fontSize:12, color:COLORS.muted, marginTop:3 }}>
                    {e.cliente} · {e.fecha}
                  </div>
                  <div style={{ marginTop:4 }}>
                    <span className="badge" style={{ background:"rgba(255,107,53,.2)", color:COLORS.warm }}>{e.prioridad}</span>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Mis últimos fichajes */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontFamily:"Rajdhani", fontWeight:700, fontSize:16, marginBottom:16, color:COLORS.accent }}>⏱ Mis últimos fichajes</div>
            {misFichajes.length === 0
              ? <div style={{ color:COLORS.muted, fontSize:13 }}>Sin registros</div>
              : misFichajes.map(f => (
                <div key={f.id} style={{ padding:"8px 0", borderBottom:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, color:COLORS.muted }}>{f.fecha}</div>
                  <div style={{ fontSize:12 }}>{f.entrada} → {f.salida || "..."} <span style={{ color:COLORS.accent }}>{calcHoras(f.entrada, f.salida)}</span></div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div className="card" style={{ width:"100%", maxWidth:520, padding:24 }}>
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
  const c = colors[estado] || {bg:"rgba(139,143,168,.15)",color:COLORS.muted};
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

// ─── GESTIÓN USUARIOS (solo admin) ───────────────────────────────────────────
function GestionUsuarios({ trabajadores }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", nombre:"", rol:"trabajador" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const crearUsuario = async () => {
    if (!form.email || !form.password || !form.nombre) return;
    setGuardando(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email,
        nombre: form.nombre,
        rol: form.rol,
      });
      setModal(false);
      setForm({ email:"", password:"", nombre:"", rol:"trabajador" });
    } catch (e) {
      setError(e.code === "auth/email-already-in-use" ? "Este email ya está en uso" : "Error al crear el usuario");
    }
    setGuardando(false);
  };

  const eliminarUsuario = async (id) => {
    await deleteDoc(doc(db, "usuarios", id));
  };

  return (
    <div>
      <Header title="Gestión de Usuarios ☁" onAdd={() => setModal(true)} addLabel="+ Crear usuario" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {usuarios.map(u => (
          <div key={u.id} className="card" style={{ padding:20, borderLeft:`3px solid ${u.rol === "admin" ? COLORS.yellow : COLORS.accent}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:28 }}>{u.rol === "admin" ? "👑" : "👷"}</div>
              <span className="badge" style={{ background: u.rol === "admin" ? "rgba(255,214,0,.2)" : "rgba(0,196,255,.15)", color: u.rol === "admin" ? COLORS.yellow : COLORS.accent }}>
                {u.rol === "admin" ? "Administrador" : "Trabajador"}
              </span>
            </div>
            <div style={{ fontWeight:700, fontSize:15 }}>{u.nombre}</div>
            <div style={{ fontSize:12, color:COLORS.muted, marginTop:4 }}>{u.email}</div>
            <div style={{ marginTop:12 }}>
              <button className="btn btn-danger" onClick={() => eliminarUsuario(u.id)}>🗑 Eliminar acceso</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Crear nuevo usuario" onClose={() => setModal(false)}>
          <div style={{ display:"grid", gap:14 }}>
            <div style={{ background:"rgba(0,196,255,0.08)", border:`1px solid ${COLORS.accent}33`, borderRadius:10, padding:12, fontSize:12, color:COLORS.muted }}>
              El usuario recibirá acceso a la app con el email y contraseña que definas aquí.
            </div>
            <div><label>Nombre completo</label>
              <select className="select" style={{ width:"100%" }} value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})}>
                <option value="">Selecciona trabajador</option>
                {trabajadores.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
            <div><label>Email de acceso</label><input className="input" type="email" placeholder="trabajador@empresa.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></div>
            <div><label>Contraseña</label><input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({...form, password:e.target.value})} /></div>
            <div><label>Rol</label>
              <select className="select" style={{ width:"100%" }} value={form.rol} onChange={e => setForm({...form, rol:e.target.value})}>
                <option value="trabajador">Trabajador (fichar + ver encargos)</option>
                <option value="admin">Administrador (acceso total)</option>
              </select>
            </div>
            {error && <div style={{ fontSize:13, color:COLORS.danger }}>{error}</div>}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearUsuario} disabled={guardando}>
                {guardando ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </Modal>
      )}
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
    if (!form.nombre) return;
    setGuardando(true);
    if (editando) await updateDoc(doc(db, "trabajadores", editando.id), form);
    else await addDoc(collection(db, "trabajadores"), form);
    setGuardando(false);
    setModal(false);
  };

  const eliminar = async (id) => { await deleteDoc(doc(db, "trabajadores", id)); setConfirmarEliminar(null); };
  const activos = trabajadores.filter(t => t.estado !== "Inactivo");
  const inactivos = trabajadores.filter(t => t.estado === "Inactivo");

  return (
    <div>
      <Header title="Trabajadores ☁" onAdd={abrirNuevo} addLabel="+ Añadir trabajador" />
      {cargandoT ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Cargando...</div> : trabajadores.length === 0 ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Añade el primer trabajador</div> : (
        <>
          <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Activos ({activos.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14,marginBottom:28}}>
            {activos.map(t => (
              <div key={t.id} className="card" style={{padding:20,borderLeft:`3px solid ${COLORS.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div><div style={{fontSize:32,marginBottom:4}}>👷</div><div style={{fontWeight:700,fontSize:15}}>{t.nombre}</div><div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{t.cargo}</div></div>
                  <EstadoBadge estado={t.estado||"Activo"} />
                </div>
                {t.telefono && <div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>📱 {t.telefono}</div>}
                {t.email && <div style={{fontSize:12,color:COLORS.muted,marginBottom:4}}>✉ {t.email}</div>}
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={() => abrirEditar(t)}>✏ Editar</button>
                  <button className="btn btn-danger" onClick={() => setConfirmarEliminar(t)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          {inactivos.length > 0 && <>
            <div style={{fontSize:12,color:COLORS.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Inactivos ({inactivos.length})</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {inactivos.map(t => (
                <div key={t.id} className="card" style={{padding:20,opacity:0.6}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{t.nombre}</div>
                  <div style={{fontSize:12,color:COLORS.muted}}>{t.cargo}</div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:"5px 12px"}} onClick={() => abrirEditar(t)}>✏ Editar</button>
                    <button className="btn btn-danger" onClick={() => setConfirmarEliminar(t)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </>
      )}
      {modal && <Modal title={editando?"Editar Trabajador":"Nuevo Trabajador"} onClose={() => setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Nombre *</label><input className="input" placeholder="Nombre y apellido" value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Cargo</label><select className="select" style={{width:"100%"}} value={form.cargo} onChange={e => setForm({...form,cargo:e.target.value})}>{["Técnico","Oficial","Ayudante","Jefe de obra","Administrativo","Otro"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e => setForm({...form,estado:e.target.value})}><option>Activo</option><option>Inactivo</option></select></div>
          </div>
          <div><label>Teléfono</label><input className="input" placeholder="6XX XXX XXX" value={form.telefono} onChange={e => setForm({...form,telefono:e.target.value})} /></div>
          <div><label>Email</label><input className="input" placeholder="correo@ejemplo.com" value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
          <div><label>Notas</label><input className="input" placeholder="Observaciones..." value={form.notas} onChange={e => setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":editando?"Guardar cambios":"Añadir"}</button>
          </div>
        </div>
      </Modal>}
      {confirmarEliminar && <Modal title="¿Eliminar?" onClose={() => setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.nombre}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>Esta acción no se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
          <button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={() => eliminar(confirmarEliminar.id)}>Sí, eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

// ─── FICHAJES ────────────────────────────────────────────────────────────────
function Fichajes({ trabajadores, fichajes, cargando }) {
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTrabajador, setFiltroTrabajador] = useState("Todos");
  const [modalPDF, setModalPDF] = useState(false);
  const [trabajadorPDF, setTrabajadorPDF] = useState("");
  const nombresActivos = trabajadores.filter(t => t.estado !== "Inactivo").map(t => t.nombre);
  const todosNombres = trabajadores.map(t => t.nombre);
  const [form, setForm] = useState({ trabajador: nombresActivos[0]||"", fecha: new Date().toISOString().split("T")[0], entrada:"08:00", salida:"", notas:"" });

  useEffect(() => { if (nombresActivos.length > 0 && !form.trabajador) setForm(f => ({...f, trabajador: nombresActivos[0]})); }, [trabajadores]);

  const guardar = async () => {
    if (!form.trabajador || !form.fecha || !form.entrada) return;
    setGuardando(true);
    await addDoc(collection(db, "fichajes"), form);
    setGuardando(false);
    setModal(false);
  };

  const eliminar = async (id) => { await deleteDoc(doc(db, "fichajes", id)); setConfirmarEliminar(null); };
  const registrarSalida = async (f) => {
    const ahora = new Date();
    const salida = `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    await updateDoc(doc(db, "fichajes", f.id), { salida });
  };

  const lista = fichajes.filter(f => filtroTrabajador==="Todos"||f.trabajador===filtroTrabajador).filter(f => !filtroFecha||f.fecha===filtroFecha);
  const horasTotal = lista.reduce((s,f) => s + calcMinutos(f.entrada, f.salida), 0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontFamily:"Rajdhani",fontSize:24,fontWeight:700}}>Control Horario ☁</h2>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={() => { setTrabajadorPDF(todosNombres[0]||""); setModalPDF(true); }}>📄 Informe PDF 4 años</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar fichaje</button>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <select className="select" value={filtroTrabajador} onChange={e => setFiltroTrabajador(e.target.value)}>
          <option value="Todos">Todos los trabajadores</option>
          {nombresActivos.map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="input" type="date" style={{width:"auto"}} value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
        {filtroFecha && <button className="btn btn-ghost" style={{fontSize:12}} onClick={() => setFiltroFecha("")}>✕ Limpiar</button>}
        <span style={{marginLeft:"auto",fontFamily:"Rajdhani",fontSize:14,fontWeight:700,color:COLORS.accent}}>Total: {Math.floor(horasTotal/60)}h {horasTotal%60}m</span>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        {cargando ? <div style={{padding:40,textAlign:"center",color:COLORS.muted}}>Cargando...</div> : lista.length === 0 ? <div style={{padding:40,textAlign:"center",color:COLORS.muted}}>No hay fichajes</div> : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Trabajador","Fecha","Entrada","Salida","Horas","Notas",""].map((h,i)=><th key={i} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{lista.map(f=>(
              <tr key={f.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
                <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{f.trabajador}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{f.fecha}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:COLORS.green}}>{f.entrada}</td>
                <td style={{padding:"12px 16px",fontSize:13,color:f.salida?COLORS.warm:COLORS.muted}}>{f.salida||<button className="btn btn-primary" style={{fontSize:11,padding:"3px 10px"}} onClick={()=>registrarSalida(f)}>Registrar salida</button>}</td>
                <td style={{padding:"12px 16px",fontSize:13,fontFamily:"Rajdhani",fontWeight:600,color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</td>
                <td style={{padding:"12px 16px",fontSize:12,color:COLORS.muted}}>{f.notas||"—"}</td>
                <td style={{padding:"12px 16px"}}><button className="btn btn-danger" onClick={()=>setConfirmarEliminar(f)}>🗑</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {modalPDF && <Modal title="📄 Informe PDF — Últimos 4 años" onClose={() => setModalPDF(false)}>
        <div style={{display:"grid",gap:16}}>
          <div style={{background:"rgba(0,196,255,0.08)",border:`1px solid ${COLORS.accent}33`,borderRadius:10,padding:14,fontSize:13,color:COLORS.muted}}>Genera un PDF cumpliendo el <strong style={{color:COLORS.accent}}>RDL 8/2019</strong> sobre registro horario obligatorio.</div>
          <div><label>Trabajador</label><select className="select" style={{width:"100%"}} value={trabajadorPDF} onChange={e => setTrabajadorPDF(e.target.value)}>{todosNombres.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={() => setModalPDF(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => { generarPDFHorario(trabajadorPDF, fichajes); setModalPDF(false); }}>📥 Descargar PDF</button>
          </div>
        </div>
      </Modal>}

      {confirmarEliminar && <Modal title="¿Eliminar fichaje?" onClose={() => setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.trabajador} — {confirmarEliminar.fecha}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>Esta acción no se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={() => setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={() => eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}

      {modal && <Modal title="Registrar Fichaje" onClose={() => setModal(false)}>
        <div style={{display:"grid",gap:16}}>
          <div><label>Trabajador</label><select className="select" style={{width:"100%"}} value={form.trabajador} onChange={e => setForm({...form,trabajador:e.target.value})}>{nombresActivos.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e => setForm({...form,fecha:e.target.value})} /></div>
            <div><label>Entrada</label><input className="input" type="time" value={form.entrada} onChange={e => setForm({...form,entrada:e.target.value})} /></div>
          </div>
          <div><label>Salida (opcional)</label><input className="input" type="time" value={form.salida} onChange={e => setForm({...form,salida:e.target.value})} /></div>
          <div><label>Notas</label><input className="input" placeholder="Trabajo realizado..." value={form.notas} onChange={e => setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?"Guardando...":"Guardar ☁"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── ENCARGOS ────────────────────────────────────────────────────────────────
function Encargos({ encargos, setEncargos, trabajadores }) {
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState("Todos");
  const nombresActivos = trabajadores.filter(t => t.estado !== "Inactivo").map(t => t.nombre);
  const [form, setForm] = useState({ titulo:"", cliente:"", asignado:"", prioridad:"Media", estado:"Pendiente", fecha:"", notas:"" });

  const guardar = () => {
    setEncargos(prev => [...prev, { ...form, id:Date.now() }]);
    setModal(false);
    setForm({ titulo:"", cliente:"", asignado:"", prioridad:"Media", estado:"Pendiente", fecha:"", notas:"" });
  };

  const lista = filtro === "Todos" ? encargos : encargos.filter(e => e.estado === filtro);

  return (
    <div>
      <Header title="Encargos" onAdd={() => setModal(true)} addLabel="+ Nuevo encargo" />
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["Todos",...ESTADOS_ENCARGO].map(f=><button key={f} className="btn" onClick={()=>setFiltro(f)} style={{background:filtro===f?COLORS.accent:COLORS.surface,color:filtro===f?"#000":COLORS.muted,border:`1px solid ${filtro===f?COLORS.accent:COLORS.border}`,fontSize:12}}>{f}</button>)}
      </div>
      <div style={{display:"grid",gap:12}}>
        {lista.map(e=>(
          <div key={e.id} className="card" style={{padding:18,display:"grid",gridTemplateColumns:"1fr auto",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><EstadoBadge estado={e.prioridad}/><EstadoBadge estado={e.estado}/></div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{e.titulo}</div>
              <div style={{fontSize:12,color:COLORS.muted}}>Cliente: {e.cliente} · Asignado: {e.asignado||"—"} · Fecha: {e.fecha}</div>
              {e.notas&&<div style={{fontSize:12,color:COLORS.muted,marginTop:6,fontStyle:"italic"}}>"{e.notas}"</div>}
            </div>
            <select className="select" style={{fontSize:12,padding:"5px 8px"}} value={e.estado} onChange={ev=>setEncargos(prev=>prev.map(x=>x.id===e.id?{...x,estado:ev.target.value}:x))}>
              {ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
      {modal && <Modal title="Nuevo Encargo" onClose={() => setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Título</label><input className="input" placeholder="Ej: Instalación split" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Cliente</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
            <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div><label>Asignado</label><select className="select" style={{width:"100%"}} value={form.asignado} onChange={e=>setForm({...form,asignado:e.target.value})}><option value="">Sin asignar</option>{nombresActivos.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label>Prioridad</label><select className="select" style={{width:"100%"}} value={form.prioridad} onChange={e=>setForm({...form,prioridad:e.target.value})}>{["Baja","Media","Alta","Urgente"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ENCARGO.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label>Notas</label><input className="input" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Crear encargo</button></div>
        </div>
      </Modal>}
    </div>
  );
}

// ─── ALBARANES ───────────────────────────────────────────────────────────────
function Albaranes({ albaranes, setAlbaranes }) {
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState("Todos");
  const [form, setForm] = useState({ numero:"", cliente:"", fecha:new Date().toISOString().split("T")[0], importe:"", estado:"Borrador", descripcion:"" });

  const guardar = () => {
    const nextNum = `ALB-${new Date().getFullYear()}-${String(albaranes.length+1).padStart(3,"0")}`;
    setAlbaranes(prev => [...prev, { ...form, importe:Number(form.importe), numero:form.numero||nextNum, id:Date.now() }]);
    setModal(false);
    setForm({ numero:"", cliente:"", fecha:new Date().toISOString().split("T")[0], importe:"", estado:"Borrador", descripcion:"" });
  };

  const lista = filtro === "Todos" ? albaranes : albaranes.filter(a => a.estado === filtro);
  const total = lista.reduce((s,a) => s+a.importe, 0);

  return (
    <div>
      <Header title="Albaranes" onAdd={() => setModal(true)} addLabel="+ Nuevo albarán" />
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["Todos",...ESTADOS_ALBARAN].map(f=><button key={f} className="btn" onClick={()=>setFiltro(f)} style={{background:filtro===f?COLORS.accent:COLORS.surface,color:filtro===f?"#000":COLORS.muted,border:`1px solid ${filtro===f?COLORS.accent:COLORS.border}`,fontSize:12}}>{f}</button>)}
        <span style={{marginLeft:"auto",alignSelf:"center",fontSize:14,fontFamily:"Rajdhani",fontWeight:700,color:COLORS.green}}>Total: {total.toLocaleString()}€</span>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${COLORS.border}`}}>{["Número","Cliente","Descripción","Fecha","Importe","Estado"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,color:COLORS.muted,fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{lista.map(a=>(
            <tr key={a.id} style={{borderBottom:`1px solid ${COLORS.border}`}}>
              <td style={{padding:"12px 16px",fontSize:13,fontFamily:"Rajdhani",fontWeight:600,color:COLORS.accent}}>{a.numero}</td>
              <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{a.cliente}</td>
              <td style={{padding:"12px 16px",fontSize:12,color:COLORS.muted,maxWidth:200}}>{a.descripcion}</td>
              <td style={{padding:"12px 16px",fontSize:13,color:COLORS.muted}}>{a.fecha}</td>
              <td style={{padding:"12px 16px",fontSize:14,fontFamily:"Rajdhani",fontWeight:700,color:COLORS.green}}>{a.importe.toLocaleString()}€</td>
              <td style={{padding:"12px 16px"}}><select className="select" style={{fontSize:12,padding:"4px 8px"}} value={a.estado} onChange={ev=>setAlbaranes(prev=>prev.map(x=>x.id===a.id?{...x,estado:ev.target.value}:x))}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {modal && <Modal title="Nuevo Albarán" onClose={() => setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Nº Albarán</label><input className="input" placeholder="Auto si vacío" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
            <div><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div><label>Cliente</label><input className="input" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
          <div><label>Descripción</label><input className="input" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label>Importe (€)</label><input className="input" type="number" value={form.importe} onChange={e=>setForm({...form,importe:e.target.value})} /></div>
            <div><label>Estado</label><select className="select" style={{width:"100%"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_ALBARAN.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Crear albarán</button></div>
        </div>
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
  const [form, setForm] = useState({ titulo:"", marca:"", tipo:"Instalación", url:"", fecha:new Date().toISOString().split("T")[0] });

  useEffect(() => {
    const q = query(collection(db, "manuales"), orderBy("fecha", "desc"));
    return onSnapshot(q, snap => { const d = snap.docs.map(x=>({id:x.id,...x.data()})); setManuales(d); onManualesChange(d); setCargando(false); });
  }, []);

  const guardar = async () => {
    if (!form.titulo||!form.marca) return;
    setGuardando(true);
    await addDoc(collection(db,"manuales"),form);
    setGuardando(false); setModal(false);
    setForm({titulo:"",marca:"",tipo:"Instalación",url:"",fecha:new Date().toISOString().split("T")[0]});
  };

  const eliminar = async (id) => { await deleteDoc(doc(db,"manuales",id)); setConfirmarEliminar(null); };
  const tipoColor = {Instalación:COLORS.accent,Mantenimiento:COLORS.green,Técnico:COLORS.warm,Protocolo:COLORS.yellow,Otro:COLORS.muted};
  const porMarca = {};
  const lf = buscar ? manuales.filter(m=>m.titulo.toLowerCase().includes(buscar.toLowerCase())||m.marca.toLowerCase().includes(buscar.toLowerCase())) : manuales;
  lf.forEach(m=>{if(!porMarca[m.marca])porMarca[m.marca]={};if(!porMarca[m.marca][m.tipo])porMarca[m.marca][m.tipo]=[];porMarca[m.marca][m.tipo].push(m);});
  const marcas = Object.keys(porMarca).sort();

  return (
    <div>
      <Header title="Biblioteca de Manuales ☁" onAdd={() => setModal(true)} addLabel="+ Añadir manual" />
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <input className="input" placeholder="🔍 Buscar..." value={buscar} onChange={e=>{setBuscar(e.target.value);setMarcaAbierta(null);setTipoAbierto(null);}} style={{maxWidth:400}} />
        <span style={{fontSize:12,color:COLORS.green}}>✓ Sincronizado con la nube</span>
      </div>
      {cargando ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>Cargando...</div> : marcas.length===0 ? <div style={{color:COLORS.muted,textAlign:"center",padding:40}}>{buscar?"Sin resultados":"Añade el primer manual"}</div> : buscar ? (
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
      ) : (
        <div className="card" style={{padding:8}}>
          {marcas.map(marca=>{
            const mo=marcaAbierta===marca; const tipos=Object.keys(porMarca[marca]).sort(); const tot=Object.values(porMarca[marca]).reduce((s,a)=>s+a.length,0);
            return <div key={marca}>
              <div className="folder-row" onClick={()=>{setMarcaAbierta(mo?null:marca);setTipoAbierto(null);}}>
                <span style={{fontSize:18}}>{mo?"📂":"📁"}</span><span style={{fontWeight:600,fontSize:14,flex:1}}>{marca}</span>
                <span style={{fontSize:12,color:COLORS.muted}}>{tot} manual{tot!==1?"es":""}</span><span style={{color:COLORS.muted,fontSize:12,marginLeft:8}}>{mo?"▲":"▼"}</span>
              </div>
              {mo&&<div style={{paddingLeft:24}}>{tipos.map(tipo=>{
                const to=tipoAbierto===`${marca}-${tipo}`; const items=porMarca[marca][tipo];
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
      {confirmarEliminar&&<Modal title="¿Eliminar manual?" onClose={()=>setConfirmarEliminar(null)}>
        <div style={{marginBottom:20}}><div style={{fontSize:15,fontWeight:600,color:COLORS.accent}}>{confirmarEliminar.titulo}</div><div style={{fontSize:13,color:COLORS.muted,marginTop:4}}>Esta acción no se puede deshacer.</div></div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setConfirmarEliminar(null)}>Cancelar</button><button className="btn" style={{background:COLORS.danger,color:"#fff"}} onClick={()=>eliminar(confirmarEliminar.id)}>Sí, eliminar</button></div>
      </Modal>}
      {modal&&<Modal title="Añadir Manual" onClose={()=>setModal(false)}>
        <div style={{display:"grid",gap:14}}>
          <div><label>Título *</label><input className="input" placeholder="Ej: Manual Daikin..." value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div>
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
function Dashboard({ data, manuales, fichajes, trabajadores }) {
  const hoy = new Date().toISOString().split("T")[0];
  const fichajesHoy = fichajes.filter(f => f.fecha === hoy).length;
  const encargosActivos = data.encargos.filter(e => e.estado==="En curso"||e.estado==="Pendiente").length;
  const totalFacturado = data.albaranes.filter(a => a.estado==="Cobrado").reduce((s,a) => s+a.importe, 0);
  const stats = [
    {label:"Trabajadores activos",value:trabajadores.filter(t=>t.estado!=="Inactivo").length,color:COLORS.accent,icon:"👷"},
    {label:"Fichajes hoy",value:fichajesHoy,color:COLORS.green,icon:"⏱"},
    {label:"Encargos activos",value:encargosActivos,color:COLORS.warm,icon:"🔧"},
    {label:"Facturado (cobrado)",value:`${totalFacturado.toLocaleString()}€`,color:COLORS.yellow,icon:"💶"},
  ];
  const urgentes = data.encargos.filter(e => e.prioridad==="Urgente"&&e.estado!=="Completado");
  const fichajesHoyList = fichajes.filter(f => f.fecha===hoy).slice(0,4);

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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,marginBottom:16,color:COLORS.accent}}>⏱ Fichajes de hoy</div>
          {fichajesHoyList.length===0?<div style={{color:COLORS.muted,fontSize:13}}>Sin fichajes hoy</div>:fichajesHoyList.map(f=>(
            <div key={f.id} style={{padding:"8px 0",borderBottom:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:13,fontWeight:500}}>{f.trabajador}</div>
              <div style={{fontSize:12,color:COLORS.muted}}>{f.entrada} → {f.salida||"..."} <span style={{color:COLORS.accent}}>{calcHoras(f.entrada,f.salida)}</span></div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:16,marginBottom:16,color:COLORS.warm}}>⚠ Encargos Urgentes</div>
          {urgentes.length===0?<div style={{color:COLORS.muted,fontSize:13}}>Sin encargos urgentes</div>:urgentes.map(e=>(
            <div key={e.id} style={{padding:"10px 0",borderBottom:`1px solid ${COLORS.border}`}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.titulo}</div>
              <div style={{fontSize:12,color:COLORS.muted,marginTop:3}}>{e.asignado||"Sin asignar"} · {e.fecha}</div>
            </div>
          ))}
        </div>
      </div>
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

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [data, setData] = useState(initialData);
  const [manuales, setManuales] = useState([]);
  const [fichajes, setFichajes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [cargandoT, setCargandoT] = useState(true);

  const setAlbaranes = fn => setData(d => ({...d, albaranes:fn(d.albaranes)}));
  const setEncargos = fn => setData(d => ({...d, encargos:fn(d.encargos)}));

  // Escuchar cambios de autenticación
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUsuario(u);
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        if (snap.exists()) setUsuarioInfo(snap.data());
      } else {
        setUsuario(null);
        setUsuarioInfo(null);
      }
      setCargandoAuth(false);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db,"fichajes"), orderBy("fecha","desc"));
    return onSnapshot(q, snap => setFichajes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  useEffect(() => {
    const q = query(collection(db,"trabajadores"), orderBy("nombre"));
    return onSnapshot(q, snap => { setTrabajadores(snap.docs.map(d=>({id:d.id,...d.data()}))); setCargandoT(false); });
  }, []);

  if (cargandoAuth) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:COLORS.bg,color:COLORS.muted}}>Cargando...</div>;
  if (!usuario) return <Login />;
  if (usuarioInfo?.rol === "trabajador") return <VistaTrabajador usuarioInfo={usuarioInfo} fichajes={fichajes} encargos={data.encargos} />;

  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <div style={{width:220,background:COLORS.surface,borderRight:`1px solid ${COLORS.border}`,padding:"24px 0",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"0 20px 28px",borderBottom:`1px solid ${COLORS.border}`}}>
            <div style={{fontFamily:"Rajdhani",fontSize:20,fontWeight:700,color:COLORS.accent,letterSpacing:1}}>❄ ClimaPro</div>
            <div style={{fontSize:11,color:COLORS.muted,marginTop:3}}>👑 {usuarioInfo?.nombre || "Admin"}</div>
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
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12}} onClick={() => signOut(auth)}>Cerrar sesión</button>
          </div>
        </div>
        <div style={{flex:1,padding:32,overflowY:"auto",maxHeight:"100vh"}}>
          {section==="dashboard"&&<Dashboard data={data} manuales={manuales} fichajes={fichajes} trabajadores={trabajadores}/>}
          {section==="usuarios"&&<GestionUsuarios trabajadores={trabajadores}/>}
          {section==="trabajadores"&&<Trabajadores trabajadores={trabajadores} cargandoT={cargandoT}/>}
          {section==="fichajes"&&<Fichajes trabajadores={trabajadores} fichajes={fichajes} cargando={false}/>}
          {section==="encargos"&&<Encargos encargos={data.encargos} setEncargos={setEncargos} trabajadores={trabajadores}/>}
          {section==="albaranes"&&<Albaranes albaranes={data.albaranes} setAlbaranes={setAlbaranes}/>}
          {section==="manuales"&&<Manuales onManualesChange={setManuales}/>}
        </div>
      </div>
    </>
  );
}