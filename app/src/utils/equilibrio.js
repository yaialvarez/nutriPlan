import { fechasDelMenu, recetaDeToma } from './semana.js';

/**
 * Equilibrio de la semana completa según data/reglas_semana.json. Es la misma lógica que
 * scripts/equilibrio_semanal.py (la que comprueba el despliegue): si se toca aquí, hay
 * que tocarla también allí. Aquí además se tienen en cuenta los platos cambiados en la app.
 */

const TOMAS = ['comida', 'cena'];

export function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patrones = new Map();
// Palabra completa con plural opcional: 'lenteja' casa con 'lentejas' pero 'col' no con 'coliflor'
function patron(palabra) {
  if (!patrones.has(palabra)) {
    patrones.set(palabra, new RegExp(`(^|[^a-z])${escapar(normalizar(palabra))}(s|es)?(?![a-z])`));
  }
  return patrones.get(palabra);
}

/** { grupo: [palabras encontradas] } con los grupos presentes en la receta. */
export function clasificar(receta, grupos) {
  // De un ingrediente con alternativas ("pollo o jamón") solo cuenta la primera
  const items = (receta.ingredientes || []).map((i) => normalizar(i.item).split(/\s+o\s+/)[0]);
  const texto = [normalizar(receta.nombre), ...items].join(' | ');
  const forzados = receta.grupos || {};
  const resultado = {};
  for (const [clave, grupo] of Object.entries(grupos)) {
    let t = texto;
    for (const excl of grupo.excluir || []) t = t.split(normalizar(excl)).join(' ');
    let encontradas = grupo.palabras.filter((p) => patron(p).test(t));
    if (clave in forzados) encontradas = forzados[clave] ? (encontradas.length ? encontradas : [clave]) : [];
    if (encontradas.length) resultado[clave] = encontradas;
  }
  return resultado;
}

const veces = (n) => (n === 1 ? '1 vez' : `${n} veces`);
// Redondeo de Python (al par en los .5) para dar las mismas medias que el script
function media(valores) {
  if (!valores.length) return null;
  const x = valores.reduce((a, b) => a + b, 0) / valores.length;
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
const sumaFijos = (persona, campo) => (persona?.fijos || []).reduce((a, f) => a + (f[campo] || 0), 0);

/**
 * Problemas { clave, nivel, texto } y resumen de la semana con los cambios de la app.
 * reglas null (datos antiguos sin reglas_semana.json) → sin comprobaciones.
 */
export function evaluarSemana({ menu, recetario, nutricion, base, reglas, cambios = {}, clases }) {
  if (!reglas || !menu) return { problemas: [], resumen: null };
  const recetas = Object.fromEntries(recetario.map((r) => [r.id, r]));
  const grupos = reglas.grupos || {};
  clases = clases || clasificarRecetario(recetario, reglas);
  const fechas = fechasDelMenu(menu);
  const problemas = [];
  const conteo = Object.fromEntries(Object.keys(grupos).map((g) => [g, 0]));
  const usos = {};
  const verduras = new Set();
  const protI = [];
  const kcalY = [];
  const lordI = base?.lord_i || {};
  const donaY = base?.dona_y || {};

  (menu.dias || []).forEach((d, idx) => {
    const etiqueta = d.dia || `día ${idx + 1}`;
    const dow = fechas[idx]?.getDay();
    const laborable = dow >= 1 && dow <= 5;
    let verduraDia = false;
    let completo = true;
    let pI = sumaFijos(lordI, 'proteina_g');
    let kY = sumaFijos(donaY, 'kcal');
    for (const tipo of TOMAS) {
      const rid = recetaDeToma(cambios, idx, tipo, d[tipo]);
      if (!rid || !recetas[rid]) {
        completo = false;
        continue;
      }
      usos[rid] = (usos[rid] || 0) + 1;
      const c = clases[rid];
      for (const g of Object.keys(c)) conteo[g] += 1;
      for (const v of c.verdura || []) verduras.add(v);
      verduraDia = verduraDia || 'verdura' in c;
      if ('frito' in c && tipo === 'comida' && laborable && reglas.sin_fritos_comida_laborable) {
        problemas.push({
          clave: `frito_laborable:${idx}`,
          desvio: 1,
          nivel: reglas.sin_fritos_comida_laborable.nivel,
          texto: `${etiqueta}: frito o rebozado en la comida de entre semana (${recetas[rid].nombre})`
        });
      }
      const n = nutricion[rid];
      if (n) {
        const pToma = n.lord_i?.proteina_g || 0;
        if (lordI.proteina_max_toma && pToma > lordI.proteina_max_toma) {
          problemas.push({
            clave: `prot_toma:${idx}-${tipo}`,
            desvio: pToma - lordI.proteina_max_toma,
            nivel: 'aviso',
            texto: `${etiqueta} (${tipo}): ración de Lord.I con ~${pToma} g de proteína, más de ${lordI.proteina_max_toma} g en una sola toma`
          });
        }
        pI += pToma;
        kY += n.dona_y?.kcal || 0;
      } else {
        completo = false;
      }
    }
    if (!verduraDia && completo && reglas.verdura_cada_dia) {
      problemas.push({ clave: `verdura_dia:${idx}`, desvio: 1, nivel: reglas.verdura_cada_dia.nivel, texto: `${etiqueta}: ni la comida ni la cena llevan verdura` });
    }
    if (completo) {
      protI.push(pI);
      kcalY.push(kY);
      const topeDia = lordI.proteina_max_dia || lordI.proteina_max;
      if (topeDia && pI > topeDia) {
        problemas.push({
          clave: `prot_dia:${idx}`,
          desvio: pI - topeDia,
          nivel: 'error',
          texto: `${etiqueta}: Lord.I ~${pI} g de proteína supera el tope diario de ${topeDia} g`
        });
      } else if (lordI.proteina_max && pI > lordI.proteina_max) {
        problemas.push({
          clave: `prot_alto:${idx}`,
          desvio: pI - lordI.proteina_max,
          nivel: 'aviso',
          texto: `${etiqueta}: Lord.I ~${pI} g de proteína, por encima de su rango de ${lordI.proteina_min}-${lordI.proteina_max} g`
        });
      }
    }
  });

  for (const lim of reglas.limites || []) {
    const g = lim.grupo;
    const nombre = grupos[g].nombre;
    const n = conteo[g] || 0;
    if (lim.min != null && n < lim.min) {
      problemas.push({ clave: `min:${g}`, desvio: lim.min - n, nivel: lim.nivel, texto: `${nombre}: ${veces(n)} en la semana, mínimo ${lim.min} (${lim.motivo})` });
    }
    if (lim.max != null && n > lim.max) {
      problemas.push({ clave: `max:${g}`, desvio: n - lim.max, nivel: lim.nivel, texto: `${nombre}: ${veces(n)} en la semana, máximo ${lim.max} (${lim.motivo})` });
    }
  }

  const distintas = reglas.verduras_distintas_min;
  if (distintas && verduras.size < distintas.valor) {
    problemas.push({ clave: 'verduras_distintas', desvio: distintas.valor - verduras.size, nivel: distintas.nivel, texto: `Solo ${verduras.size} verduras distintas en la semana, mínimo ${distintas.valor}` });
  }

  const repetir = reglas.receta_max_tomas;
  if (repetir) {
    for (const rid of Object.keys(usos).sort()) {
      if (usos[rid] > repetir.valor) {
        problemas.push({ clave: `repetida:${rid}`, desvio: usos[rid] - repetir.valor, nivel: repetir.nivel, texto: `'${recetas[rid].nombre}' aparece ${veces(usos[rid])} en la semana` });
      }
    }
  }

  const mediaI = media(protI);
  const mediaY = media(kcalY);
  const reglaProt = reglas.proteina_lord_i_media;
  if (reglaProt && mediaI != null) {
    // El tope manda (protección renal); quedarse algo corto solo es un aviso
    if (lordI.proteina_max && mediaI > lordI.proteina_max) {
      problemas.push({
        clave: 'prot_media',
        desvio: mediaI - lordI.proteina_max,
        nivel: reglaProt.nivel_alto || 'error',
        texto: `Lord.I: media de ~${mediaI} g de proteína al día, por encima del tope de ${lordI.proteina_max} g`
      });
    } else if (lordI.proteina_min && mediaI < lordI.proteina_min) {
      problemas.push({
        clave: 'prot_media',
        desvio: lordI.proteina_min - mediaI,
        nivel: reglaProt.nivel_bajo || 'aviso',
        texto: `Lord.I: media de ~${mediaI} g de proteína al día, por debajo de ${lordI.proteina_min} g`
      });
    }
  }
  if (reglas.kcal_dona_y_media && mediaY != null && donaY.kcal_min && mediaY < donaY.kcal_min) {
    problemas.push({
      clave: 'kcal_media',
      desvio: donaY.kcal_min - mediaY,
      nivel: reglas.kcal_dona_y_media.nivel,
      texto: `Doña.Y: media de ~${mediaY} kcal al día (con tentempiés), por debajo de ${donaY.kcal_min} kcal`
    });
  }

  return {
    problemas,
    resumen: { grupos: conteo, verduras_distintas: verduras.size, proteina_lord_i_media: mediaI, kcal_dona_y_media: mediaY }
  };
}

/** Clasificación de todo el recetario, para reutilizarla al evaluar muchas alternativas. */
export function clasificarRecetario(recetario, reglas) {
  const grupos = reglas?.grupos || {};
  return Object.fromEntries(recetario.map((r) => [r.id, clasificar(r, grupos)]));
}
