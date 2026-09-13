import React from 'react';
import { X, ShieldAlert, ShieldCheck, User } from 'lucide-react';

export default function ReglasMedicasModal({ perfilesData, onClose }) {
  if (!perfilesData) return null;

  const lordI = perfilesData?.lord_i;
  const donaY = perfilesData?.dona_y;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 sm:p-6 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Documento Maestro de Salud
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              Reglas Médicas y del Hogar
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              Condiciones innegociables que guían cada menú semanal y cada compra.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors ml-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700">
          
          {/* Prohibiciones Absolutas del Hogar */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <h3 className="font-bold text-rose-900 flex items-center gap-2 mb-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Prohibiciones Estructurales (Cero en Casa)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-rose-800">
              <div className="flex items-center gap-1.5">❌ Berenjena (totalmente excluida)</div>
              <div className="flex items-center gap-1.5">❌ Cebolla fresca/cruda para Lord.I (sólo pochada)</div>
              <div className="flex items-center gap-1.5">❌ Aceitunas y Olivas</div>
              <div className="flex items-center gap-1.5">❌ Quesos fuertes (azul, roquefort, cabra fuerte)</div>
              <div className="flex items-center gap-1.5">❌ Coles de Bruselas (Doña.Y)</div>
              <div className="flex items-center gap-1.5">❌ Picante, guindilla o chiles</div>
              <div className="flex items-center gap-1.5 sm:col-span-2">❌ Suplementos o batidos proteicos en polvo para Lord.I</div>
            </div>
          </div>

          {/* Perfil Lord.I */}
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-blue-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Lord.I
              </h4>
              <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                Pauta Renal Preventiva
              </span>
            </div>
            <ul className="space-y-1.5 text-blue-950">
              <li>• <strong>Límite Proteico:</strong> 1.5 - 1.7 g/kg (~120 - 135 g/día) procedente ÚNICAMENTE de comida real.</li>
              <li>• <strong>Protección Renal:</strong> Cero deshidratación, cero dietas hiperproteicas sintéticas. Cero batidos ni aminoácidos concentrados.</li>
              <li>• <strong>Plato Visual:</strong> 1/4 proteína real, 1/4 hidratos complejos, 1/2 verduras cocidas o ensalada fresca sin cebolla cruda.</li>
            </ul>
          </div>

          {/* Perfil Doña.Y */}
          <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/40">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-rose-900 flex items-center gap-2">
                <User className="w-4 h-4 text-rose-600" />
                Doña.Y
              </h4>
              <span className="text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-medium">
                Pauta Metabólica & Masa Magra
              </span>
            </div>
            <ul className="space-y-1.5 text-rose-950">
              <li>• <strong>Objetivo:</strong> Superávit calórico controlado y ganancia de masa magra.</li>
              <li>• <strong>Suplementación:</strong> 1 batido proteico diario entre horas permitido y recomendado para asegurar el objetivo calórico.</li>
              <li>• <strong>Regla Vegetales Bociógenos:</strong> Brócoli, coliflor, etc. SIEMPRE bien cocinados o al horno/vapor, nunca crudos.</li>
              <li>• <strong>Micronutrientes:</strong> Priorizar alimentos ricos en Selenio, Yodo y Zinc (salmón fresco, sal yodada, huevos camperos).</li>
            </ul>
          </div>

          {/* Logística de Cocina */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-2">
              Pauta Logística Semanal
            </h4>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>Domingo tarde:</strong> 2 horas de Batch Cooking para dejar cocinadas las bases de comida de lunes a jueves.</li>
              <li>• <strong>Cenas entre semana:</strong> Rápidas de 10 a 15 minutos (ensamblado de cremas, fajitas o tortillas).</li>
              <li>• <strong>Fin de semana:</strong> Platos disfrutones cocinados al momento (pizza artesanal el viernes, poke el sábado, etc.).</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
