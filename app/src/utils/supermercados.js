// Emparejamiento de la lista de la compra (generada con Mercadona) con la tabla de precios LIDL.

export const normalizar = (texto) =>
  (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const buscarEn = (texto, productos) => {
  const t = normalizar(texto);
  if (!t) return null;
  return productos.find(p => p.claves.some(c => t.includes(normalizar(c)))) || null;
};

// Primero por el nombre del producto (más preciso) y, si no, por el nombre de la receta
export const emparejarLidl = (item, productos) =>
  buscarEn(item.nombre, productos) || buscarEn(item.nombre_receta, productos);

// Precio LIDL de un artículo: el que haya corregido el usuario o el estimado de la tabla
export const precioLidl = (item, productos, preciosUsuario) => {
  const ref = emparejarLidl(item, productos);
  if (!ref) return { ref: null, unitario: null, total: null, origen: 'sin_dato' };
  const propio = preciosUsuario?.[ref.clave];
  const unitario = typeof propio === 'number' ? propio : ref.precio_unitario;
  if (typeof unitario !== 'number') return { ref, unitario: null, total: null, origen: 'sin_dato' };
  return {
    ref,
    unitario,
    total: Math.round(unitario * (item.cantidad || 1) * 100) / 100,
    origen: typeof propio === 'number' ? 'usuario' : 'estimado'
  };
};
