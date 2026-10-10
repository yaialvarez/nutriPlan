import React, { useMemo, useState } from 'react';
import { Search, Clock, BookOpen, ChevronRight } from 'lucide-react';

const FILTROS = [
  { id: 'comida', label: 'Comidas', test: (r) => r.tipo === 'comida' },
  { id: 'cena', label: 'Cenas', test: (r) => r.tipo === 'cena' },
  { id: 'postre', label: 'Postres', test: (r) => r.tipo === 'postre' },
  { id: 'tentempie', label: 'Tentempiés', test: (r) => r.tipo === 'tentempie' },
  { id: 'ambos', label: 'Aptos para los dos', test: (r) => r.apto_lord_i !== false },
  { id: 'tupper', label: 'Apto tupper', test: (r) => r.apto_batch_cooking },
  { id: 'rapido', label: 'Rápido (≤20 min)', test: (r) => r.tiempo_minutos <= 20 },
  { id: 'batch', label: 'Batch domingo', test: (r) => /batch/i.test(r.origen_cocina || '') },
  { id: 'semana', label: 'En el menú de esta semana', test: (r, enMenu) => enMenu.has(r.id) }
];

const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Recetario({ recetarioData, nutricion, menuData, onSelectReceta }) {
  const [busqueda, setBusqueda] = useState('');
  const [activos, setActivos] = useState([]);

  const enMenu = useMemo(() => {
    const ids = new Set();
    (menuData?.dias || []).forEach((d) => {
      if (d.comida?.receta_id) ids.add(d.comida.receta_id);
      if (d.cena?.receta_id) ids.add(d.cena.receta_id);
    });
    return ids;
  }, [menuData]);

  const recetas = useMemo(() => {
    const q = normalizar(busqueda);
    return recetarioData.filter((r) => {
      if (!activos.every((id) => FILTROS.find((f) => f.id === id).test(r, enMenu))) return false;
      if (!q) return true;
      const texto = normalizar(`${r.nombre} ${r.ingredientes?.map((i) => i.item).join(' ')}`);
      return texto.includes(q);
    });
  }, [recetarioData, busqueda, activos, enMenu]);

  const toggle = (id) => setActivos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-black text-slate-900">Recetario</h2>
          <span className="text-sm text-slate-500">{recetas.length} de {recetarioData.length}</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Buscar por plato o ingrediente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                activos.includes(f.id)
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              aria-pressed={activos.includes(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recetas.map((r) => {
          const n = nutricion[r.id];
          return (
            <button
              key={r.id}
              onClick={() => onSelectReceta(r)}
              className="text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-emerald-400 transition-colors flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-bold text-slate-900 leading-snug">{r.nombre}</div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-600 mt-1.5">
                  <span className="capitalize font-semibold">{r.tipo === 'tentempie' ? 'tentempié' : r.tipo}</span>
                  {r.apto_lord_i === false && <span className="text-rose-700 font-semibold">Solo Doña.Y</span>}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {r.tiempo_minutos} min
                  </span>
                  {r.apto_batch_cooking && <span>Apto tupper</span>}
                  {enMenu.has(r.id) && <span className="text-emerald-700 font-semibold">En el menú</span>}
                </div>
                {n && (
                  <div className="text-xs text-slate-500 mt-1">
                    {r.apto_lord_i === false
                      ? `Doña.Y ~${n.dona_y.proteina_g} g prot / ${n.dona_y.kcal} kcal`
                      : `Lord.I ~${n.lord_i.proteina_g} g prot / ${n.lord_i.kcal} kcal · Doña.Y ~${n.dona_y.proteina_g} g / ${n.dona_y.kcal} kcal`}
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            </button>
          );
        })}
        {recetas.length === 0 && (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Ninguna receta coincide con la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
