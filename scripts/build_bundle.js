#!/usr/bin/env node
/**
 * Empaqueta todos los datos de data/*.json en app/src/data/bundle.json para la web.
 *
 * Con APP_PASSWORD (variable de entorno, argumento o .env local) el paquete se cifra con
 * AES-GCM 256 usando la misma clave que perfiles_encrypted.json (PBKDF2 con su salt), de modo
 * que el JavaScript publicado no contiene el menú, las recetas ni la lista en claro.
 * Sin contraseña genera un paquete abierto (solo los perfiles quedan cifrados) y avisa; con
 * EXIGIR_CIFRADO (lo pone el workflow de despliegue) falla para no publicar nunca los datos en claro.
 */

const fs = require('fs');
const path = require('path');
const { getPassword } = require('./password');

const BASE_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const TARGET_FILE = path.join(BASE_DIR, 'app', 'src', 'data', 'bundle.json');
const PERFILES_FILE = 'perfiles_encrypted.json';
// Ficheros de data/ que solo usan los scripts y no hacen falta en la web
const SOLO_SCRIPTS = new Set(['compra_semana.json']);

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const fromB64 = (str) => new Uint8Array(Buffer.from(str, 'base64'));

async function deriveKey(password, salt) {
  const subtle = globalThis.crypto.subtle;
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function readDataFiles() {
  const files = {};
  for (const name of fs.readdirSync(DATA_DIR).sort()) {
    if (!name.endsWith('.json')) continue;
    if (name.includes('cache') || name === 'perfiles.json' || name === PERFILES_FILE || SOLO_SCRIPTS.has(name)) continue;
    files[name] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  }
  return files;
}

async function main() {
  const perfilesEnc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, PERFILES_FILE), 'utf8'));
  const files = readDataFiles();
  const password = getPassword();
  let bundle;

  if (password) {
    const salt = fromB64(perfilesEnc.salt);
    const key = await deriveKey(password, salt);
    let perfiles;
    try {
      const plain = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(perfilesEnc.iv) },
        key,
        fromB64(perfilesEnc.ciphertext)
      );
      perfiles = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      console.error('[!] APP_PASSWORD no descifra perfiles_encrypted.json: revisa la contraseña.');
      process.exit(1);
    }
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify({ files, perfiles }));
    const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
    bundle = { version: 2, cifrado: true, salt: perfilesEnc.salt, iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext)) };
    console.log(`[OK] Paquete cifrado con ${Object.keys(files).length} ficheros de datos.`);
  } else if (process.env.EXIGIR_CIFRADO) {
    // El despliegue nunca publica el menú en claro: falta o está vacío el secreto
    console.error('[!] Falta APP_PASSWORD y el despliegue exige cifrado. Añade el secreto en Settings → Secrets and variables → Actions.');
    process.exit(1);
  } else {
    bundle = { version: 2, cifrado: false, files, perfiles_encrypted: perfilesEnc };
    console.warn('[AVISO] Sin APP_PASSWORD: menú, recetas y lista se publican SIN cifrar. Añade el secreto APP_PASSWORD en GitHub.');
  }

  fs.mkdirSync(path.dirname(TARGET_FILE), { recursive: true });
  fs.writeFileSync(TARGET_FILE, JSON.stringify(bundle) + '\n', 'utf8');
}

main().catch((err) => {
  console.error('[!] Error generando el paquete de datos:', err);
  process.exit(1);
});
