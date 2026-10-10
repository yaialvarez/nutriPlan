import React, { useMemo, useState } from 'react';
import { X, Shuffle, Clock, RotateCcw, Check, AlertTriangle, Scale } from 'lucide-react';
import { fechasDelMenu, recetaDeToma } from '../utils/semana';
import { evaluarSemana } from '../utils/equilibrio';

/**
 * Alternativas compatibles para una toma: mismo tipo (comida/cena), apto tupper si es
 * comida de lunes a viernes, rápida si es cena de lunes a viernes. Las recetas del
 * recetario ya cumplen las reglas médicas (scripts/verificar_reglas.py).
 * Cada una se evalúa con la semana completa (utils/equilibrio.js): primero las que no
 * rompen el equilibrio, luego las que lo mejoran y las que no aparecen esta semana.
 */
function alternativas({ menuData, recetarioData, nutricion, nutricionBase, reglas, clases, cambios, idx, tipo }) {
  const dia = menuData.dias[idx];
  const fecha = fechasDelMenu(menuData)[idx];
  const laborable = fecha ? fecha.getDay() >= 1 && fecha.getDay() <= 5 : false;
  const actual = recetaDeToma(cambios, idx, tipo, dia[tipo]);
  const enLaSemana = new Set();
  menuData.dias.forEach((d, i) => {
    for (const t of ['comida', 'cena']) {
      const r = recetaDeToma(cambios, i, t, d[t]);
      if (r) enLaSemana.add(r);
    }
  });
  const protActual = nutricion[actual]?.lord_i?.proteina_g;
  const evaluar = (c) =>
    evaluarSemana({ menu: menuData, recetario: recetarioData, nutricion, base: nutricionBase, reglas, cambios: c, clases }).problemas;
  const antes = evaluar(cambios);
  const desvioAntes = new Map(antes.map((p) => [p.clave, p.desvio]));

  return recetarioData
    .filter((r) => r.id !== actual && r.tipo === tipo)
    .filter((r) => {
      if (!laborable) return true;
      if (tipo === 'comida') return r.apto_batch_cooking;
      return r.tiempo_minutos <= 20;
    })
    .map((r) => {
      const despues = evaluar({ ...cambios, [`${idx}-${tipo}`]: r.id });
      const clavesDespues = new Set(despues.map((p) => p.clave));
      // Nuevos o que empeoran (p. ej. de 1 pescado a 0); los que mejoran sin llegar al objetivo no se marcan
      const nuevos = despues.filter((p) => !desvioAntes.has(p.clave) || p.desvio > desvioAntes.get(p.clave));
      return {
        receta: r,
        nuevos,
        resueltos: antes.filter((p) => !clavesDespues.has(p.clave)),
        peso: nuevos.reduce((a, p) => a + (p.nivel === 'error' ? 10 : 1), 0),
        repetida: enLaSemana.has(r.id),
        distancia: protActual != null && nutricion[r.id] ? Math.abs(nutricion[r.id].lord_i.proteina_g - protActual) : 99
      };
    })
    .sort(
      (a, b) =>
        a.peso - b.peso ||
        b.resueltos.length - a.resueltos.length ||
        a.repetida - b.repetida ||
        a.distancia - b.distancia
    );
}

export default function CambiarPlatoModal(props) {
  const { menuData, recetarioData, nutricion, nutricionBase, reglas, clases, cambios, idx, tipo, onElegir, onClose } = props;
  const [verTodas, setVerTodas] = useState(false);
  const dia = menuData.dias[idx];
  const toma = dia[tipo];
  const cambiada = !!cambios[`${idx}-${tipo}`];
  const opciones = useMemo(
    () => alternativas({ menuData, recetarioData, nutricion, nutricionBase, reglas, clases, cambios, idx, tipo }),
    [menuData, recetarioData, nutricion, nutricionBase, reglas, clases, cambios, idx, tipo]
  );
  const visibles = verTodas ? opciones : opciones.slice(0, 3);
  const esBatch = /batch|tupper/i.test(toma.origen || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cambiar plato"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-violet-700 flex items-center gap-1.5">
              <Shuffle className="w-4 h-4" />
              Cambiar {tipo} · {dia.dia}
            </div>
            <p className="text-sm text-slate-600 mt-0.5">Ahora: {toma.nombre}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {esBatch && (
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
              Este plato sale del batch del domingo. Si lo cambias, la guía de batch sigue indicando el plato original: sáltate esa parte o congela la ración.
            </p>
          )}

          {visibles.map(({ receta, repetida, nuevos, resueltos }) => {
            const n = nutricion[receta.id];
            return (
              <button
                key={receta.id}
                onClick={() => onElegir(receta.id)}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-colors"
              >
                <div className="font-bold text-slate-900">{receta.nombre}</div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {receta.tiempo_minutos} min
                  </span>
                  {receta.apto_batch_cooking && <span>Apto tupper</span>}
                  {n && <span>Lord.I ~{n.lord_i.proteina_g} g prot · Doña.Y ~{n.dona_y.proteina_g} g</span>}
                  {repetida && <span className="text-amber-700 font-semibold">Ya está en la semana</span>}
                </div>
                {nuevos.map((p) => (
                  <div
                    key={p.clave}
                    className={`text-xs mt-1 flex items-start gap-1 ${p.nivel === 'error' ? 'text-rose-700 font-semibold' : 'text-amber-700'}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {p.texto}
                  </div>
                ))}
                {resueltos.map((p) => (
                  <div key={p.clave} className="text-xs mt-1 flex items-start gap-1 text-emerald-700">
                    <Scale className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Corrige: {p.texto}
                  </div>
                ))}
              </button>
            );
          })}

          {opciones.length === 0 && (
            <p className="text-sm text-slate-600">No hay alternativas compatibles en el recetario para esta toma.</p>
          )}

          {opciones.length > 3 && (
            <button
              onClick={() => setVerTodas(!verTodas)}
              className="w-full text-sm font-semibold text-slate-600 hover:text-slate-900 py-2"
            >
              {verTodas ? 'Ver menos' : `Ver todas (${opciones.length})`}
            </button>
          )}

          {cambiada && (
            <button
              onClick={() => onElegir(null)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl py-2.5"
            >
              <RotateCcw className="w-4 h-4" />
              Volver al plato original
            </button>
          )}

          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Todas las recetas del recetario cumplen las reglas médicas de los dos. Primero salen las que mantienen el equilibrio de la semana; la lista de la compra mostrará qué añadir por el cambio.
          </p>
        </div>
      </div>
    </div>
  );
}
