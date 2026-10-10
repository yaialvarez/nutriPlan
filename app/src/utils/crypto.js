/**
 * Módulo criptográfico client-side basado en la Web Crypto API nativa (window.crypto.subtle).
 * Proporciona derivación de claves PBKDF2 (SHA-256) y cifrado/descifrado simétrico AES-GCM (256-bit).
 */

const AUTH_STORAGE_KEY = 'portal_auth';

// Conversiones seguras Uint8Array <-> Base64 para el navegador
export function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Deriva una clave AES-GCM de 256 bits a partir de la contraseña y un salt mediante PBKDF2.
 */
export async function deriveKey(password, saltUint8) {
  const enc = new TextEncoder();
  const subtle = window.crypto.subtle;
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltUint8,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra un objeto o string con AES-GCM 256 bits usando la contraseña proporcionada.
 */
export async function encryptData(data, password) {
  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return {
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext))
  };
}

/**
 * Descifra un payload ({ salt, iv, ciphertext }) con la contraseña dada.
 */
export async function decryptData(encryptedBundle, password) {
  if (!encryptedBundle || !encryptedBundle.salt || !encryptedBundle.iv || !encryptedBundle.ciphertext) {
    throw new Error('Payload cifrado inválido');
  }

  const salt = base64ToUint8Array(encryptedBundle.salt);
  const iv = base64ToUint8Array(encryptedBundle.iv);
  const ciphertext = base64ToUint8Array(encryptedBundle.ciphertext);

  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  const text = dec.decode(decrypted);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Cifra con una CryptoKey ya derivada (formato { iv, ciphertext }).
 */
export async function encryptWithKey(data, key) {
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { v: 2, iv: uint8ArrayToBase64(iv), ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)) };
}

/**
 * Descifra un payload { iv, ciphertext } con una CryptoKey ya derivada.
 */
export async function decryptWithKey(payload, key) {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToUint8Array(payload.iv) },
    key,
    base64ToUint8Array(payload.ciphertext)
  );
  const text = new TextDecoder().decode(decrypted);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Abre el paquete de datos de la web con una CryptoKey.
 * Paquete cifrado: { cifrado: true, iv, ciphertext } -> { files, perfiles }.
 * Paquete abierto: { cifrado: false, files, perfiles_encrypted } -> solo descifra perfiles.
 */
export async function openBundle(bundle, key) {
  if (bundle.cifrado) {
    return decryptWithKey(bundle, key);
  }
  const perfiles = await decryptWithKey(bundle.perfiles_encrypted, key);
  return { files: bundle.files, perfiles };
}

/** Salt del paquete: es el de perfiles_encrypted.json, estable entre despliegues. */
export function bundleSalt(bundle) {
  return base64ToUint8Array(bundle.cifrado ? bundle.salt : bundle.perfiles_encrypted.salt);
}

// --- Sesión persistente: se guarda la clave derivada (no exportable) en IndexedDB, nunca la contraseña ---

const DB_NAME = 'portal_privado';
const DB_STORE = 'claves';
const DB_KEY = 'sesion';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const req = fn(tx.objectStore(DB_STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function saveSessionKey(key) {
  try {
    await idb('readwrite', (store) => store.put(key, DB_KEY));
  } catch (e) {
    console.error('No se pudo recordar la sesión en este dispositivo:', e);
  }
}

export async function loadSessionKey() {
  try {
    return (await idb('readonly', (store) => store.get(DB_KEY))) || null;
  } catch {
    return null;
  }
}

/**
 * Contraseña guardada por versiones anteriores (base64 en localStorage).
 * Solo se lee una vez para migrar a la clave derivada y se borra.
 */
export function getLegacyPassword() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session?.token) {
      return decodeURIComponent(window.atob(session.token)) || null;
    }
  } catch {
    // token corrupto
  }
  return null;
}

/**
 * Elimina la sesión persistente y vuelve a bloquear el portal.
 */
export async function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Error limpiando portal_auth:', e);
  }
  try {
    await idb('readwrite', (store) => store.delete(DB_KEY));
  } catch {
    // sin IndexedDB no hay nada que borrar
  }
}
