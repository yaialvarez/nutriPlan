#!/usr/bin/env node
/**
 * Script de cifrado para perfiles.json.
 * Cifra data/perfiles.json usando PBKDF2 (100.000 iteraciones SHA-256) y AES-GCM (256-bit)
 * La clave se obtiene de la variable APP_PASSWORD, argumento de línea de comandos o .env local.
 * Salidas:
 *  - data/perfiles_encrypted.json
 *  - app/src/data/perfiles_encrypted.json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BASE_DIR = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(BASE_DIR, 'data', 'perfiles.json');
const ENV_FILE = path.join(BASE_DIR, '.env');
const TARGET_FILES = [
  path.join(BASE_DIR, 'data', 'perfiles_encrypted.json'),
  path.join(BASE_DIR, 'app', 'src', 'data', 'perfiles_encrypted.json')
];

function getPasswordFromEnv() {
  if (process.env.APP_PASSWORD) {
    return process.env.APP_PASSWORD;
  }
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('APP_PASSWORD=')) {
        return line.trim().split('=')[1].replace(/["']/g, '');
      }
    }
  }
  return null;
}

function uint8ArrayToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function deriveKey(password, saltUint8) {
  const enc = new TextEncoder();
  const subtle = globalThis.crypto.subtle;
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

async function encryptData(data, password) {
  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
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

async function askPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question('Introduce la clave de cifrado: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`[!] Error: No se encontró el archivo fuente: ${SOURCE_FILE}`);
    process.exit(1);
  }

  let password = process.argv[2] || getPasswordFromEnv();
  if (!password) {
    password = await askPassword();
  }

  if (!password) {
    console.error('[!] Error: Se requiere una contraseña para cifrar.');
    process.exit(1);
  }

  const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const encrypted = await encryptData(parsed, password);
  const formatted = JSON.stringify(encrypted, null, 2) + '\n';

  for (const target of TARGET_FILES) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, formatted, 'utf8');
    console.log(`[OK] Guardado cifrado en: ${target}`);
  }
  console.log('[OK] Cifrado completado con éxito.');
}

main().catch((err) => {
  console.error('[!] Error en cifrado:', err);
  process.exit(1);
});
