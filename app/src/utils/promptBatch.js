import { fechasDelMenu, recetaDeToma, FUERA } from './semana.js';

/**
 * Prompt para pedir a una IA las instrucciones del batch cooking con el menú tal y como
 * está ahora (con los platos cambiados, las comidas fuera y los huecos rellenados).
 * Solo lleva reglas prácticas de cocina, nunca diagnósticos.
 */

const TOMAS = ['comida', 'cena'];

/** Valores por defecto acordados con la familia (se pueden cambiar aquí). */
export const AJUSTES_BATCH = {
  dia: 'domingo por la tarde',
  maximoMinutos: 150,
  adelantoCenasMinutos: 30,
  cocina: ['horno', '3 fuegos', 'microondas', 'olla exprés', 'air fryer', 'olla de cocción lenta', 'arrocera', 'batidora'],
  comensales: 'dos adultos (Lord.I y Doña.Y)'
};

const REGLAS_PRACTICAS = [
  'Nada de picante, guindilla ni chiles (el pimentón siempre dulce).',
  'Sin berenjena, aceitunas, quesos fuertes (azul, roquefort, cabra fuerte) ni coles de Bruselas.',
  'La cebolla siempre muy pochada o integrada en la cocción, nunca cruda ni poco hecha.',
  'Brócoli, coliflor, col y demás crucíferas siempre bien cocinadas (vapor, horno o hervidas), nunca crudas.',
  'Sal moderada y yodada; no añadir pastillas de caldo ni salsas saladas extra para dar sabor.',
  'Lord.I: no aumentar la cantidad de carne, pescado, huevo o lácteo de su ración respecto a la receta (como mucho unos 40 g de proteína por toma) y nada de suplementos ni proteína en polvo.',
  'Doña.Y: su ración puede llevar más hidratos o grasa buena (patata, arroz, pan, AOVE) para sumar energía.',
  'Cocinar con AOVE.'
];


const unir = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Reparto por defecto: lunes a miércoles a la nevera; jueves y viernes al congelador. */
function destino(fecha) {
  const dow = fecha?.getDay();
  if (dow >= 4 && dow <= 5) return 'congelador por defecto (pasarlo a la nevera la noche anterior)';
  return 'nevera';
}

/**
 * Clasifica cada toma del menú actual: batch (comida de lunes a viernes con receta apta
 * para tupper), en el momento, o sin cocinar (comemos fuera o toma libre).
 */
export function clasificarTomas({ menuData, recetarioData, cambios = {} }) {
  const recetas = Object.fromEntries((recetarioData || []).map((r) => [r.id, r]));
  const fechas = fechasDelMenu(menuData);
  const tomas = [];
  (menuData?.dias || []).forEach((dia, idx) => {
    const fecha = fechas[idx];
    const laborable = fecha ? fecha.getDay() >= 1 && fecha.getDay() <= 5 : false;
    for (const tipo of TOMAS) {
      const slot = `${idx}-${tipo}`;
      const toma = dia[tipo];
      const id = recetaDeToma(cambios, idx, tipo, toma);
      const receta = id ? recetas[id] : null;
      const cambiada = slot in cambios;
      const base = { slot, idx, tipo, dia, fecha, cambiada, fuera: cambios[slot] === FUERA };
      if (!receta) {
        tomas.push({ ...base, modo: 'nada', receta: null, nombre: toma?.nombre || 'Toma libre' });
        continue;
      }
      const batch = tipo === 'comida' && laborable && !!receta.apto_batch_cooking;
      tomas.push({
        ...base,
        modo: batch ? 'batch' : 'momento',
        receta,
        nombre: receta.nombre,
        // Las porciones del menú solo valen si la toma no se ha cambiado
        adaptacion: !cambiada ? toma : null,
        noApta: tipo === 'comida' && laborable && !receta.apto_batch_cooking
      });
    }
  });
  return tomas;
}

/**
 * Tomas cuyo plato de batch ya no coincide con la guía publicada: tuppers cambiados o
 * quitados, y comidas nuevas que ahora entran en el batch.
 */
export function cambiosQueAfectanAlBatch({ menuData, recetarioData, cambios = {} }) {
  const tomas = clasificarTomas({ menuData, recetarioData, cambios });
  return tomas.filter((t) => {
    if (!t.cambiada) return false;
    const original = t.dia?.[t.tipo];
    const eraBatch = !!original?.receta_id && /batch|tupper/i.test(original.origen || '');
    return eraBatch || t.modo === 'batch';
  });
}

function bloqueIngredientes(receta) {
  return (receta.ingredientes || [])
    .map((i) => `   - ${i.item}${i.cantidad ? `: ${i.cantidad}` : ''}`)
    .join('\n');
}

function bloquePasos(receta) {
  return (receta.pasos_preparacion || []).map((p, i) => `   ${i + 1}. ${p}`).join('\n');
}

function bloquePorciones(t) {
  const lord = t.adaptacion?.adaptacion_lord_i?.porcion || t.receta.adaptacion_lord_i?.plato;
  const dona = t.adaptacion?.adaptacion_dona_y?.porcion || t.receta.adaptacion_dona_y?.plato;
  const lineas = [];
  if (lord) lineas.push(`   - Lord.I: ${lord}`);
  if (dona) lineas.push(`   - Doña.Y: ${dona}`);
  return lineas.join('\n');
}

function raciones(receta, nutricion) {
  const n = nutricion?.[receta.id]?.raciones_lote;
  return n ? `la receta rinde unas ${n} raciones` : null;
}

const duracion = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);

function etiqueta(t) {
  return `${t.dia.dia} · ${t.tipo}`;
}

export function generarPromptBatch({ menuData, recetarioData, cambios = {}, nutricion = {}, despensaData, ajustes = AJUSTES_BATCH }) {
  const tomas = clasificarTomas({ menuData, recetarioData, cambios });
  const batch = tomas.filter((t) => t.modo === 'batch');
  const momento = tomas.filter((t) => t.modo === 'momento');
  const nada = tomas.filter((t) => t.modo === 'nada');
  const cambiadas = tomas.filter((t) => t.cambiada);
  const equipamiento = menuData?.batch_cooking_domingo?.equipamiento || [];
  const despensa = (despensaData?.articulos || []).map((a) => a.nombre);

  const s = [];
  s.push(
    `Eres un cocinero experto en batch cooking. Necesito que me digas, paso a paso y con horario, cómo cocinar la sesión de batch cooking del ${ajustes.dia} para la semana "${menuData?.semana || ''}" (${menuData?.ciclo_semanal || ''}).`,
    '',
    'IMPORTANTE: los ingredientes YA ESTÁN COMPRADOS en las cantidades que indico abajo. No propongas cambios grandes en las recetas, ni platos distintos, ni ingredientes nuevos que haya que comprar. Solo se admiten ajustes pequeños (orden de los pasos, técnica, aprovechar el horno o un fuego para dos cosas a la vez, cambiar un condimento por otro de la despensa). Si algún plato no se puede hacer con lo que hay, o una cantidad no da, avísalo en un apartado aparte en lugar de cambiar la receta.',
    '',
    '## Lo que busco',
    `1. Un resumen de la sesión con el tiempo total. Máximo ${duracion(ajustes.maximoMinutos)}.`,
    '2. La preparación inicial: qué sacar, qué lavar, picar o descongelar antes de empezar, y qué precalentar.',
    '3. Un cronograma con horas relativas (00:00, 00:15…) que aproveche el trabajo en paralelo con todos los aparatos disponibles (por ejemplo, la olla exprés para las legumbres o la arrocera para el arroz) e indique en cada paso qué receta se está haciendo.',
    '4. El envasado: cuántos tuppers por plato, cuánto lleva cada uno para cada persona, qué va a la nevera y qué al congelador, y cómo etiquetarlos.',
    '5. Qué hay que hacer cada día entre semana: pasar del congelador a la nevera, cómo recalentar y qué se termina en el momento (por ejemplo, un huevo a la plancha o un aliño).',
    `6. Adelantos opcionales para las cenas de la semana (cocer, picar, hacer una crema o un caldo) solo si aguantan bien en la nevera y no suman más de ${ajustes.adelantoCenasMinutos} minutos a la sesión. Si no merece la pena, dilo.`,
    '7. Avisos: cantidades que no den, ingredientes que falten o pasos de seguridad alimentaria importantes.',
    '',
    '## Cocina y hogar',
    `- Comemos ${ajustes.comensales}. Cada toma es para los dos, con raciones distintas para cada uno.`,
    `- Disponible: ${unir(ajustes.cocina)}.`
  );
  if (equipamiento.length) s.push(`- Utensilios: ${unir(equipamiento)}.`);
  if (despensa.length) s.push(`- Despensa básica que hay siempre en casa: ${unir(despensa)}.`);
  s.push('- Por defecto, los tuppers de lunes a miércoles van a la nevera (máximo 3 días) y los de jueves y viernes al congelador, para no pasar de 4 días de nevera, sobre todo si llevan pescado. No es obligatorio: si para algún plato conviene otro reparto (porque congela mal o aguanta bien en nevera), proponlo y explica por qué.');

  s.push('', '## Reglas de cocina que hay que respetar', ...REGLAS_PRACTICAS.map((r) => `- ${r}`));

  s.push('', `## Platos para el batch cooking (${batch.length})`);
  if (!batch.length) s.push('Esta semana no hay comidas de tupper en el menú.');
  batch.forEach((t, n) => {
    const extra = [raciones(t.receta, nutricion), `tiempo de receta ~${t.receta.tiempo_minutos} min`].filter(Boolean).join(', ');
    s.push(
      '',
      `### ${n + 1}. ${t.nombre}`,
      `- Para: ${etiqueta(t)} → ${destino(t.fecha)}${t.cambiada ? ' (plato cambiado respecto al menú publicado)' : ''}`,
      `- Datos: ${extra}`,
      '- Ingredientes comprados para esta toma:',
      bloqueIngredientes(t.receta)
    );
    const porciones = bloquePorciones(t);
    if (porciones) s.push('- Raciones de cada persona:', porciones);
    if (t.receta.seguridad_medica) s.push(`- Notas: ${t.receta.seguridad_medica}`);
    s.push('- Receta original:', bloquePasos(t.receta));
  });

  s.push('', `## Platos que se cocinan en el momento (${momento.length}), no van al batch`);
  momento.forEach((t) => {
    const nota = t.noApta ? ' · comida de diario que no es apta para tupper, se cocina ese día' : '';
    s.push(`- ${etiqueta(t)}: ${t.nombre} (~${t.receta.tiempo_minutos} min${nota}). Ingredientes: ${unir((t.receta.ingredientes || []).map((i) => `${i.item}${i.cantidad ? ` ${i.cantidad}` : ''}`))}.`);
  });

  if (nada.length) {
    s.push('', '## Tomas sin cocinar', ...nada.map((t) => `- ${etiqueta(t)}: ${t.fuera ? 'comemos fuera' : t.nombre}.`));
  }

  if (cambiadas.length) {
    s.push(
      '',
      '## Cambios hechos sobre el menú publicado',
      'La guía que venía con el menú ya no vale por estos cambios; los platos de arriba ya los tienen en cuenta:',
      ...cambiadas.map((t) => {
        const original = t.dia?.[t.tipo]?.receta_id ? t.dia[t.tipo].nombre : 'toma libre';
        const ahora = t.fuera ? 'comemos fuera' : t.nombre;
        return `- ${etiqueta(t)}: ${original} → ${ahora}`;
      })
    );
  }

  s.push('', 'Responde en español, con pasos cortos y claros que pueda seguir con el móvil en la cocina.');
  return s.join('\n');
}
