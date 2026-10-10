/**
 * Contraseña maestra para los scripts de cifrado (build_bundle.js y encrypt_perfiles.js).
 * Orden: argumento de línea de comandos, variable APP_PASSWORD y, por último, .env local.
 * Ambos scripts la leen igual para que perfiles y paquete usen siempre la misma clave.
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.resolve(__dirname, '..', '.env');

function leerDeEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return null;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const limpia = line.trim();
    if (!limpia.startsWith('APP_PASSWORD=')) continue;
    // Todo lo que va tras el primer "=", sin las comillas que lo envuelvan
    return limpia.slice('APP_PASSWORD='.length).replace(/^(['"])(.*)\1$/, '$2') || null;
  }
  return null;
}

function getPassword() {
  return process.argv[2] || process.env.APP_PASSWORD || leerDeEnvFile();
}

module.exports = { getPassword };
