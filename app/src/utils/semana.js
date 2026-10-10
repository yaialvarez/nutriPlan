import { useEffect, useState } from 'react';

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

/** Clave que identifica la semana publicada; cambia al publicar un menú nuevo. */
export function claveSemana(menu) {
  return menu?.fecha_inicio || menu?.semana || 'sin-fecha';
}

/**
 * Estado persistido en localStorage y ligado a la semana: al publicarse un menú
 * nuevo la clave cambia y el estado arranca vacío. Borra las semanas antiguas.
 */
export function useEstadoSemanal(nombre, semana, inicial) {
  const storageKey = `nutriplan_${nombre}_${semana}`;
  const leer = () => {
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
  }, [storageKey, nombre, estado]);

  return [estado, setEstado];
}

/** Receta efectiva de una toma, teniendo en cuenta los cambios hechos en la app. */
export function recetaDeToma(cambios, idx, tipo, toma) {
  return cambios[`${idx}-${tipo}`] || toma?.receta_id || null;
}
