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
 * Valida de forma preliminar que la contraseña tenga formato válido no vacío.
 * La autenticación real se realiza criptográficamente mediante descifrado AES-GCM.
 */
export function verifyPassword(password) {
  return typeof password === 'string' && password.trim().length > 0;
}

/**
 * Guarda la sesión de autenticación en localStorage para persistencia en el dispositivo.
 */
export function saveAuthSession(password) {
  try {
    const sessionData = {
      authenticated: true,
      timestamp: Date.now(),
      token: window.btoa(encodeURIComponent(password))
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error('Error guardando portal_auth en localStorage:', e);
  }
}

/**
 * Recupera la contraseña de la sesión activa en localStorage si existe.
 */
export function getSavedAuthPassword() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.authenticated && session.token) {
      const decoded = decodeURIComponent(window.atob(session.token));
      if (decoded && typeof decoded === 'string' && decoded.length > 0) {
        return decoded;
      }
    }
  } catch {
    // Si hay error de parsing o token corrupto, limpiar
    clearAuthSession();
  }
  return null;
}

/**
 * Elimina la sesión persistente y vuelve a bloquear el portal.
 */
export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Error limpiando portal_auth:', e);
  }
}
