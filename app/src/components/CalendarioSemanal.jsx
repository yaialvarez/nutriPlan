import React, { useState } from 'react';
import { 
  Calendar, 
  Moon, 
  Sun, 
  Sparkles,
  ChevronRight,
  User
} from 'lucide-react';

export default function CalendarioSemanal({ menuData, recetarioData, onSelectReceta }) {
  const [selectedDay, setSelectedDay] = useState('Todos');

  const dias = menuData?.dias || [];
  const diasFiltrados = selectedDay === 'Todos' 
    ? dias 
    : dias.filter(d => d.dia.toLowerCase() === selectedDay.toLowerCase());

  const getRecetaDetalle = (recetaId) => {
    return recetarioData?.find(r => r.id === recetaId);
  };

  return (
    <div className="space-y-6">
      {/* Banner resumen de semana */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            {menuData?.semana || 'Plan Semanal Activo'}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
            14 Tomas Semanales Adaptadas
          </h2>
          <p className="text-emerald-100/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {menuData?.objetivo_semana}
          </p>

          {/* Quick macro legend */}
          <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-400"></span>
              <span><strong>Lord.I:</strong> Plato equilibrado (1/4 real prot, 1/4 hidrato, 1/2 verdura) • Max 135g prot • 0 batidos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              <span><strong>Doña.Y:</strong> Superávit magro (1/3-1/2 hidrato) • 1 Batido proteico tarde • Verduras cocinadas</span>
            </div>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Selector de días tipo píldora para móvil */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {['Todos', ...(menuData?.dias?.map(d => d.dia) || [])].map((dia) => (
          <button
            key={dia}
            onClick={() => setSelectedDay(dia)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDay === dia
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {dia}
          </button>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {diasFiltrados.map((diaItem, index) => (
          <div 
            key={index}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
          >
            {/* Header del día */}
            <div className="bg-slate-50/80 px-4 sm:px-5 py-3 border-b border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 text-base">{diaItem.dia}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                2 tomas principales
              </span>
            </div>

            {/* Contenido Comida y Cena */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
              {/* COMIDA */}
              <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/60 relative group hover:border-amber-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                      Comida
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                      {diaItem.comida.origen}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const rec = getRecetaDetalle(diaItem.comida.receta_id);
                      if (rec) onSelectReceta(rec);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5"
                  >
                    Ver receta
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mb-3">
                  {diaItem.comida.nombre}
                </h3>

                {/* Sub-bloques Lord.I y Doña.Y */}
                <div className="space-y-2 text-xs">
                  {/* Lord.I */}
                  <div className="bg-white/80 rounded-lg p-2.5 border border-blue-200/80">
                    <div className="flex items-center justify-between text-blue-900 font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        Lord.I:
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                        {diaItem.comida.adaptacion_lord_i?.volumen_macros}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                      {diaItem.comida.adaptacion_lord_i?.porcion}. <span className="text-slate-500">{diaItem.comida.adaptacion_lord_i?.detalles}</span>
                    </p>
                  </div>

                  {/* Doña.Y */}
                  <div className="bg-white/80 rounded-lg p-2.5 border border-rose-200/80">
                    <div className="flex items-center justify-between text-rose-900 font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-rose-600" />
                        Doña.Y:
                      </span>
                      {diaItem.comida.adaptacion_dona_y?.suplementacion && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-medium">
                          {diaItem.comida.adaptacion_dona_y?.suplementacion}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                      {diaItem.comida.adaptacion_dona_y?.porcion}. <span className="text-slate-500">{diaItem.comida.adaptacion_dona_y?.detalles}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* CENA */}
              <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/60 relative group hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-900">
                      Cena
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full">
                      {diaItem.cena.origen}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const rec = getRecetaDetalle(diaItem.cena.receta_id);
                      if (rec) onSelectReceta(rec);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5"
                  >
                    Ver receta
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mb-3">
                  {diaItem.cena.nombre}
                </h3>

                {/* Sub-bloques Lord.I y Doña.Y */}
                <div className="space-y-2 text-xs">
                  {/* Lord.I */}
                  <div className="bg-white/80 rounded-lg p-2.5 border border-blue-200/80">
                    <div className="flex items-center justify-between text-blue-900 font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        Lord.I:
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                        {diaItem.cena.adaptacion_lord_i?.volumen_macros}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                      {diaItem.cena.adaptacion_lord_i?.porcion}. <span className="text-slate-500">{diaItem.cena.adaptacion_lord_i?.detalles}</span>
                    </p>
                  </div>

                  {/* Doña.Y */}
                  <div className="bg-white/80 rounded-lg p-2.5 border border-rose-200/80">
                    <div className="flex items-center justify-between text-rose-900 font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-rose-600" />
                        Doña.Y:
                      </span>
                      {diaItem.cena.adaptacion_dona_y?.suplementacion && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-medium">
                          {diaItem.cena.adaptacion_dona_y?.suplementacion}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                      {diaItem.cena.adaptacion_dona_y?.porcion}. <span className="text-slate-500">{diaItem.cena.adaptacion_dona_y?.detalles}</span>
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
