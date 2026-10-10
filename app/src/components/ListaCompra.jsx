import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  RotateCcw, 
  Search, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Store,
  Archive,
  Home,
  Plus,
  Trash2,
  Shuffle,
  Pencil,
  Info
} from 'lucide-react';
import { useEstadoSemanal } from '../utils/semana';
import { precioLidl } from '../utils/supermercados';

const SUPER_KEY = 'menuia_supermercado';
const PRECIOS_LIDL_KEY = 'menuia_precios_lidl_usuario';

const leerLocal = (clave, porDefecto) => {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch {
    return porDefecto;
  }
};

const guardarLocal = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    console.error('Error guardando en localStorage', e);
  }
};

export default function ListaCompra({ listaData, despensaData, preciosLidl, semana, menuData, recetarioData, cambios }) {
  // Estado ligado a la semana: se vacía solo al publicar un menú nuevo
  const [checkedMap, setCheckedMap] = useEstadoSemanal('compra', semana, {});
  const [tengoMap, setTengoMap] = useEstadoSemanal('tengo', semana, {});
  const [extras, setExtras] = useEstadoSemanal('extras', semana, []);
  const [nuevoExtra, setNuevoExtra] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [hideChecked, setHideChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDespensa, setShowDespensa] = useState(false);
  // Supermercado elegido y precios LIDL corregidos: no dependen de la semana
  const [supermercado, setSupermercado] = useState(() => leerLocal(SUPER_KEY, 'mercadona'));
  const [preciosUsuario, setPreciosUsuario] = useState(() => leerLocal(PRECIOS_LIDL_KEY, {}));
  const [preciosCopiados, setPreciosCopiados] = useState(false);

  const esLidl = supermercado === 'lidl';
  const productosLidl = useMemo(() => preciosLidl?.productos || [], [preciosLidl]);
  const nombreSuper = esLidl ? 'LIDL' : (listaData?.supermercado || 'Mercadona');

  useEffect(() => guardarLocal(SUPER_KEY, supermercado), [supermercado]);
  useEffect(() => guardarLocal(PRECIOS_LIDL_KEY, preciosUsuario), [preciosUsuario]);

  const toggleItem = (itemId) => {
    setCheckedMap(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const toggleTengo = (itemId) => {
    setTengoMap(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const addExtra = (e) => {
    e.preventDefault();
    const nombre = nuevoExtra.trim();
    if (!nombre) return;
    setExtras(prev => [...prev, { id: `extra-${Date.now()}`, nombre }]);
    setNuevoExtra('');
  };

  const removeExtra = (id) => {
    setExtras(prev => prev.filter(x => x.id !== id));
  };

  // Ingredientes que añade cada plato cambiado en el menú
  const ajustesCambios = useMemo(() => {
    return Object.entries(cambios || {}).map(([slot, recetaId]) => {
      const [idx, tipo] = slot.split('-');
      const dia = menuData?.dias?.[Number(idx)];
      const nueva = recetarioData?.find(r => r.id === recetaId);
      if (!dia || !nueva) return null;
      return {
        slot,
        etiqueta: `${dia.dia} · ${tipo}`,
        original: dia[tipo]?.nombre,
        nueva,
      };
    }).filter(Boolean);
  }, [cambios, menuData, recetarioData]);

  const uncheckAll = () => {
    if (window.confirm('¿Desmarcar todos los artículos de la lista de la compra?')) {
      setCheckedMap({});
    }
  };

  // Cada artículo lleva su precio en el supermercado elegido (precioVista)
  const pasillos = useMemo(() => (listaData?.pasillos || []).map(p => ({
    ...p,
    items: p.items.map(i => {
      const lidl = precioLidl(i, productosLidl, preciosUsuario);
      return {
        ...i,
        lidl,
        precioVista: esLidl ? lidl.total : i.precio_total,
        unitarioVista: esLidl ? lidl.unitario : i.precio_unitario
      };
    })
  })), [listaData, productosLidl, preciosUsuario, esLidl]);

  // Comparativa de ambos supermercados sobre lo que hay que comprar y tiene precio en los dos
  const comparativa = useMemo(() => {
    let mercadona = 0;
    let lidl = 0;
    let sinPrecioLidl = 0;
    pasillos.forEach(p => p.items.forEach(i => {
      if (tengoMap[i.id || i.nombre]) return;
      if (i.lidl.total == null) {
        sinPrecioLidl += 1;
        return;
      }
      mercadona += i.precio_total || 0;
      lidl += i.lidl.total;
    }));
    return {
      mercadona: Math.round(mercadona * 100) / 100,
      lidl: Math.round(lidl * 100) / 100,
      sinPrecioLidl
    };
  }, [pasillos, tengoMap]);

  const editarPrecioLidl = (item) => {
    const ref = item.lidl.ref;
    if (!ref) {
      window.alert('Este artículo no está en la tabla de precios LIDL (data/precios_lidl.json).');
      return;
    }
    const actual = item.lidl.unitario != null ? item.lidl.unitario.toFixed(2) : '';
    const respuesta = window.prompt(
      `Precio en LIDL de "${ref.nombre_lidl}" (${ref.formato}), en € por unidad.\nDéjalo vacío para volver al precio estimado.`,
      actual
    );
    if (respuesta === null) return;
    const limpio = respuesta.trim().replace(',', '.');
    setPreciosUsuario(prev => {
      const siguiente = { ...prev };
      if (limpio === '') {
        delete siguiente[ref.clave];
      } else {
        const valor = parseFloat(limpio);
        if (Number.isNaN(valor) || valor < 0) {
          window.alert('Precio no válido.');
          return prev;
        }
        siguiente[ref.clave] = Math.round(valor * 100) / 100;
      }
      return siguiente;
    });
  };

  const copiarPreciosLidl = () => {
    navigator.clipboard.writeText(JSON.stringify(preciosUsuario, null, 2));
    setPreciosCopiados(true);
    setTimeout(() => setPreciosCopiados(false), 2500);
  };

  // Calcular estadísticas
  const { totalItems, checkedCount, ticketTotal, ticketGastado, ahorroTengo } = useMemo(() => {
    let total = 0;
    let checked = 0;
    let totalEuros = 0;
    let gastado = 0;
    let ahorro = 0;

    pasillos.forEach(p => {
      p.items.forEach(i => {
        // Lo que ya hay en casa no se compra ni cuenta en el ticket
        if (tengoMap[i.id || i.nombre]) {
          ahorro += (i.precioVista || 0);
          return;
        }
        total += 1;
        totalEuros += (i.precioVista || 0);
        if (checkedMap[i.id || i.nombre]) {
          checked += 1;
          gastado += (i.precioVista || 0);
        }
      });
    });

    return {
      totalItems: total,
      checkedCount: checked,
      ticketTotal: Math.round(totalEuros * 100) / 100,
      ticketGastado: Math.round(gastado * 100) / 100,
      ahorroTengo: Math.round(ahorro * 100) / 100
    };
  }, [pasillos, checkedMap, tengoMap]);

  const porcentaje = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Filtrado de pasillos e items por búsqueda y por "ocultar comprados"
  const pasillosFiltrados = useMemo(() => {
    return pasillos.map(p => {
      const itemsFiltrados = p.items.filter(item => {
        const isChecked = !!checkedMap[item.id || item.nombre] || !!tengoMap[item.id || item.nombre];
        if (hideChecked && isChecked) return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const nom = (item.nombre || '').toLowerCase();
        const nomRec = (item.nombre_receta || '').toLowerCase();
        const pas = (p.nombre_pasillo || '').toLowerCase();
        const nomLidl = esLidl ? (item.lidl.ref?.nombre_lidl || '').toLowerCase() : '';
        return nom.includes(q) || nomRec.includes(q) || pas.includes(q) || (nomLidl && nomLidl.includes(q));
      });

      return {
        ...p,
        itemsVisibles: itemsFiltrados
      };
    }).filter(p => p.itemsVisibles.length > 0);
  }, [pasillos, checkedMap, tengoMap, hideChecked, searchTerm, esLidl]);

  // Copiar lista al portapapeles
  const copiarListaTexto = () => {
    let texto = `🛒 LISTA DE LA COMPRA - ${nombreSuper}\n`;
    texto += `Total estimado: ${ticketTotal.toFixed(2)} € | Progreso: ${checkedCount}/${totalItems}\n\n`;

    pasillos.forEach(p => {
      texto += `--- ${p.nombre_pasillo.toUpperCase()} ---\n`;
      p.items.forEach(i => {
        if (tengoMap[i.id || i.nombre]) return;
        const check = checkedMap[i.id || i.nombre] ? '✓' : '•';
        const precio = i.precioVista != null ? `${i.precioVista.toFixed(2)}€` : 'sin precio';
        texto += `${check} ${i.nombre_receta || i.nombre} (${i.cantidad} ${i.unidad_receta}) - ${precio}\n`;
      });
      texto += `\n`;
    });
    if (extras.length) {
      texto += `--- EXTRAS ---\n`;
      extras.forEach(x => {
        texto += `${checkedMap[x.id] ? '✓' : '•'} ${x.nombre}\n`;
      });
    }
    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal de Supermercado */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold px-3 py-1 rounded-full mb-2">
              <Store className="w-3.5 h-3.5 text-emerald-300" />
              {nombreSuper}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Lista de la Compra Interactiva
            </h2>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 max-w-md">
              Ordenada por pasillos para optimizar tu recorrido.
            </p>

            {/* Selector de supermercado */}
            <div className="mt-3 inline-flex bg-black/30 rounded-xl p-1 border border-white/15" role="group" aria-label="Supermercado">
              {[
                { id: 'mercadona', label: 'Mercadona' },
                { id: 'lidl', label: 'LIDL' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSupermercado(s.id)}
                  aria-pressed={supermercado === s.id}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    supermercado === s.id
                      ? 'bg-white text-emerald-900 shadow'
                      : 'text-emerald-100 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 sm:text-right shrink-0">
            <div className="text-xs text-emerald-200 font-semibold mb-0.5">
              Ticket Total Estimado
            </div>
            <div className="text-3xl font-black text-white">
              {ticketTotal.toFixed(2)} €
            </div>
            <div className="text-xs text-emerald-100 mt-0.5">
              Marcado en carro: {ticketGastado.toFixed(2)} €
            </div>
            {ahorroTengo > 0 && (
              <div className="text-xs text-emerald-100">
                Ya en casa: −{ahorroTengo.toFixed(2)} €
              </div>
            )}
            {esLidl && (
              <div className="text-xs text-amber-200 mt-0.5">
                Precios estimados
              </div>
            )}
          </div>
        </div>

        {/* Barra de progreso de compra */}
        <div className="mt-5 pt-4 border-t border-white/15 relative z-10">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5 text-emerald-100">
            <span>En el carro: {checkedCount} de {totalItems} artículos ({porcentaje}%)</span>
            <span>Restan: {totalItems - checkedCount} por coger</span>
          </div>
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300"
              style={{ width: `${porcentaje}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Comparativa Mercadona vs LIDL */}
      {productosLidl.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-bold text-slate-900">Comparativa</span>
            <span className="text-slate-700">Mercadona: <strong>{comparativa.mercadona.toFixed(2)} €</strong></span>
            <span className="text-slate-700">LIDL: <strong>{comparativa.lidl.toFixed(2)} €</strong></span>
            <span className={`font-semibold ${comparativa.lidl <= comparativa.mercadona ? 'text-emerald-700' : 'text-rose-700'}`}>
              {comparativa.lidl <= comparativa.mercadona
                ? `LIDL ${(comparativa.mercadona - comparativa.lidl).toFixed(2)} € más barato`
                : `Mercadona ${(comparativa.lidl - comparativa.mercadona).toFixed(2)} € más barato`}
            </span>
          </div>
          {comparativa.sinPrecioLidl > 0 && (
            <p className="text-xs text-slate-500">
              Sobre los artículos con precio en ambos; {comparativa.sinPrecioLidl} {comparativa.sinPrecioLidl === 1 ? 'artículo no tiene' : 'artículos no tienen'} precio LIDL.
            </p>
          )}
          {esLidl && (
            <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-2">
                <p>{preciosLidl?.aviso} Precios de referencia de {preciosLidl?.actualizado}.</p>
                {Object.keys(preciosUsuario).length > 0 && (
                  <button
                    onClick={copiarPreciosLidl}
                    className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-semibold inline-flex items-center gap-1.5 hover:bg-amber-100"
                  >
                    {preciosCopiados ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {preciosCopiados ? 'Copiados' : `Copiar precios corregidos (${Object.keys(preciosUsuario).length})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra de Controles y Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar producto o receta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setHideChecked(!hideChecked)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
              hideChecked
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {hideChecked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {hideChecked ? 'Ver todos' : 'Ocultar comprados'}
          </button>

          <button
            onClick={copiarListaTexto}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiada' : 'Copiar'}
          </button>

          {checkedCount > 0 && (
            <button
              onClick={uncheckAll}
              className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Desmarcar
            </button>
          )}
        </div>
      </div>

      {/* Pasillos y Artículos */}
      <div className="space-y-5">
        {pasillosFiltrados.map((pasillo, pIdx) => {
          const itemsPasillo = pasillo.itemsVisibles;
          const subtotalPasillo = itemsPasillo.reduce((acc, i) => acc + (i.precioVista || 0), 0);

          return (
            <div 
              key={pIdx}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
            >
              {/* Encabezado del pasillo */}
              <div className="bg-slate-50/90 px-4 sm:px-5 py-3 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {pasillo.nombre_pasillo}
                  </h3>
                  <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                    {itemsPasillo.length} {itemsPasillo.length === 1 ? 'artículo' : 'artículos'}
                  </span>
                </div>
                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                  Subtotal: {subtotalPasillo.toFixed(2)} €
                </div>
              </div>

              {/* Lista de artículos en el pasillo */}
              <div className="divide-y divide-slate-100">
                {itemsPasillo.map((item, iIdx) => {
                  const itemKey = item.id || item.nombre;
                  const enCasa = !!tengoMap[itemKey];
                  const isChecked = !!checkedMap[itemKey] || enCasa;

                  return (
                    <div
                      key={iIdx}
                      onClick={() => !enCasa && toggleItem(itemKey)}
                      className={`p-3 sm:p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer select-none hover:bg-slate-50/80 ${
                        isChecked ? 'bg-emerald-50/40 text-slate-400' : 'bg-white'
                      }`}
                    >
                      {/* Checkbox y Nombre */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!enCasa) toggleItem(itemKey);
                          }}
                          className="shrink-0 transition-transform active:scale-90 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          aria-label={isChecked ? "Desmarcar artículo" : "Marcar artículo como comprado"}
                        >
                          {enCasa ? (
                            <Home className="w-7 h-7 text-sky-600" />
                          ) : isChecked ? (
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          ) : (
                            <Circle className="w-7 h-7 text-slate-400 hover:text-slate-500" />
                          )}
                        </button>

                        {/* Thumbnail si existe */}
                        {!esLidl && item.thumbnail && (
                          <img 
                            src={item.thumbnail} 
                            alt={item.nombre} 
                            className={`w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 ${isChecked ? 'opacity-40 grayscale' : ''}`}
                            loading="lazy"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`text-sm sm:text-base font-bold ${
                              isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}>
                              {item.nombre_receta || item.nombre}
                            </span>
                            {esLidl ? (
                              item.lidl.ref && (
                                <span className="text-xs text-slate-400 truncate">
                                  ({item.lidl.ref.nombre_lidl} · {item.lidl.ref.formato})
                                </span>
                              )
                            ) : (
                              item.nombre_receta && item.nombre !== item.nombre_receta && (
                                <span className="text-xs text-slate-400 truncate">
                                  ({item.nombre})
                                </span>
                              )
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                              {item.cantidad} x {item.unidad_receta || 'ud'}
                            </span>
                            {esLidl && item.lidl.ref?.nota && (
                              <span className="text-amber-700">{item.lidl.ref.nota}</span>
                            )}
                            {!esLidl && item.precio_referencia > 0 && (
                              <span>
                                {item.precio_referencia.toFixed(2)} €/{item.formato_referencia}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTengo(itemKey);
                              }}
                              className={`px-2 py-1 rounded-md font-semibold border ${
                                enCasa
                                  ? 'bg-sky-100 text-sky-800 border-sky-300'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                              aria-pressed={enCasa}
                            >
                              {enCasa ? 'En casa · deshacer' : 'Ya lo tengo'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Precio */}
                      <div className="text-right shrink-0 pl-2 flex items-center gap-2">
                        <div>
                          <div className={`text-sm sm:text-base font-extrabold ${
                            isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}>
                            {item.precioVista != null ? `${item.precioVista.toFixed(2)} €` : '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.unitarioVista != null ? `${item.unitarioVista.toFixed(2)} €/ud` : 'sin precio'}
                            {esLidl && item.lidl.origen === 'estimado' && ' · estimado'}
                            {esLidl && item.lidl.origen === 'usuario' && ' · tu precio'}
                          </div>
                        </div>
                        {esLidl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              editarPrecioLidl(item);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            aria-label="Corregir precio LIDL"
                            title="Corregir precio LIDL"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {pasillosFiltrados.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            No se encontraron artículos con el filtro actual.
          </div>
        )}
      </div>

      {/* Ajustes por platos cambiados en el menú */}
      {ajustesCambios.length > 0 && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
          <div className="bg-violet-50 px-4 sm:px-5 py-3 border-b border-violet-200 flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-violet-700" />
            <h3 className="font-bold text-violet-900 text-sm sm:text-base">Cambios por platos sustituidos</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {ajustesCambios.map(aj => (
              <div key={aj.slot} className="p-4 space-y-2">
                <div className="text-sm">
                  <span className="font-bold text-slate-900">{aj.etiqueta}:</span>{' '}
                  <span className="text-slate-700">{aj.nueva.nombre}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Sustituye a «{aj.original}». Revisa si sus ingredientes de la lista siguen haciendo falta para otros platos.
                </p>
                <ul className="space-y-1">
                  {aj.nueva.ingredientes?.map((ing, i) => {
                    const key = `cambio-${aj.slot}-${aj.nueva.id}-${i}`;
                    const hecho = !!checkedMap[key];
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => toggleItem(key)}
                          className={`w-full flex items-center gap-2 text-left text-sm py-1 ${hecho ? 'line-through text-slate-400' : 'text-slate-800'}`}
                        >
                          {hecho ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <Circle className="w-6 h-6 text-slate-400 shrink-0" />}
                          <span>{ing.item} <span className="text-slate-500">({ing.cantidad})</span></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras añadidos a mano */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">Extras de esta semana</h3>
        <form onSubmit={addExtra} className="flex gap-2">
          <input
            type="text"
            value={nuevoExtra}
            onChange={(e) => setNuevoExtra(e.target.value)}
            placeholder="Pan, fruta, avena, leche..."
            className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Añadir
          </button>
        </form>
        {extras.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {extras.map(x => {
              const hecho = !!checkedMap[x.id];
              return (
                <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleItem(x.id)}
                    className={`flex items-center gap-2 text-left text-sm flex-1 ${hecho ? 'line-through text-slate-400' : 'text-slate-800'}`}
                  >
                    {hecho ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <Circle className="w-6 h-6 text-slate-400 shrink-0" />}
                    {x.nombre}
                  </button>
                  <button type="button" onClick={() => removeExtra(x.id)} className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Quitar ${x.nombre}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sección Despensa Base Excluida */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <button
          onClick={() => setShowDespensa(!showDespensa)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Básicos de Despensa Habituales
              </h3>
              <p className="text-xs text-slate-500">
                Artículos que se asumen en casa y no se compran cada semana (sal yodada, AOVE, especias, etc.)
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
            {showDespensa ? 'Ocultar' : 'Revisar despensa'}
          </span>
        </button>

        {showDespensa && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {despensaData?.articulos?.map((art) => (
              <div 
                key={art.id}
                className="text-xs p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800">{art.nombre}</div>
                  <div className="text-xs text-slate-400">{art.categoria}</div>
                  {art.nota && <div className="text-xs text-emerald-700 mt-0.5">{art.nota}</div>}
                  {art.uso_exclusivo && <div className="text-xs text-rose-700 font-medium">{art.uso_exclusivo}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
