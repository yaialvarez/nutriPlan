import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Layers, 
  Refrigerator, 
  RotateCcw
} from 'lucide-react';

const STORAGE_KEY = 'menuia_batch_cooking_steps';

export default function GuiaBatchCooking({ batchData }) {
  const pasos = batchData?.cronograma_pasos || [];
  
  // Cargar estado de checkboxes desde localStorage
  const [completedSteps, setCompletedSteps] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedSteps));
    } catch (e) {
      console.error('Error saving batch cooking steps', e);
    }
  }, [completedSteps]);

  const toggleStep = (orden) => {
    setCompletedSteps(prev => ({
      ...prev,
      [orden]: !prev[orden]
    }));
  };

  const resetAll = () => {
    if (window.confirm('¿Reiniciar el progreso del Batch Cooking para una nueva sesión?')) {
      setCompletedSteps({});
    }
  };

  const totalPasos = pasos.length;
  const numCompletados = pasos.filter(p => completedSteps[p.orden]).length;
  const porcentaje = totalPasos > 0 ? Math.round((numCompletados / totalPasos) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Banner de sesión */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-black/20 text-amber-100 text-xs font-semibold px-3 py-1 rounded-full mb-2">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              Sesión Estratégica del Domingo
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Guía Paso a Paso de Batch Cooking
            </h2>
            <p className="text-amber-100 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              {batchData?.resumen || 'Cocina las bases el domingo para tener comidas listas en 3 minutos de lunes a jueves.'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:text-right shrink-0 border border-white/20">
            <div className="flex items-center sm:justify-end gap-1.5 text-xs text-amber-200 font-semibold mb-1">
              <Clock className="w-4 h-4" />
              Tiempo Estimado
            </div>
            <div className="text-2xl sm:text-3xl font-black">
              {batchData?.duracion_estimada_minutos || 120} min
            </div>
            <div className="text-[11px] text-amber-200/80">
              Ahorro entre semana: ~4 horas
            </div>
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="mt-6 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span>Progreso de cocina: {numCompletados} de {totalPasos} tareas ({porcentaje}%)</span>
            {numCompletados > 0 && (
              <button 
                onClick={resetAll}
                className="inline-flex items-center gap-1 text-[11px] text-amber-200 hover:text-white underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
            )}
          </div>
          <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300"
              style={{ width: `${porcentaje}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Equipamiento recomendado */}
      {batchData?.equipamiento && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            Equipamiento para preparar antes de empezar
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {batchData.equipamiento.map((eq, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{eq}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista cronológica interactiva */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-800">
            Cronograma de elaboración
          </h3>
          <span className="text-xs text-slate-500">
            Toca el círculo para marcar completado
          </span>
        </div>

        {pasos.map((paso) => {
          const isDone = !!completedSteps[paso.orden];
          return (
            <div
              key={paso.orden}
              onClick={() => toggleStep(paso.orden)}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-4 ${
                isDone
                  ? 'bg-emerald-50/70 border-emerald-300/80 shadow-none'
                  : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* Checkbox icon */}
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStep(paso.orden);
                }}
                className="mt-0.5 shrink-0 transition-transform active:scale-95 p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={isDone ? "Marcar incompleto" : "Marcar completado"}
              >
                {isDone ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300 hover:text-slate-400" />
                )}
              </button>

              {/* Paso info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                    isDone 
                      ? 'bg-emerald-200 text-emerald-900' 
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    {paso.tiempo}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Paso {paso.orden}
                  </span>
                </div>
                <p className={`text-sm sm:text-base leading-relaxed ${
                  isDone 
                    ? 'text-slate-500 line-through' 
                    : 'text-slate-800 font-medium'
                }`}>
                  {paso.accion}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Consejos de envasado y conservación */}
      <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 flex items-start gap-3">
        <Refrigerator className="w-6 h-6 text-slate-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-700 space-y-1">
          <p className="font-bold text-slate-900">
            Pauta de Envasado y Refrigeración (Seguridad Alimentaria)
          </p>
          <p className="leading-relaxed">
            {batchData?.conservacion || 'Dejar atemperar antes de meter en nevera. Tupper de cristal hermético cerrado a 4°C. Las lentejas y curry ganan sabor con 24-48h de reposo.'}
          </p>
        </div>
      </div>
    </div>
  );
}
