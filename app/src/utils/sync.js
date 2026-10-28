import { encryptWithKey, decryptWithKey, uint8ArrayToBase64, base64ToUint8Array } from './crypto';

/**
 * Sincronización del estado semanal entre móviles (cambios de plato, compra marcada,
 * "ya lo tengo", extras y pasos del batch).
 *
 * Cada valor se guarda con la hora en que se cambió ({ v, t }; v null = borrado) y al
 * juntar dos copias gana, elemento a elemento, el cambio más reciente. Así dos personas
 * pueden marcar cosas a la vez sin pisarse.
 *
 * Copias remotas, siempre cifradas con la clave de la app (la misma en todos los móviles):
 * - Gist secreto de GitHub, automático, con un token que solo tiene permiso de gists.
 * - Enlace (#sync=...) para enviar por WhatsApp cuando no hay token.
 */

const DOC_KEY = 'nutriplan_sync';
const CONFIG_KEY = 'nutriplan_sync_gist';
const GIST_FILE = 'nutriplan-sync.json';
const API = 'https://api.github.com';
const ESPERA_SUBIDA_MS = 1500;
const INTERVALO_MS = 30000;

// --- Documento local ---------------------------------------------------------

function leerDoc() {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // copia corrupta: se empieza de cero
  }
  return { semana: null, campos: {} };
}

let doc = leerDoc();
const oyentes = new Map(); // nombre -> setEstado del hook montado
const avisos = new Set(); // cambios de estado de la sincronización (para la interfaz)
let estadoSync = { conectado: false, ocupado: false, ultima: null, error: null };

function guardarDoc() {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(doc));
  } catch (e) {
    console.error('Error guardando la sincronización', e);
  }
}

/** Empieza un documento vacío al publicarse un menú nuevo. */
function alinearSemana(semana) {
  if (doc.semana !== semana) {
    doc = { semana, campos: {} };
    guardarDoc();
  }
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Pasa el estado de un hook (objeto, o lista de { id }) a entradas por clave. */
function porClave(valor) {
  if (Array.isArray(valor)) return Object.fromEntries(valor.map((x) => [x.id, x]));
  return valor || {};
}

/** Estado visible de un campo a partir de sus entradas con hora. */
function materializar(campo) {
  const vivos = Object.entries(campo.e).filter(([, x]) => x.v !== null && x.v !== undefined);
  if (campo.lista) {
    return vivos.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, x]) => x.v);
  }
  return Object.fromEntries(vivos.map(([k, x]) => [k, x.v]));
}

/**
 * Anota con la hora actual lo que ha cambiado en un campo desde la última vez.
 * Si el estado ya coincide con el documento (p. ej. porque llega de otro móvil) no anota nada.
 */
export function anotarLocal(nombre, semana, estado) {
  if (!semana) return;
  alinearSemana(semana);
  const lista = Array.isArray(estado);
  const campo = doc.campos[nombre] || { lista, e: {} };
  const antes = materializar(campo);
  const ahora = porClave(estado);
  const previo = porClave(antes);
  const t = Date.now();
  let cambiado = false;
  for (const k of new Set([...Object.keys(ahora), ...Object.keys(previo)])) {
    if (!igual(ahora[k], previo[k])) {
      campo.e[k] = { v: ahora[k] ?? null, t };
      cambiado = true;
    }
  }
  if (!cambiado) return;
  campo.lista = lista;
  doc.campos[nombre] = campo;
  guardarDoc();
  programarSubida();
}

/** Registra el hook montado de un campo para avisarle cuando llegan cambios de fuera. */
export function escuchar(nombre, setEstado) {
  oyentes.set(nombre, setEstado);
  return () => {
    if (oyentes.get(nombre) === setEstado) oyentes.delete(nombre);
  };
}

/**
 * Junta una copia remota con la local. Devuelve true si la local ha cambiado.
 * Una copia de otra semana se ignora.
 */
function fusionar(remoto) {
  if (!remoto?.campos || !doc.semana || remoto.semana !== doc.semana) return false;
  let cambiado = false;
  for (const [nombre, campoR] of Object.entries(remoto.campos)) {
    const campo = doc.campos[nombre] || { lista: !!campoR.lista, e: {} };
    let tocado = false;
    for (const [k, x] of Object.entries(campoR.e || {})) {
      if (!campo.e[k] || x.t > campo.e[k].t) {
        campo.e[k] = x;
        tocado = true;
      }
    }
    if (!tocado) continue;
    doc.campos[nombre] = campo;
    cambiado = true;
    const valor = materializar(campo);
    // Se escribe también la copia del hook, por si su pestaña no está abierta ahora
    try {
      localStorage.setItem(`nutriplan_${nombre}_${doc.semana}`, JSON.stringify(valor));
    } catch {
      // sin almacenamiento local
    }
    oyentes.get(nombre)?.(valor);
  }
  if (cambiado) guardarDoc();
  return cambiado;
}

/** true si la copia remota no tiene ya todo lo que hay en la local. */
function faltaEnRemoto(remoto) {
  if (!doc.semana) return false;
  if (!remoto || remoto.semana !== doc.semana) return !remoto || !remoto.semana || remoto.semana < doc.semana;
  return Object.entries(doc.campos).some(([nombre, campo]) =>
    Object.entries(campo.e).some(([k, x]) => {
      const r = remoto.campos?.[nombre]?.e?.[k];
      return !r || r.t < x.t;
    })
  );
}

// --- Estado para la interfaz -----------------------------------------------

function avisar(parcial) {
  estadoSync = { ...estadoSync, ...parcial };
  avisos.forEach((fn) => fn(estadoSync));
}

export function suscribirEstado(fn) {
  avisos.add(fn);
  fn(estadoSync);
  return () => avisos.delete(fn);
}

// --- Gist de GitHub ----------------------------------------------------------

let clave = null; // CryptoKey de la sesión
let config = null; // { token, gistId }
let temporizador = null;
let intervalo = null;
let enCurso = null;

async function api(ruta, opciones = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (res.status === 401) throw new Error('GitHub no acepta el token (caducado o revocado).');
  if (res.status === 403 || res.status === 404) throw new Error('El token no tiene permiso de gists o el gist ya no existe.');
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}.`);
  return res.json();
}

async function leerGist() {
  const gist = await api(`/gists/${config.gistId}`);
  const fichero = gist.files?.[GIST_FILE];
  if (!fichero) return null;
  const texto = fichero.truncated ? await (await fetch(fichero.raw_url, { cache: 'no-store' })).text() : fichero.content;
  try {
    return await decryptWithKey(JSON.parse(texto), clave);
  } catch {
    // Cifrado con otra contraseña o vacío: se sobrescribe con la copia de este móvil
    return null;
  }
}

async function escribirGist() {
  const contenido = JSON.stringify(await encryptWithKey(doc, clave));
  await api(`/gists/${config.gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content: contenido } } })
  });
}

/** Lee el gist, junta y sube si al gist le falta algo. */
export function sincronizar() {
  if (!config || !clave) return Promise.resolve();
  if (enCurso) return enCurso;
  enCurso = (async () => {
    avisar({ ocupado: true });
    try {
      const remoto = await leerGist();
      fusionar(remoto);
      if (faltaEnRemoto(remoto)) await escribirGist();
      avisar({ ocupado: false, ultima: new Date(), error: null });
    } catch (e) {
      avisar({ ocupado: false, error: e.message || 'No se pudo sincronizar.' });
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

function programarSubida() {
  if (!config || !clave) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(sincronizar, ESPERA_SUBIDA_MS);
}

const alVolver = () => {
  if (document.visibilityState === 'visible') sincronizar();
};

function arrancarCiclo() {
  clearInterval(intervalo);
  intervalo = setInterval(() => {
    if (document.visibilityState === 'visible') sincronizar();
  }, INTERVALO_MS);
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('online', sincronizar);
  sincronizar();
}

function pararCiclo() {
  clearInterval(intervalo);
  clearTimeout(temporizador);
  document.removeEventListener('visibilitychange', alVolver);
  window.removeEventListener('online', sincronizar);
}

async function guardarConfig() {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(await encryptWithKey(config, clave)));
    else localStorage.removeItem(CONFIG_KEY);
  } catch (e) {
    console.error('Error guardando la configuración de sincronización', e);
  }
}

/** Arranca la sincronización al desbloquear, si este móvil ya tiene token. */
export async function iniciarSync(cryptoKey, semana) {
  clave = cryptoKey;
  if (semana) alinearSemana(semana);
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    config = raw ? await decryptWithKey(JSON.parse(raw), clave) : null;
  } catch {
    config = null;
  }
  avisar({ conectado: !!config });
  if (config) arrancarCiclo();
}

/** Para la sincronización al bloquear (la configuración sigue guardada y cifrada). */
export function detenerSync() {
  pararCiclo();
  clave = null;
  config = null;
  avisar({ conectado: false, ultima: null, error: null });
}

/** Busca el gist de NutriPlan de la cuenta del token o crea uno secreto. */
export async function conectarGist(token) {
  config = { token: token.trim(), gistId: null };
  try {
    for (let pagina = 1; pagina <= 5 && !config.gistId; pagina++) {
      const gists = await api(`/gists?per_page=100&page=${pagina}`);
      config.gistId = gists.find((g) => g.files?.[GIST_FILE])?.id || null;
      if (gists.length < 100) break;
    }
    if (!config.gistId) {
      const nuevo = await api('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: 'NutriPlan: sincronización entre móviles (cifrado)',
          public: false,
          files: { [GIST_FILE]: { content: JSON.stringify(await encryptWithKey(doc, clave)) } }
        })
      });
      config.gistId = nuevo.id;
    }
  } catch (e) {
    config = null;
    throw e;
  }
  await guardarConfig();
  avisar({ conectado: true, error: null });
  arrancarCiclo();
}

export async function desconectarGist() {
  pararCiclo();
  config = null;
  await guardarConfig();
  avisar({ conectado: false, ultima: null, error: null });
}

// --- Enlace para compartir ---------------------------------------------------

const aBase64Url = (bytes) => uint8ArrayToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64Url = (s) => base64ToUint8Array(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function transformar(bytes, Stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer());
}

/**
 * Enlace con los cambios de la semana (y, si se pide, el token) cifrados.
 * El fragmento (#...) nunca llega a GitHub Pages: solo lo ve quien abre el enlace.
 */
export async function crearEnlace({ conToken = false } = {}) {
  const contenido = { doc, ...(conToken && config ? { config } : {}) };
  let bytes = new TextEncoder().encode(JSON.stringify(await encryptWithKey(contenido, clave)));
  const comprimir = typeof CompressionStream !== 'undefined';
  if (comprimir) bytes = await transformar(bytes, CompressionStream);
  const url = new URL(window.location.href);
  url.hash = `sync=${comprimir ? 'z' : 'p'}${aBase64Url(bytes)}`;
  return url.toString();
}

/**
 * Aplica un enlace #sync=... recibido. Devuelve un resumen para avisar a la persona
 * o null si no había enlace.
 */
export async function aplicarEnlace() {
  const m = /[#&]sync=([zp])([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!m || !clave) return null;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    let bytes = deBase64Url(m[2]);
    if (m[1] === 'z') bytes = await transformar(bytes, DecompressionStream);
    const contenido = await decryptWithKey(JSON.parse(new TextDecoder().decode(bytes)), clave);
    let texto;
    if (contenido.doc?.semana && contenido.doc.semana !== doc.semana) {
      texto = 'Los cambios del enlace son de otra semana del menú, así que no se han aplicado.';
    } else {
      texto = fusionar(contenido.doc) ? 'Cambios del otro móvil aplicados.' : 'Ya tenías todos los cambios del enlace.';
    }
    if (contenido.config?.token && !config) {
      config = contenido.config;
      await guardarConfig();
      avisar({ conectado: true, error: null });
      arrancarCiclo();
      texto += ' La sincronización automática queda activada en este móvil.';
    } else {
      programarSubida();
    }
    return { ok: true, texto };
  } catch {
    return { ok: false, texto: 'No se pudo leer el enlace (¿está incompleto o es de otra contraseña?).' };
  }
}

export const URL_NUEVO_TOKEN = 'https://github.com/settings/tokens/new?scopes=gist&description=NutriPlan%20sincronizaci%C3%B3n';
