import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { saveAuthSession } from '../utils/crypto';

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError(false);
    setLoading(true);

    try {
      await onUnlock(password);
      saveAuthSession(password);
    } catch (err) {
      console.error('Error al inicializar sesión cifrada:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      <div className="w-full max-w-md">
        {/* Card de acceso */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          
          {/* Luz de fondo sutil */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icono e Identidad Sobria */}
          <div className="flex flex-col items-center text-center mb-8 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700/80 border border-slate-700/80 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1.5">
              Portal Privado
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Acceso restringido • Datos protegidos por cifrado cliente
            </p>
          </div>

          {/* Formulario de Desbloqueo */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label 
                htmlFor="portal-pass" 
                className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1"
              >
                Clave de Desbloqueo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="portal-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(false);
                  }}
                  autoFocus
                  placeholder="Introduce la contraseña"
                  className={`w-full pl-10 pr-10 py-3 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder-slate-600 transition-all outline-none ${
                    error 
                      ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/20' 
                      : 'border-slate-800 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 ml-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Clave de acceso incorrecta. Vuelve a intentarlo.</span>
                </div>
              )}
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Descifrando datos...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Desbloquear Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Pie de pantalla */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
            Sesión persistente en este dispositivo • AES-GCM 256 bits
          </div>
        </div>
      </div>
    </div>
  );
}
