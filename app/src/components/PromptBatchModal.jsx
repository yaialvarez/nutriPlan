import React, { useRef, useState } from 'react';
import { X, Copy, Check, Share2, Sparkles } from 'lucide-react';

/** Muestra el prompt de batch cooking listo para copiarlo en una IA. */
export default function PromptBatchModal({ prompt, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const textoRef = useRef(null);
  const puedeCompartir = typeof navigator !== 'undefined' && !!navigator.share;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Sin permiso de portapapeles: se selecciona el texto para copiarlo a mano
      textoRef.current?.select();
      document.execCommand?.('copy');
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const compartir = async () => {
    try {
      await navigator.share({ title: 'Batch cooking de la semana', text: prompt });
    } catch {
      // Cancelado por el usuario
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Prompt de batch cooking"
      >
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Prompt para la IA
            </h2>
            <p className="text-amber-100 text-xs sm:text-sm mt-0.5">
              Cópialo en tu IA y te dará las instrucciones del batch con el menú tal y como está ahora.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-hidden flex flex-col gap-3">
          <textarea
            ref={textoRef}
            readOnly
            value={prompt}
            className="w-full flex-1 min-h-[45vh] text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={copiar}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-4 py-3 transition-colors"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado' : 'Copiar prompt'}
            </button>
            {puedeCompartir && (
              <button
                onClick={compartir}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm px-4 py-3 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Compartir con otra app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
