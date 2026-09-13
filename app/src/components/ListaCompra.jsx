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
  Archive
} from 'lucide-react';

const STORAGE_KEY = 'menuia_lista_compra_checked';

export default function ListaCompra({ listaData, despensaData }) {
  const [checkedMap, setCheckedMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [hideChecked, setHideChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDespensa, setShowDespensa] = useState(false);

  // Guardar estado en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedMap));
    } catch (e) {
      console.error('Error saving checked items', e);
    }
  }, [checkedMap]);

  const toggleItem = (itemId) => {
    setCheckedMap(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const uncheckAll = () => {
    if (window.confirm('¿Desmarcar todos los artículos de la lista de la compra?')) {
      setCheckedMap({});
    }
  };

  const pasillos = useMemo(() => listaData?.pasillos || [], [listaData]);

  // Calcular estadísticas
  const { totalItems, checkedCount, ticketTotal, ticketGastado } = useMemo(() => {
    let total = 0;
    let checked = 0;
    let totalEuros = listaData?.total_ticket_estimado || 0;
    let gastado = 0;

    pasillos.forEach(p => {
      p.items.forEach(i => {
        total += 1;
        if (checkedMap[i.id || i.nombre]) {
          checked += 1;
          gastado += (i.precio_total || 0);
        }
      });
    });

    return {
      totalItems: total,
      checkedCount: checked,
      ticketTotal: totalEuros,
      ticketGastado: Math.round(gastado * 100) / 100
    };
  }, [pasillos, checkedMap, listaData]);

  const porcentaje = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Filtrado de pasillos e items por búsqueda y por "ocultar comprados"
  const pasillosFiltrados = useMemo(() => {
    return pasillos.map(p => {
      const itemsFiltrados = p.items.filter(item => {
        const isChecked = !!checkedMap[item.id || item.nombre];
        if (hideChecked && isChecked) return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const nom = (item.nombre || '').toLowerCase();
        const nomRec = (item.nombre_receta || '').toLowerCase();
        const pas = (p.nombre_pasillo || '').toLowerCase();
        return nom.includes(q) || nomRec.includes(q) || pas.includes(q);
      });

      return {
        ...p,
        itemsVisibles: itemsFiltrados
      };
    }).filter(p => p.itemsVisibles.length > 0);
  }, [pasillos, checkedMap, hideChecked, searchTerm]);

  // Copiar lista al portapapeles
  const copiarListaTexto = () => {
    let texto = `🛒 LISTA DE LA COMPRA - ${listaData?.supermercado || 'Mercadona'}\n`;
    texto += `Total estimado: ${ticketTotal} € | Progreso: ${checkedCount}/${totalItems}\n\n`;

    pasillos.forEach(p => {
      texto += `--- ${p.nombre_pasillo.toUpperCase()} ---\n`;
      p.items.forEach(i => {
        const check = checkedMap[i.id || i.nombre] ? '✓' : '•';
        texto += `${check} ${i.nombre_receta || i.nombre} (${i.cantidad} ${i.unidad_receta}) - ${i.precio_total}€\n`;
      });
      texto += `\n`;
    });

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
              {listaData?.supermercado || 'Mercadona'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Lista de la Compra Interactiva
            </h2>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 max-w-md">
              Ordenada por los pasillos reales de la tienda para optimizar tu recorrido.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 sm:text-right shrink-0">
            <div className="text-xs text-emerald-200 font-semibold mb-0.5">
              Ticket Total Estimado
            </div>
            <div className="text-3xl font-black text-white">
              {ticketTotal.toFixed(2)} €
            </div>
            <div className="text-[11px] text-emerald-200/80 mt-0.5">
              Marcado en carro: {ticketGastado.toFixed(2)} €
            </div>
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
          const subtotalPasillo = itemsPasillo.reduce((acc, i) => acc + (i.precio_total || 0), 0);

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
                  const isChecked = !!checkedMap[itemKey];

                  return (
                    <div
                      key={iIdx}
                      onClick={() => toggleItem(itemKey)}
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
                            toggleItem(itemKey);
                          }}
                          className="shrink-0 transition-transform active:scale-90 p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          aria-label={isChecked ? "Desmarcar artículo" : "Marcar artículo como comprado"}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300 hover:text-slate-400" />
                          )}
                        </button>

                        {/* Thumbnail si existe */}
                        {item.thumbnail && (
                          <img 
                            src={item.thumbnail} 
                            alt={item.nombre} 
                            className={`w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 ${isChecked ? 'opacity-40 grayscale' : ''}`}
                            loading="lazy"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`text-xs sm:text-sm font-bold truncate ${
                              isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}>
                              {item.nombre_receta || item.nombre}
                            </span>
                            {item.nombre_receta && item.nombre !== item.nombre_receta && (
                              <span className="text-[11px] text-slate-400 truncate">
                                ({item.nombre})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                              {item.cantidad} x {item.unidad_receta || 'ud'}
                            </span>
                            {item.precio_referencia > 0 && (
                              <span>
                                {item.precio_referencia.toFixed(2)} €/{item.formato_referencia}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Precio */}
                      <div className="text-right shrink-0 pl-2">
                        <div className={`text-sm sm:text-base font-extrabold ${
                          isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}>
                          {item.precio_total?.toFixed(2)} €
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.precio_unitario?.toFixed(2)} €/ud
                        </div>
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
                  <div className="text-[10px] text-slate-400">{art.categoria}</div>
                  {art.nota && <div className="text-[10px] text-emerald-700 mt-0.5">{art.nota}</div>}
                  {art.uso_exclusivo && <div className="text-[10px] text-rose-700 font-medium">{art.uso_exclusivo}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
