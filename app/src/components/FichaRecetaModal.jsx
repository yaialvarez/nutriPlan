import React from 'react';
import { X, Clock, ShieldCheck, User, HeartPulse } from 'lucide-react';

export default function FichaRecetaModal({ receta, onClose }) {
  if (!receta) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 sm:p-6 flex items-start justify-between relative">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                {receta.tiempo_minutos} min
              </span>
              <span className="text-xs font-medium bg-emerald-800/40 text-emerald-100 px-2.5 py-0.5 rounded-full capitalize">
                {receta.tipo}
              </span>
              {receta.apto_batch_cooking && (
                <span className="text-xs font-medium bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-full font-bold">
                  Batch Cooking
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold leading-snug">
              {receta.nombre}
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {receta.origen_cocina}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors ml-3"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-700 divide-y divide-slate-100">
          
          {/* Sello de Seguridad Médica */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold mb-1.5 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Garantía de Seguridad Médica y Reglas del Hogar</span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
              {receta.seguridad_medica}
            </p>
          </div>

          {/* Adaptaciones Lord.I y Doña.Y */}
          <div className="pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              Adaptación de Raciones y Macros
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lord.I */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5 text-sm">
                    <User className="w-4 h-4 text-blue-600" />
                    Lord.I (Recomposición 80kg)
                  </span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-medium">
                    120-135g prot max
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-blue-900 font-medium mb-2">
                  {receta.adaptacion_lord_i?.plato}
                </p>
                <div className="text-xs text-blue-800/90 bg-white/70 rounded-lg p-2.5 border border-blue-100">
                  <span className="font-semibold text-blue-900">Proporción: </span>
                  {receta.adaptacion_lord_i?.proporciones}
                </div>
              </div>

              {/* Doña.Y */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5 text-sm">
                    <User className="w-4 h-4 text-rose-600" />
                    Doña.Y (Superávit 50kg)
                  </span>
                  <span className="text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-medium">
                    Extra hidrato + batido
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-rose-900 font-medium mb-2">
                  {receta.adaptacion_dona_y?.plato}
                </p>
                <div className="text-xs text-rose-800/90 bg-white/70 rounded-lg p-2.5 border border-rose-100">
                  <span className="font-semibold text-rose-900">Proporción: </span>
                  {receta.adaptacion_dona_y?.proporciones}
                </div>
              </div>
            </div>
          </div>

          {/* Ingredientes */}
          <div className="pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
              Ingredientes necesarios
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {receta.ingredientes?.map((ing, idx) => (
                <li 
                  key={idx}
                  className="flex items-center justify-between text-xs sm:text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100"
                >
                  <span className="font-medium text-slate-800">{ing.item}</span>
                  <span className="text-slate-500 font-mono text-xs ml-2 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    {ing.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pasos de preparación */}
          <div className="pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
              Pasos de preparación
            </h3>
            <ol className="space-y-2.5">
              {receta.pasos_preparacion?.map((paso, idx) => (
                <li key={idx} className="flex gap-3 text-xs sm:text-sm leading-relaxed">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-slate-700">{paso}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
