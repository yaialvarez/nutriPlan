import { FUERA, recetaDeToma } from './semana.js';

const TOMAS = ['comida', 'cena'];

const redondear = (x) => Math.round(x * 100) / 100;

const lista = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** 'comida del lunes', como las etiquetas que pone el planificador en la lista. */
const etiquetaToma = (dia, tipo) => `${tipo} del ${(dia.dia || '').split(' ')[0].toLowerCase()}`;

/** Por regla de compra: cantidad total (en su medida) y tomas que la usan. */
function necesidades(menu, compraRecetas, receta) {
  const total = {};
  (menu?.dias || []).forEach((d, idx) => {
    for (const tipo of TOMAS) {
      const r = compraRecetas.recetas?.[receta(d, idx, tipo)];
      if (!r) continue;
      for (const [clave, q] of Object.entries(r.necesidades)) {
        const n = (total[clave] ||= { cantidad: 0, usos: [] });
        n.cantidad += q;
        const e = etiquetaToma(d, tipo);
        if (!n.usos.includes(e)) n.usos.push(e);
      }
    }
  });
  return total;
}

/** Envases a comprar, con el mismo redondeo que scripts/planificar_semana.py. */
function envases(n, producto) {
  if (!n) return 0;
  if (!producto?.envase) return 1;
  return Math.max(1, Math.ceil(n.cantidad / producto.envase - 0.15));
}

/** Cambia las tomas del nombre ("Pimiento rojo (comida del lunes)"); deja igual los fijos como los tentempiés. */
function reetiquetar(texto, usos) {
  const m = /^(.*?) \((.*)\)$/.exec(texto || '');
  if (!m) return `${texto} (${lista(usos)})`;
  return /(comida|cena) del /.test(m[2]) ? `${m[1]} (${lista(usos)})` : texto;
}

/**
 * Lista de la compra con los cambios hechos en el menú (platos cambiados, comidas fuera y
 * huecos rellenados). Parte de la lista publicada y, con data/compra_recetas.json, suma o
 * resta envases según lo que piden las recetas antes y después de los cambios.
 *
 * Devuelve { pasillos, quitados, tomas, sinProducto }:
 * - pasillos: como lista_compra.json; los artículos tocados llevan ajuste { antes, delta };
 * - quitados: artículos que ya no hacen falta;
 * - tomas: cada toma cambiada { slot, etiqueta, original, nueva } (nueva null = comemos fuera);
 * - sinProducto: ingredientes de recetas nuevas que no tienen producto asignado.
 */
export function recalcularLista({ listaData, menuData, recetarioData, cambios, compraRecetas }) {
  const pasillos = (listaData?.pasillos || []).map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) }));
  const recetas = Object.fromEntries((recetarioData || []).map((r) => [r.id, r]));
  const tomas = [];
  const sinProducto = [];

  Object.entries(cambios || {}).forEach(([slot, valor]) => {
    const [idx, tipo] = slot.split('-');
    const dia = menuData?.dias?.[Number(idx)];
    if (!dia) return;
    const nueva = valor === FUERA ? null : recetas[valor];
    if (valor !== FUERA && !nueva) return;
    tomas.push({ slot, idx: Number(idx), tipo, etiqueta: `${dia.dia} · ${tipo}`, original: dia[tipo]?.receta_id ? dia[tipo].nombre : null, nueva });
    if (!nueva) return;
    // Sin compra por receta (datos antiguos) se listan todos sus ingredientes para revisarlos a mano
    const sueltos = compraRecetas ? compraRecetas.recetas?.[nueva.id]?.sin_producto || [] : nueva.ingredientes || [];
    if (sueltos.length) sinProducto.push({ slot, etiqueta: `${dia.dia} · ${tipo}`, receta: nueva, ingredientes: sueltos });
  });
  tomas.sort((a, b) => a.idx - b.idx || TOMAS.indexOf(a.tipo) - TOMAS.indexOf(b.tipo));

  const quitados = [];
  if (compraRecetas && tomas.length) {
    const antes = necesidades(menuData, compraRecetas, (d, idx, tipo) => d[tipo]?.receta_id);
    const despues = necesidades(menuData, compraRecetas, (d, idx, tipo) => recetaDeToma(cambios, idx, tipo, d[tipo]));
    const porId = new Map();
    pasillos.forEach((p) => p.items.forEach((i) => porId.has(String(i.id)) || porId.set(String(i.id), i)));

    for (const clave of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
      const producto = compraRecetas.productos?.[clave];
      if (!producto) continue;
      const delta = envases(despues[clave], producto) - envases(antes[clave], producto);
      const usos = despues[clave]?.usos || [];
      const mismosUsos = (antes[clave]?.usos || []).join('|') === usos.join('|');
      if (!delta && mismosUsos) continue;

      let item = porId.get(String(producto.id));
      if (!item) {
        if (delta <= 0) continue;
        item = {
          id: producto.id,
          nombre: producto.nombre,
          nombre_receta: `${producto.nombre_receta} (${lista(usos)})`,
          pasillo: producto.pasillo,
          subseccion: producto.subseccion,
          cantidad: 0,
          unidad_receta: producto.unidad_receta,
          precio_unitario: producto.precio_unitario,
          precio_referencia: producto.precio_referencia,
          formato_referencia: producto.formato_referencia,
          thumbnail: '',
          nuevo: true
        };
        let pasillo = pasillos.find((p) => p.nombre_pasillo === producto.pasillo);
        if (!pasillo) {
          pasillo = { nombre_pasillo: producto.pasillo, subtotal: 0, items: [] };
          pasillos.push(pasillo);
        }
        pasillo.items.push(item);
        porId.set(String(producto.id), item);
      } else if (usos.length && !mismosUsos) {
        item.nombre_receta = reetiquetar(item.nombre_receta || item.nombre, usos);
      }
      item.ajuste ||= { antes: item.cantidad, delta: 0 };
      item.ajuste.delta += delta;
      item.cantidad = Math.max(0, item.cantidad + delta);
      item.precio_total = item.precio_unitario != null ? redondear(item.precio_unitario * item.cantidad) : item.precio_total;
    }

    pasillos.forEach((p) => {
      p.items = p.items.filter((i) => {
        if (i.cantidad > 0) return true;
        if (!i.nuevo) quitados.push(i);
        return false;
      });
      p.subtotal = redondear(p.items.reduce((a, i) => a + (i.precio_total || 0), 0));
    });
  }

  return { pasillos: pasillos.filter((p) => p.items.length), quitados, tomas, sinProducto };
}
