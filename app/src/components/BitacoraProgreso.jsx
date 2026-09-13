import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  PlusCircle, 
  Copy, 
  Check, 
  Trash2, 
  Sparkles, 
  Lock
} from 'lucide-react';
import { encryptData, decryptData, getSavedAuthPassword } from '../utils/crypto';

const STORAGE_KEY = 'menuia_bitacora_entries_secure';
const LEGACY_STORAGE_KEY = 'menuia_bitacora_entries';

const INITIAL_ENTRIES = [
  {
    id: 1,
    fecha: '2026-09-14',
    semana: 'Semana 1 (Punto de partida)',
    peso_lord_i: 80.0,
    peso_dona_y: 50.0,
    energia_gym: 'Alta',
    notas: 'Inicio del plan. Pauta médica estricta aplicada (sin batidos para Lord.I, verduras cocinadas para Doña.Y). Batch cooking del domingo ejecutado con éxito.'
  }
];

export default function BitacoraProgreso({ perfilesData }) {
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const isLoadedRef = useRef(false);

  // Campos formulario
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [semanaNombre, setSemanaNombre] = useState(`Semana ${entries.length + 1}`);
  const [pesoLordI, setPesoLordI] = useState('80.0');
  const [pesoDonaY, setPesoDonaY] = useState('50.0');
  const [energiaGym, setEnergiaGym] = useState('Alta');
  const [notas, setNotas] = useState('');

  // Carga inicial y descifrado de bitácora
  useEffect(() => {
    async function loadEntries() {
      const password = getSavedAuthPassword();
      const savedSecure = localStorage.getItem(STORAGE_KEY);
      
      if (savedSecure && password) {
        try {
          const parsedSecure = JSON.parse(savedSecure);
          if (parsedSecure.ciphertext) {
            const decrypted = await decryptData(parsedSecure, password);
            if (Array.isArray(decrypted)) {
              setEntries(decrypted);
              isLoadedRef.current = true;
              return;
            }
          }
        } catch (e) {
          console.error('Error descifrando bitácora:', e);
        }
      }

      // Fallback a almacenamiento legacy si existía
      try {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            // Normalizar a lord_i y dona_y
            const normalized = parsed.map(item => ({
              ...item,
              peso_lord_i: item.peso_lord_i ?? 80.0,
              peso_dona_y: item.peso_dona_y ?? 50.0
            }));
            setEntries(normalized);
            isLoadedRef.current = true;
            return;
          }
        }
      } catch {}

      setEntries(INITIAL_ENTRIES);
      isLoadedRef.current = true;
    }

    loadEntries();
  }, []);

  // Guardado seguro cifrado en localStorage
  useEffect(() => {
    if (!isLoadedRef.current) {
      return;
    }
    async function persistEntries() {
      const password = getSavedAuthPassword();
      if (!password) {
        return;
      }
      try {
        const encrypted = await encryptData(entries, password);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
        // Limpiar clave legacy no cifrada
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (e) {
        console.error('Error cifrando bitácora para guardar:', e);
      }
    }

    persistEntries();
  }, [entries]);

  const handleAddEntry = (e) => {
    e.preventDefault();
    if (!pesoLordI || !pesoDonaY) return;

    const newEntry = {
      id: Date.now(),
      fecha,
      semana: semanaNombre,
      peso_lord_i: parseFloat(pesoLordI) || 80.0,
      peso_dona_y: parseFloat(pesoDonaY) || 50.0,
      energia_gym: energiaGym,
      notas: notas.trim() || 'Sin observaciones destacadas.'
    };

    setEntries([newEntry, ...entries]);
    setShowForm(false);
    setNotas('');
    setSemanaNombre(`Semana ${entries.length + 2}`);
  };

  const deleteEntry = (id) => {
    if (window.confirm('¿Eliminar esta entrada de la bitácora?')) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const copiarBitacoraParaChat = () => {
    let texto = `📊 BITÁCORA DE EVOLUCIÓN - LORD.I & DOÑA.Y\n\n`;
    entries.forEach(e => {
      const pI = e.peso_lord_i ?? 80.0;
      const pY = e.peso_dona_y ?? 50.0;
      texto += `[${e.semana} - ${e.fecha}]\n`;
      texto += `• Lord.I: ${pI} kg\n`;
      texto += `• Doña.Y: ${pY} kg\n`;
      texto += `• Energía en entrenamiento: ${e.energia_gym}\n`;
      texto += `• Notas/Sensaciones: ${e.notas}\n\n`;
    });

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const latest = entries[0] || INITIAL_ENTRIES[0];
  const latestPesoLordI = latest?.peso_lord_i ?? 80.0;
  const latestPesoDonaY = latest?.peso_dona_y ?? 50.0;

  return (
    <div className="space-y-6">
      {/* Resumen Biométrico Actual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Lord.I */}
        <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-800/40">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-blue-500/30 text-blue-200 px-3 py-1 rounded-full">
              <User className="w-3.5 h-3.5" />
              Lord.I
            </span>
            <span className="text-xs text-blue-200 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-700/50">
              Pauta Renal Preventiva
            </span>
          </div>

          <div className="flex items-baseline gap-3 my-3">
            <span className="text-4xl font-black text-white">{Number(latestPesoLordI).toFixed(1)}</span>
            <span className="text-lg text-blue-300 font-semibold">kg</span>
            <span className="text-xs text-blue-300/80 font-medium ml-auto">
              Meta: Recomposición muscular
            </span>
          </div>

          <div className="space-y-1 text-xs text-blue-100/90 pt-3 border-t border-blue-800/60 leading-relaxed">
            <p><strong>Límite Proteico Diario:</strong> 120 - 135 g/día (solo comida real).</p>
            <p><strong>Protección:</strong> Cero batidos de proteína en polvo ni aminoácidos.</p>
            <p><strong>Cocina:</strong> Cero berenjena, cero cebolla cruda, cero aceitunas, quesos suaves.</p>
          </div>
        </div>

        {/* Doña.Y */}
        <div className="bg-gradient-to-br from-rose-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-rose-900/40">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-rose-500/30 text-rose-200 px-3 py-1 rounded-full">
              <User className="w-3.5 h-3.5" />
              Doña.Y
            </span>
            <span className="text-xs text-rose-200 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-700/50">
              Pauta Metabólica & Masa Magra
            </span>
          </div>

          <div className="flex items-baseline gap-3 my-3">
            <span className="text-4xl font-black text-white">{Number(latestPesoDonaY).toFixed(1)}</span>
            <span className="text-lg text-rose-300 font-semibold">kg</span>
            <span className="text-xs text-rose-300/80 font-medium ml-auto">
              Meta: Superávit calórico y masa magra
            </span>
          </div>

          <div className="space-y-1 text-xs text-rose-100/90 pt-3 border-t border-rose-900/60 leading-relaxed">
            <p><strong>Pauta Proteica y Calórica:</strong> Ración generosa de hidratos + 1 batido proteico diario.</p>
            <p><strong>Micronutrientes Clave:</strong> Yodo y Selenio (salmón, sal yodada, huevos camperos).</p>
            <p><strong>Cocina:</strong> Vegetales bociógenos siempre cocinados; cero picante y cero coles de Bruselas.</p>
          </div>
        </div>
      </div>

      {/* Barra de Acciones de Bitácora */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              Registro Histórico Semanal
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full border border-slate-200">
              <Lock className="w-2.5 h-2.5 text-emerald-600" />
              Cifrado AES-256
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Anota tu evolución cada domingo tras pesarte para ajustar el menú de la semana entrante.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            {showForm ? 'Cancelar' : 'Nuevo Registro'}
          </button>

          <button
            onClick={copiarBitacoraParaChat}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado para el chat' : 'Copiar para el Chat IA'}
          </button>
        </div>
      </div>

      {/* Formulario desplegable para nueva entrada */}
      {showForm && (
        <form onSubmit={handleAddEntry} className="bg-white rounded-2xl border border-emerald-300 p-5 shadow-md space-y-4 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Añadir Pesaje y Sensaciones Semanales
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input 
                type="date" 
                value={fecha} 
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de Semana</label>
              <input 
                type="text" 
                value={semanaNombre} 
                onChange={(e) => setSemanaNombre(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">Peso Lord.I (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={pesoLordI} 
                onChange={(e) => setPesoLordI(e.target.value)}
                className="w-full px-3 py-1.5 bg-blue-50/50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-900 mb-1">Peso Doña.Y (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={pesoDonaY} 
                onChange={(e) => setPesoDonaY(e.target.value)}
                className="w-full px-3 py-1.5 bg-rose-50/50 border border-rose-200 rounded-lg text-xs font-bold text-rose-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Energía en Gym</label>
              <select 
                value={energiaGym} 
                onChange={(e) => setEnergiaGym(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="Muy Alta">Muy Alta 🔥</option>
                <option value="Alta">Alta 👍</option>
                <option value="Media">Media ⚖️</option>
                <option value="Baja / Cansados">Baja / Cansados 💤</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas y Sensaciones</label>
              <input 
                type="text" 
                placeholder="Ej: Nos ha encantado el chili suave; Doña.Y ha subido pesos en hipertrofia..." 
                value={notas} 
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm"
            >
              Guardar Entrada
            </button>
          </div>
        </form>
      )}

      {/* Lista Histórica */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const pI = entry.peso_lord_i ?? 80.0;
          const pY = entry.peso_dona_y ?? 50.0;

          return (
            <div 
              key={entry.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">{entry.semana}</span>
                  <span className="text-xs text-slate-400 font-mono">({entry.fecha})</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    Gym: {entry.energia_gym}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {entry.notas}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-100 self-start sm:self-center">
                <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-800">Lord.I</div>
                  <div className="text-base font-black text-slate-900">{Number(pI).toFixed(1)} kg</div>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-800">Doña.Y</div>
                  <div className="text-base font-black text-slate-900">{Number(pY).toFixed(1)} kg</div>
                </div>
                {entries.length > 1 && (
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors ml-1"
                    title="Eliminar registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Aún no hay registros en la bitácora. Haz clic en <strong>"Nuevo Registro"</strong> para anotar el pesaje del domingo.
          </div>
        )}
      </div>
    </div>
  );
}
