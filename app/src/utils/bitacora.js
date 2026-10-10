import { decryptData, encryptWithKey } from './crypto';

export const BITACORA_KEY = 'menuia_bitacora_entries_secure';
export const BITACORA_LEGACY_KEY = 'menuia_bitacora_entries';

/**
 * Las versiones anteriores cifraban la bitácora con la contraseña y un salt propio.
 * Al desbloquear con contraseña se vuelve a cifrar con la clave de sesión.
 */
export async function migrarBitacora(password, key) {
  try {
    const raw = localStorage.getItem(BITACORA_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (!payload.salt) return;
    const entries = await decryptData(payload, password);
    localStorage.setItem(BITACORA_KEY, JSON.stringify(await encryptWithKey(entries, key)));
  } catch (e) {
    console.error('No se pudo migrar la bitácora:', e);
  }
}
