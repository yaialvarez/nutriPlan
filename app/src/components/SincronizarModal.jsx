import React, { useState } from 'react';
import { X, Cloud, CloudOff, RefreshCw, Share2, Smartphone, KeyRound, ExternalLink, TriangleAlert } from 'lucide-react';
import { conectarGist, desconectarGist, sincronizar, crearEnlace, URL_NUEVO_TOKEN } from '../utils/sync';

const hora = (fecha) => fecha?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

async function compartir(url, titulo) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url });
      return 'Enlace listo para enviar.';
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }
  await navigator.clipboard.writeText(url);
  return 'Enlace copiado: pégalo en WhatsApp.';
}

export default function SincronizarModal({ estado, onClose }) {
  const [token, setToken] = useState('');
  const [conectando, setConectando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  const conectar = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    setConectando(true);
    setError(null);
    try {
      await conectarGist(token);
      setToken('');
      setAviso('Conectado. Los cambios se sincronizan solos.');
    } catch (err) {
      setError(err.message);
    } finally {
      setConectando(false);
    }
  };

  const enviar = async (conToken) => {
    setError(null);
    try {
      const url = await crearEnlace({ conToken });
      const texto = await compartir(url, conToken ? 'NutriPlan: activar sincronización' : 'NutriPlan: mis cambios');
      if (texto) setAviso(texto);
    } catch {
      setError('No se pudo crear el enlace.');
    }
  };

  const fallo = error || estado.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-300" />
              Sincronizar móviles
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              Cambios de plato, comidas fuera, compra marcada, "ya lo tengo", extras y batch cooking.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors ml-3"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm text-slate-700">
          {estado.conectado ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <Cloud className="w-4 h-4 text-emerald-600" />
                Sincronización automática activada
              </div>
              <p className="text-emerald-900/80 text-xs">
                {estado.ocupado
                  ? 'Sincronizando…'
                  : estado.ultima
                    ? `Última sincronización a las ${hora(estado.ultima)}.`
                    : 'Pendiente de la primera sincronización.'}
                {' '}Se guarda al cambiar algo y se actualiza al abrir la app y cada 30 segundos.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => sincronizar()}
                  disabled={estado.ocupado}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${estado.ocupado ? 'animate-spin' : ''}`} />
                  Sincronizar ahora
                </button>
                <button
                  onClick={() => enviar(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  Activar en el otro móvil
                </button>
                <button
                  onClick={async () => { await desconectarGist(); setAviso('Sincronización desactivada en este móvil.'); }}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <CloudOff className="w-4 h-4" />
                  Desactivar
                </button>
              </div>
              <p className="text-xs text-emerald-900/70">
                "Activar en el otro móvil" envía un enlace con el token cifrado: al abrirlo con la app desbloqueada queda conectado sin pegar nada.
              </p>
            </div>
          ) : (
            <form onSubmit={conectar} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                Sincronización automática con GitHub
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-600">
                <li>
                  Crea un token clásico con solo el permiso <strong>gist</strong>:{' '}
                  <a href={URL_NUEVO_TOKEN} target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold inline-flex items-center gap-0.5 underline">
                    abrir GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Pégalo aquí. La app crea un gist secreto y guarda en él los cambios, cifrados con la contraseña de la app.</li>
                <li>En el otro móvil, pulsa luego "Activar en el otro móvil" y envíale el enlace.</li>
              </ol>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_…"
                autoComplete="off"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={conectando || !token.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Cloud className="w-4 h-4" />
                {conectando ? 'Conectando…' : 'Conectar'}
              </button>
            </form>
          )}

          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-slate-500" />
              Sin token: enviar un enlace
            </div>
            <p className="text-xs text-slate-600">
              Manda tus cambios de esta semana por WhatsApp. Al abrir el enlace en el otro móvil se juntan con los suyos, sin borrar nada de lo que haya marcado.
            </p>
            <button
              onClick={() => enviar(false)}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              Enviar mis cambios
            </button>
          </div>

          {aviso && !fallo && <p className="text-xs font-semibold text-emerald-700">{aviso}</p>}
          {fallo && (
            <p className="text-xs font-semibold text-rose-700 flex items-start gap-1.5">
              <TriangleAlert className="w-4 h-4 shrink-0" />
              {fallo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
