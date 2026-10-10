import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Flame,
  ShoppingCart,
  LineChart,
  ShieldCheck,
  UtensilsCrossed,
  BookOpen,
  Lock,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

// Paquete de datos generado por scripts/build_bundle.js (cifrado cuando hay APP_PASSWORD)
import bundle from './data/bundle.json';

// Utilidades criptográficas
import {
  deriveKey,
  openBundle,
  bundleSalt,
  saveSessionKey,
  loadSessionKey,
  getLegacyPassword,
  clearAuthSession
} from './utils/crypto';
import { migrarBitacora } from './utils/bitacora';
import { claveSemana, useEstadoSemanal } from './utils/semana';

// Componentes
import LockScreen from './components/LockScreen';
import CalendarioSemanal from './components/CalendarioSemanal';
import GuiaBatchCooking from './components/GuiaBatchCooking';
import ListaCompra from './components/ListaCompra';
import Recetario from './components/Recetario';
import BitacoraProgreso from './components/BitacoraProgreso';
import FichaRecetaModal from './components/FichaRecetaModal';
import ReglasMedicasModal from './components/ReglasMedicasModal';
import CambiarPlatoModal from './components/CambiarPlatoModal';

const TABS = [
  { id: 'menu', label: 'Menú Semanal', corto: 'Menú', icon: Calendar, color: 'text-emerald-700', colorMovil: 'text-emerald-600' },
  { id: 'batch', label: 'Batch Cooking', corto: 'Batch', icon: Flame, color: 'text-amber-700', colorMovil: 'text-amber-600' },
  { id: 'compra', label: 'Lista Compra', corto: 'Compra', icon: ShoppingCart, color: 'text-emerald-700', colorMovil: 'text-emerald-600' },
  { id: 'recetas', label: 'Recetario', corto: 'Recetas', icon: BookOpen, color: 'text-emerald-700', colorMovil: 'text-emerald-600' },
  { id: 'bitacora', label: 'Bitácora', corto: 'Bitácora', icon: LineChart, color: 'text-slate-900', colorMovil: 'text-slate-900' }
];

const SIN_RECETAS = [];
const SIN_DATOS = {};

const TEMA_KEY = 'nutriplan_tema';
const TEMAS = ['auto', 'claro', 'oscuro'];

function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(TEMA_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const oscuro = tema === 'oscuro' || (tema === 'auto' && media.matches);
      document.documentElement.classList.toggle('dark', oscuro);
    };
    aplicar();
    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      // sin almacenamiento local
    }
    media.addEventListener('change', aplicar);
    return () => media.removeEventListener('change', aplicar);
  }, [tema]);

  const siguiente = () => setTema(TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length]);
  return [tema, siguiente];
}

export default function App() {
  const [datos, setDatos] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState('menu');
  const [selectedReceta, setSelectedReceta] = useState(null);
  const [showReglas, setShowReglas] = useState(false);
  const [cambiando, setCambiando] = useState(null);
  const [tema, siguienteTema] = useTema();

  const unlockWithPassword = async (password) => {
    const key = await deriveKey(password, bundleSalt(bundle));
    const abiertos = await openBundle(bundle, key);
    await migrarBitacora(password, key);
    await saveSessionKey(key);
    try {
      localStorage.removeItem('portal_auth');
    } catch {
      // sin almacenamiento local
    }
    setCryptoKey(key);
    setDatos(abiertos);
  };

  // Restaurar sesión: clave derivada guardada o, una sola vez, la contraseña de versiones anteriores
  useEffect(() => {
    async function initSession() {
      const key = await loadSessionKey();
      if (key) {
        try {
          setDatos(await openBundle(bundle, key));
          setCryptoKey(key);
          setCheckingAuth(false);
          return;
        } catch (e) {
          console.error('La clave guardada ya no abre los datos:', e);
          await clearAuthSession();
        }
      }
      const legacy = getLegacyPassword();
      if (legacy) {
        try {
          await unlockWithPassword(legacy);
        } catch {
          await clearAuthSession();
        }
      }
      setCheckingAuth(false);
    }

    initSession();
  }, []);

  const handleLock = async () => {
    await clearAuthSession();
    setDatos(null);
    setCryptoKey(null);
    setSelectedReceta(null);
    setShowReglas(false);
    setCambiando(null);
  };

  const files = datos?.files;
  const menuData = files?.['menu_semanal.json'];
  const recetarioData = files?.['recetario.json'] || SIN_RECETAS;
  const listaData = files?.['lista_compra.json'];
  const despensaData = files?.['despensa_base.json'];
  const nutricion = files?.['nutricion_recetas.json']?.recetas || SIN_DATOS;
  const nutricionBase = files?.['nutricion_base.json'] || SIN_DATOS;
  const semana = claveSemana(menuData);
  const [cambios, setCambios] = useEstadoSemanal('cambios', semana, {});

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Si está bloqueada, renderizar exclusivamente LockScreen (nada en el DOM)
  if (!datos) {
    return <LockScreen onUnlock={unlockWithPassword} />;
  }

  const TemaIcon = tema === 'oscuro' ? Moon : tema === 'claro' ? Sun : Monitor;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 pb-24 md:pb-10 animate-fadeIn">
      {/* Header Superior */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                NutriPlan IA
              </h1>
              <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5 truncate">
                Lord.I & Doña.Y
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {TABS.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === id ? `bg-white ${color} shadow-xs` : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={siguienteTema}
              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl transition-colors"
              title={`Tema: ${tema}`}
              aria-label={`Cambiar tema (ahora ${tema})`}
            >
              <TemaIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowReglas(true)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Reglas Médicas</span>
              <span className="sm:hidden">Reglas</span>
            </button>

            <button
              onClick={handleLock}
              className="p-2 sm:px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
              title="Bloquear portal y cerrar sesión"
              aria-label="Bloquear portal"
            >
              <Lock className="w-4 h-4" />
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
            nutricion={nutricion}
            nutricionBase={nutricionBase}
            cambios={cambios}
            onSelectReceta={(receta) => setSelectedReceta(receta)}
            onCambiar={(idx, tipo) => setCambiando({ idx, tipo })}
          />
        )}

        {activeTab === 'batch' && (
          <GuiaBatchCooking
            batchData={menuData?.batch_cooking_domingo}
            semana={semana}
          />
        )}

        {activeTab === 'compra' && (
          <ListaCompra
            listaData={listaData}
            despensaData={despensaData}
            preciosLidl={files?.['precios_lidl.json']}
            semana={semana}
            menuData={menuData}
            recetarioData={recetarioData}
            cambios={cambios}
          />
        )}

        {activeTab === 'recetas' && (
          <Recetario
            recetarioData={recetarioData}
            nutricion={nutricion}
            menuData={menuData}
            onSelectReceta={(receta) => setSelectedReceta(receta)}
          />
        )}

        {activeTab === 'bitacora' && (
          <BitacoraProgreso
            perfilesData={datos.perfiles}
            cryptoKey={cryptoKey}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
        {TABS.map(({ id, corto, icon: Icon, colorMovil }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center py-1 px-2 min-w-[3.5rem] rounded-lg text-xs font-bold transition-colors ${
              activeTab === id ? colorMovil : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-6 h-6 mb-0.5" />
            {corto}
          </button>
        ))}
      </nav>

      {/* Modales */}
      {selectedReceta && (
        <FichaRecetaModal
          receta={selectedReceta}
          nutricion={nutricion[selectedReceta.id]}
          onClose={() => setSelectedReceta(null)}
        />
      )}

      {showReglas && (
        <ReglasMedicasModal
          perfilesData={datos.perfiles}
          onClose={() => setShowReglas(false)}
        />
      )}

      {cambiando && (
        <CambiarPlatoModal
          menuData={menuData}
          recetarioData={recetarioData}
          nutricion={nutricion}
          cambios={cambios}
          idx={cambiando.idx}
          tipo={cambiando.tipo}
          onElegir={(recetaId) => {
            const slot = `${cambiando.idx}-${cambiando.tipo}`;
            setCambios((prev) => {
              const next = { ...prev };
              if (recetaId) next[slot] = recetaId;
              else delete next[slot];
              return next;
            });
            setCambiando(null);
          }}
          onClose={() => setCambiando(null)}
        />
      )}
    </div>
  );
}
