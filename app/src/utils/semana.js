import { useEffect, useState } from 'react';
import { anotarLocal, escuchar } from './sync';

/** Fecha local (sin hora) a partir de 'AAAA-MM-DD'. */
export function parseFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoy() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Fecha de cada día del menú: usa "(dd/mm)" de la etiqueta si existe y, si no,
 * fecha_inicio + posición.
 */
export function fechasDelMenu(menu) {
  const inicio = parseFecha(menu?.fecha_inicio);
  return (menu?.dias || []).map((d, idx) => {
    const m = /\((\d{1,2})\/(\d{1,2})\)/.exec(d.dia || '');
    if (m && inicio) {
      const dia = Number(m[1]);
      const mes = Number(m[2]) - 1;
      const year = mes < inicio.getMonth() ? inicio.getFullYear() + 1 : inicio.getFullYear();
      return new Date(year, mes, dia);
    }
    return inicio ? new Date(inicio.getTime() + idx * DIA_MS) : null;
  });
}

/** Índice del día de hoy en el menú, o -1 si hoy no está en el ciclo. */
export function indiceHoy(menu, ref = hoy()) {
  return fechasDelMenu(menu).findIndex((f) => f && f.getTime() === ref.getTime());
}

/** true cuando la fecha de hoy ya ha pasado el último día del menú. */
export function menuCaducado(menu, ref = hoy()) {
  const fechas = fechasDelMenu(menu).filter(Boolean);
  if (!fechas.length) return false;
  return ref.getTime() > fechas[fechas.length - 1].getTime();
}

/**
 * Clave que identifica la semana publicada; cambia al publicar un menú nuevo.
 * null mientras no hay menú (portal bloqueado o cargando).
 */
export function claveSemana(menu) {
  if (!menu) return null;
  return menu.fecha_inicio || menu.semana || 'sin-fecha';
}

/**
 * Estado persistido en localStorage y ligado a la semana: al publicarse un menú
 * nuevo la clave cambia y el estado arranca vacío. Borra las semanas antiguas.
 * Con semana null (portal bloqueado) no lee ni escribe nada, para no borrar el
 * estado de la semana en curso antes de desbloquear.
 * Cada cambio se anota para sincronizarlo con el otro móvil (utils/sync.js), y los
 * cambios que llegan de fuera se aplican aquí.
 */
export function useEstadoSemanal(nombre, semana, inicial) {
  const storageKey = semana ? `nutriplan_${nombre}_${semana}` : null;
  const leer = () => {
    if (!storageKey) return inicial;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : inicial;
    } catch {
      return inicial;
    }
  };
  const [estado, setEstado] = useState(leer);
  const [clave, setClave] = useState(storageKey);

  if (clave !== storageKey) {
    setClave(storageKey);
    setEstado(leer());
  }

  useEffect(() => {
    if (!storageKey) return undefined;
    return escuchar(nombre, setEstado);
  }, [storageKey, nombre]);

  useEffect(() => {
    if (!storageKey) return;
    anotarLocal(nombre, semana, estado);
    try {
      localStorage.setItem(storageKey, JSON.stringify(estado));
      const prefijo = `nutriplan_${nombre}_`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefijo) && k !== storageKey) localStorage.removeItem(k);
      }
    } catch (e) {
      console.error(`Error guardando ${nombre}`, e);
    }
  }, [storageKey, nombre, semana, estado]);

  return [estado, setEstado];
}

/** Valor de un cambio que deja la toma vacía (comemos fuera): no aporta receta ni compra. */
export const FUERA = '__fuera__';

/** Receta efectiva de una toma, teniendo en cuenta los cambios hechos en la app. */
export function recetaDeToma(cambios, idx, tipo, toma) {
  const cambio = cambios[`${idx}-${tipo}`];
  if (cambio === FUERA) return null;
  return cambio || toma?.receta_id || null;
}
