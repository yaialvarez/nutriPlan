import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Moon,
  Sun,
  Sparkles,
  ChevronRight,
  ChevronDown,
  User,
  Shuffle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { fechasDelMenu, indiceHoy, menuCaducado, recetaDeToma } from '../utils/semana';

const fmtFecha = (f) => f?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** Proteína y kcal del día por persona: tomas con receta + fijos (desayuno, batido...). */
function totalesDia(dia, idx, cambios, nutricion, nutricionBase) {
  const totales = {};
  let parcial = false;
  for (const persona of ['lord_i', 'dona_y']) {
    const fijos = nutricionBase?.[persona]?.fijos || [];
    totales[persona] = {
      proteina_g: fijos.reduce((a, f) => a + (f.proteina_g || 0), 0),
      kcal: fijos.reduce((a, f) => a + (f.kcal || 0), 0)
    };
  }
  for (const tipo of ['comida', 'cena']) {
    const n = nutricion[recetaDeToma(cambios, idx, tipo, dia[tipo])];
    if (!n) {
      parcial = true;
      continue;
    }
    for (const persona of ['lord_i', 'dona_y']) {
      totales[persona].proteina_g += n[persona]?.proteina_g || 0;
      totales[persona].kcal += n[persona]?.kcal || 0;
    }
  }
  return { ...totales, parcial };
}

function ResumenNutricional({ totales, nutricionBase }) {
  const max = nutricionBase?.lord_i?.proteina_max;
  const min = nutricionBase?.lord_i?.proteina_min;
  const protI = totales.lord_i.proteina_g;
  const estadoI = max && protI > max ? 'alto' : min && protI < min ? 'bajo' : 'ok';
  const estilos = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    bajo: 'bg-sky-50 text-sky-800 border-sky-200',
    alto: 'bg-rose-50 text-rose-800 border-rose-300'
  };
  const textoI = { ok: 'dentro del límite', bajo: 'por debajo del objetivo', alto: 'supera el límite renal' };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
      <div className={`rounded-lg border px-3 py-2 ${estilos[estadoI]}`}>
        <div className="font-bold">Lord.I: ~{protI} g proteína · ~{totales.lord_i.kcal} kcal</div>
        <div className="text-xs">
          {max ? `${textoI[estadoI]} (${min}-${max} g)` : 'Sin límite configurado'}
          {totales.parcial && ' · sin contar comidas fuera'}
        </div>
      </div>
      <div className="rounded-lg border px-3 py-2 bg-rose-50/60 text-rose-900 border-rose-200">
        <div className="font-bold">Doña.Y: ~{totales.dona_y.proteina_g} g proteína · ~{totales.dona_y.kcal} kcal</div>
        <div className="text-xs">
          Incluye desayuno y batido estimados{totales.parcial && ' · sin contar comidas fuera'}
        </div>
      </div>
    </div>
  );
}

function Toma({ tipo, toma, idx, cambios, recetario, nutricion, abierta, onSelectReceta, onCambiar }) {
  const [verAdaptaciones, setVerAdaptaciones] = useState(abierta);
  const recetaId = recetaDeToma(cambios, idx, tipo, toma);
  const cambiada = !!cambios[`${idx}-${tipo}`];
  const receta = recetario.find((r) => r.id === recetaId);
  const n = nutricion[recetaId];
  const esComida = tipo === 'comida';
  const Icon = esComida ? Sun : Moon;
  const tono = esComida
    ? { caja: 'bg-amber-50/50 border-amber-200/60', titulo: 'text-amber-900', icono: 'text-amber-600', chip: 'bg-amber-100 text-amber-800' }
    : { caja: 'bg-indigo-50/50 border-indigo-200/60', titulo: 'text-indigo-900', icono: 'text-indigo-600', chip: 'bg-indigo-100 text-indigo-800' };

  // Con un plato cambiado, las adaptaciones vienen de la receta nueva
  const adaptI = cambiada
    ? { porcion: receta?.adaptacion_lord_i?.plato, detalles: receta?.adaptacion_lord_i?.proporciones }
    : toma.adaptacion_lord_i;
  const adaptY = cambiada
    ? { porcion: receta?.adaptacion_dona_y?.plato, detalles: receta?.adaptacion_dona_y?.proporciones }
    : toma.adaptacion_dona_y;

  return (
    <div className={`rounded-xl p-3.5 border ${tono.caja}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Icon className={`w-4 h-4 ${tono.icono}`} />
          <span className={`text-sm font-black uppercase tracking-wider ${tono.titulo}`}>
            {esComida ? 'Comida' : 'Cena'}
          </span>
          {cambiada && (
            <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2 py-0.5 rounded-full">
              Cambiado
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(toma.receta_id || cambiada) && (
            <button
              onClick={() => onCambiar(idx, tipo)}
              className="text-sm font-semibold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1 py-1"
            >
              <Shuffle className="w-4 h-4" />
              Cambiar
            </button>
          )}
          {receta && (
            <button
              onClick={() => onSelectReceta(receta)}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5 py-1"
            >
              Receta
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <h3 className="font-bold text-slate-900 text-base leading-snug">
        {cambiada ? receta?.nombre : toma.nombre}
      </h3>
      {cambiada && (
        <p className="text-xs text-slate-500 line-through mt-0.5">{toma.nombre}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
        <span className={`font-medium px-2 py-0.5 rounded-full ${tono.chip}`}>
          {cambiada ? receta?.origen_cocina : toma.origen}
        </span>
        {(toma.tiempo_preparacion || receta?.tiempo_minutos) && (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Clock className="w-3.5 h-3.5" />
            {cambiada ? `${receta?.tiempo_minutos} min` : toma.tiempo_preparacion || `${receta?.tiempo_minutos} min`}
          </span>
        )}
        {n && (
          <span className="text-slate-600">
            Lord.I ~{n.lord_i.proteina_g} g prot · Doña.Y ~{n.dona_y.proteina_g} g prot
          </span>
        )}
      </div>

      {(adaptI?.porcion || adaptY?.porcion) && (
        <button
          onClick={() => setVerAdaptaciones(!verAdaptaciones)}
          className="mt-2 text-sm font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 py-1"
          aria-expanded={verAdaptaciones}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${verAdaptaciones ? 'rotate-180' : ''}`} />
          {verAdaptaciones ? 'Ocultar raciones' : 'Ver raciones de cada uno'}
        </button>
      )}

      {verAdaptaciones && (
        <div className="space-y-2 text-sm mt-2">
          <div className="bg-white/80 rounded-lg p-2.5 border border-blue-200/80">
            <div className="flex items-center justify-between gap-2 text-blue-900 font-semibold mb-1 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4 text-blue-600" />
                Lord.I
              </span>
              {!cambiada && adaptI?.volumen_macros && (
                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                  {adaptI.volumen_macros}
                </span>
              )}
            </div>
            <p className="text-slate-700 leading-relaxed">
              {adaptI?.porcion}. <span className="text-slate-500">{adaptI?.detalles}</span>
            </p>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 border border-rose-200/80">
            <div className="flex items-center justify-between gap-2 text-rose-900 font-semibold mb-1 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4 text-rose-600" />
                Doña.Y
              </span>
              {!cambiada && adaptY?.suplementacion && (
                <span className="text-xs bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">
                  {adaptY.suplementacion}
                </span>
              )}
            </div>
            <p className="text-slate-700 leading-relaxed">
              {adaptY?.porcion}. <span className="text-slate-500">{adaptY?.detalles}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaDia({ dia, idx, fecha, esHoy, props }) {
  const totales = totalesDia(dia, idx, props.cambios, props.nutricion, props.nutricionBase);
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col ${
        esHoy ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-slate-200/80'
      }`}
    >
      <div className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between ${
        esHoy ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50/80 border-slate-200/60'
      }`}>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-slate-800 text-base">{dia.dia}</span>
        </div>
        {esHoy && (
          <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">Hoy</span>
        )}
        {!esHoy && fecha && <span className="text-xs text-slate-500">{fmtFecha(fecha)}</span>}
      </div>
      <div className="p-4 sm:p-5 space-y-3 flex-1">
        <Toma tipo="comida" toma={dia.comida} idx={idx} abierta={esHoy} {...props} recetario={props.recetarioData} />
        <Toma tipo="cena" toma={dia.cena} idx={idx} abierta={esHoy} {...props} recetario={props.recetarioData} />
        <ResumenNutricional totales={totales} nutricionBase={props.nutricionBase} />
      </div>
    </div>
  );
}

export default function CalendarioSemanal(props) {
  const { menuData } = props;
  const dias = useMemo(() => menuData?.dias || [], [menuData]);
  const fechas = useMemo(() => fechasDelMenu(menuData), [menuData]);
  const idxHoy = indiceHoy(menuData);
  const caducado = menuCaducado(menuData);
  const [verPasados, setVerPasados] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Orden: hoy y los días siguientes primero; los días ya pasados al final
  const proximos = idxHoy >= 0 ? dias.map((d, i) => i).filter((i) => i >= idxHoy) : dias.map((d, i) => i);
  const pasados = idxHoy >= 0 ? dias.map((d, i) => i).filter((i) => i < idxHoy) : [];
  const visibles = selectedDay !== null ? [selectedDay] : proximos;

  const inicio = fechas[0];
  const fin = fechas[fechas.length - 1];

  return (
    <div className="space-y-5">
      {caducado && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 flex items-start gap-3" role="alert">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Este menú es de la semana pasada ({fmtFecha(inicio)} – {fmtFecha(fin)}).</p>
            <p>Está pendiente de actualizar; mientras tanto se muestra el último menú publicado.</p>
          </div>
        </div>
      )}

      {/* Banner resumen de semana */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg">
        <div className="inline-flex items-center gap-2 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-semibold px-3 py-1 rounded-full mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
          {inicio && fin ? `${fmtFecha(inicio)} – ${fmtFecha(fin)}` : 'Plan semanal'}
        </div>
        <h2 className="text-lg sm:text-xl font-black tracking-tight mb-1">
          {menuData?.semana || 'Menú semanal'}
        </h2>
        <p className="text-emerald-50/90 text-sm leading-relaxed">{menuData?.objetivo_semana}</p>
      </div>

      {/* Selector de días */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedDay(null)}
          className={`px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
            selectedDay === null ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {idxHoy >= 0 ? 'Desde hoy' : 'Toda la semana'}
        </button>
        {dias.map((d, i) => (
          <button
            key={d.dia}
            onClick={() => setSelectedDay(i)}
            className={`px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              selectedDay === i
                ? 'bg-emerald-600 text-white shadow-sm'
                : i === idxHoy
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {i === idxHoy ? 'Hoy' : d.dia.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visibles.map((i) => (
          <TarjetaDia key={`${i}-${dias[i].dia}`} dia={dias[i]} idx={i} fecha={fechas[i]} esHoy={i === idxHoy} props={props} />
        ))}
      </div>

      {selectedDay === null && pasados.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setVerPasados(!verPasados)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-between"
            aria-expanded={verPasados}
          >
            <span>Días ya pasados ({pasados.length})</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${verPasados ? 'rotate-180' : ''}`} />
          </button>
          {verPasados && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 opacity-80">
              {pasados.map((i) => (
                <TarjetaDia key={`${i}-${dias[i].dia}`} dia={dias[i]} idx={i} fecha={fechas[i]} esHoy={false} props={props} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
