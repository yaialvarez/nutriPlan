import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Flame, 
  ShoppingCart, 
  LineChart, 
  ShieldCheck, 
  UtensilsCrossed,
  Lock
} from 'lucide-react';

// Importar datos locales empaquetados
import menuData from './data/menu_semanal.json';
import recetarioData from './data/recetario.json';
import listaData from './data/lista_compra.json';
import despensaData from './data/despensa_base.json';
import encryptedPerfiles from './data/perfiles_encrypted.json';

// Utilidades criptográficas
import { getSavedAuthPassword, decryptData, clearAuthSession } from './utils/crypto';

// Componentes
import LockScreen from './components/LockScreen';
import CalendarioSemanal from './components/CalendarioSemanal';
import GuiaBatchCooking from './components/GuiaBatchCooking';
import ListaCompra from './components/ListaCompra';
import BitacoraProgreso from './components/BitacoraProgreso';
import FichaRecetaModal from './components/FichaRecetaModal';
import ReglasMedicasModal from './components/ReglasMedicasModal';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [perfilesData, setPerfilesData] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState('menu');
  const [selectedReceta, setSelectedReceta] = useState(null);
  const [showReglas, setShowReglas] = useState(false);

  // Inicialización y verificación de sesión persistente
  useEffect(() => {
    async function initSession() {
      const savedPass = getSavedAuthPassword();
      if (savedPass) {
        try {
          const decrypted = await decryptData(encryptedPerfiles, savedPass);
          setPerfilesData(decrypted);
          setIsUnlocked(true);
        } catch (e) {
          console.error('Error restaurando sesión cifrada:', e);
          clearAuthSession();
          setIsUnlocked(false);
        }
      }
      setCheckingAuth(false);
    }

    initSession();
  }, []);

  const handleUnlock = async (password) => {
    const decrypted = await decryptData(encryptedPerfiles, password);
    setPerfilesData(decrypted);
    setIsUnlocked(true);
  };

  const handleLock = () => {
    clearAuthSession();
    setIsUnlocked(false);
    setPerfilesData(null);
    setSelectedReceta(null);
    setShowReglas(false);
  };

  // Spinner mínimo mientras verifica localStorage
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Si está bloqueada, renderizar exclusivamente LockScreen (nada en el DOM)
  if (!isUnlocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 pb-20 md:pb-10 animate-fadeIn">
      {/* Header Superior */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo y Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                  NutriPlan IA
                </h1>
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Privado
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                Lord.I & Doña.Y • Adaptativo
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'menu'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Menú Semanal
            </button>

            <button
              onClick={() => setActiveTab('batch')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'batch'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Batch Cooking
            </button>

            <button
              onClick={() => setActiveTab('compra')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'compra'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Lista Compra
            </button>

            <button
              onClick={() => setActiveTab('bitacora')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'bitacora'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              Bitácora
            </button>
          </nav>

          {/* Acciones de Cabecera: Reglas Médicas y Bloquear */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReglas(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Reglas Médicas</span>
              <span className="sm:hidden">Reglas</span>
            </button>

            <button
              onClick={handleLock}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              title="Bloquear portal y cerrar sesión"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bloquear</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {activeTab === 'menu' && (
          <CalendarioSemanal
            menuData={menuData}
            recetarioData={recetarioData}
            onSelectReceta={(receta) => setSelectedReceta(receta)}
          />
        )}

        {activeTab === 'batch' && (
          <GuiaBatchCooking
            batchData={menuData?.batch_cooking_domingo}
          />
        )}

        {activeTab === 'compra' && (
          <ListaCompra
            listaData={listaData}
            despensaData={despensaData}
          />
        )}

        {activeTab === 'bitacora' && (
          <BitacoraProgreso
            perfilesData={perfilesData}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Móvil (Sticky Bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            activeTab === 'menu' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          Menú
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            activeTab === 'batch' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Flame className="w-5 h-5 mb-0.5" />
          Batch
        </button>

        <button
          onClick={() => setActiveTab('compra')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            activeTab === 'compra' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          Compra
        </button>

        <button
          onClick={() => setActiveTab('bitacora')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            activeTab === 'bitacora' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LineChart className="w-5 h-5 mb-0.5" />
          Bitácora
        </button>
      </div>

      {/* Modales */}
      {selectedReceta && (
        <FichaRecetaModal
          receta={selectedReceta}
          onClose={() => setSelectedReceta(null)}
        />
      )}

      {showReglas && (
        <ReglasMedicasModal
          perfilesData={perfilesData}
          onClose={() => setShowReglas(false)}
        />
      )}
    </div>
  );
}
