#!/usr/bin/env python3
"""
Generador automático y validador de la Lista de la Compra Semanal
con precios reales de Mercadona.
Agrupa los artículos por pasillos del supermercado para optimizar el recorrido físico
y calcular el ticket exacto.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MENU_FILE = os.path.join(DATA_DIR, "menu_semanal.json")
PANTRY_FILE = os.path.join(DATA_DIR, "despensa_base.json")
LISTA_FILE = os.path.join(DATA_DIR, "lista_compra.json")
CACHE_FILE = os.path.join(DATA_DIR, "mercadona_catalogo_cache.json")

# Artículos de la Semana 4 (10/10 - 16/10): otoño de cuchara, pescado azul y pollo entero
# y sus identificadores o términos clave preferentes en el catálogo de Mercadona
ITEMS_CONFIG = [
    # --- FRUTA Y VERDURA ---
    {
        "id_preferente": 69166,
        "termino_fallback": "patatas",
        "filtro_excluir": ["fritas", "chispas", "snack"],
        "nombre_receta": "Patatas (suflé, tortilla, gajo, curry, alubias, lentejas y crema)",
        "cantidad": 1,
        "unidad": "malla 3 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69586,
        "termino_fallback": "zanahoria",
        "filtro_excluir": ["bebé", "papilla", "tarrina"],
        "nombre_receta": "Zanahorias (poke, caldo, curry, ramen, fideos, alubias y lentejas)",
        "cantidad": 1,
        "unidad": "malla 1 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69155,
        "termino_fallback": "cebollas dulces",
        "filtro_excluir": ["frita"],
        "nombre_receta": "Cebollas dulces para pochar (curry, suflé, alubias, tortilla y lentejas)",
        "cantidad": 1,
        "unidad": "malla 1 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69411,
        "termino_fallback": "puerro",
        "filtro_excluir": [],
        "nombre_receta": "Puerros (caldo, crema de calabacín y lentejas)",
        "cantidad": 1,
        "unidad": "manojo",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69338,
        "termino_fallback": "calabacin",
        "filtro_excluir": [],
        "nombre_receta": "Calabacines verdes (crema del lunes)",
        "cantidad": 3,
        "unidad": "piezas",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69889,
        "termino_fallback": "judia verde",
        "filtro_excluir": [],
        "nombre_receta": "Judía verde plana (alubias del jueves)",
        "cantidad": 1,
        "unidad": "bolsa 500g",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69984,
        "termino_fallback": "espinacas baby",
        "filtro_excluir": [],
        "nombre_receta": "Espinacas baby (garbanzos y ramen)",
        "cantidad": 1,
        "unidad": "bolsa",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69310,
        "termino_fallback": "pimiento rojo",
        "filtro_excluir": ["asado", "tiras"],
        "nombre_receta": "Pimiento rojo (guarnición filetes del miércoles)",
        "cantidad": 2,
        "unidad": "piezas",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 60369,
        "termino_fallback": "tomate ensalada",
        "filtro_excluir": ["frito", "triturado"],
        "nombre_receta": "Tomates ensalada (poke, hamburguesa y ensalada de la tortilla)",
        "cantidad": 3,
        "unidad": "piezas",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 68130,
        "termino_fallback": "lechuga iceberg",
        "filtro_excluir": [],
        "nombre_receta": "Lechuga iceberg (hamburguesa y ensalada de la tortilla)",
        "cantidad": 1,
        "unidad": "pieza",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 3830,
        "termino_fallback": "aguacate",
        "filtro_excluir": ["salsa", "aceite"],
        "nombre_receta": "Aguacates (poke del sábado)",
        "cantidad": 2,
        "unidad": "piezas",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69519,
        "termino_fallback": "champinon laminado",
        "filtro_excluir": ["entero"],
        "nombre_receta": "Champiñones laminados (pizza del viernes)",
        "cantidad": 1,
        "unidad": "bandeja 250g",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 3819,
        "termino_fallback": "platano canarias",
        "filtro_excluir": [],
        "nombre_receta": "Plátanos de Canarias IGP (snacks Doña.Y)",
        "cantidad": 6,
        "unidad": "piezas (~1 kg)",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 3028,
        "termino_fallback": "manzana golden",
        "filtro_excluir": [],
        "nombre_receta": "Manzanas Golden (snacks)",
        "cantidad": 6,
        "unidad": "piezas (~1 kg)",
        "seccion": "Fruta y verdura"
    },

    # --- PESCADO ---
    {
        "id_preferente": 24511,
        "termino_fallback": "lomos de salmon",
        "filtro_excluir": ["paté", "ahumado"],
        "nombre_receta": "Lomos de salmón congelados (poke del sábado)",
        "cantidad": 2,
        "unidad": "packs 2 lomos",
        "seccion": "Congelados"
    },

    # --- CARNICERÍA ---
    {
        "id_preferente": 2781,
        "termino_fallback": "pollo entero",
        "filtro_excluir": ["asado"],
        "nombre_receta": "Pollo entero para despiezar (curry, crema, fideos y caldo de carcasa)",
        "cantidad": 1,
        "unidad": "pieza ~1,9 kg",
        "seccion": "Carne"
    },
    {
        "id_preferente": 2787,
        "termino_fallback": "filetes pechuga pollo",
        "filtro_excluir": ["adobada", "empanado"],
        "nombre_receta": "Filetes pechuga de pollo (ramen del domingo y pizza)",
        "cantidad": 1,
        "unidad": "bandeja",
        "seccion": "Carne"
    },
    {
        "id_preferente": 2868,
        "termino_fallback": "carne picada vacuno",
        "filtro_excluir": ["cerdo", "mixta"],
        "nombre_receta": "Carne picada de vacuno (hamburguesas y suflé)",
        "cantidad": 2,
        "unidad": "bandejas 500g",
        "seccion": "Carne"
    },
    {
        "id_preferente": 8994,
        "termino_fallback": "panceta",
        "filtro_excluir": ["adobada"],
        "nombre_receta": "Panceta fina sin corteza (carbonara)",
        "cantidad": 1,
        "unidad": "bandeja",
        "seccion": "Carne"
    },
    {
        "id_preferente": 2849,
        "termino_fallback": "filetes lomo cerdo",
        "filtro_excluir": ["adobado", "empanado"],
        "nombre_receta": "Filetes de lomo de cerdo (cena del miércoles)",
        "cantidad": 1,
        "unidad": "bandeja 400g",
        "seccion": "Carne"
    },
    {
        "id_preferente": 2813,
        "termino_fallback": "cerdo a tacos",
        "filtro_excluir": ["fiambre", "adobado", "embutido"],
        "nombre_receta": "Magro de cerdo a tacos (lentejas)",
        "cantidad": 1,
        "unidad": "bandeja 400g",
        "seccion": "Carne"
    },

    # --- HUEVOS Y LÁCTEOS ---
    {
        "id_preferente": 15768,
        "termino_fallback": "huevos camperas",
        "filtro_excluir": ["chocolate", "sorpresa"],
        "nombre_receta": "Huevos camperos (carbonara, ramen, garbanzos, alubias y tortilla)",
        "cantidad": 2,
        "unidad": "docenas",
        "seccion": "Huevos, leche y mantequilla"
    },

    # --- CHARCUTERÍA Y QUESOS SUAVES ---
    {
        "id_preferente": 50916,
        "termino_fallback": "queso tierno",
        "filtro_excluir": ["fuerte", "azul", "cabra"],
        "nombre_receta": "Queso tierno suave (hamburguesas y gratinado del suflé)",
        "cantidad": 1,
        "unidad": "paquete",
        "seccion": "Charcutería y quesos"
    },
    {
        "id_preferente": 51146,
        "termino_fallback": "grana padano",
        "filtro_excluir": [],
        "nombre_receta": "Queso grana padano rallado (carbonara)",
        "cantidad": 1,
        "unidad": "bolsa",
        "seccion": "Charcutería y quesos"
    },
    {
        "id_preferente": 52405,
        "termino_fallback": "queso en porciones",
        "filtro_excluir": [],
        "nombre_receta": "Quesitos suaves (crema de calabacín)",
        "cantidad": 1,
        "unidad": "caja",
        "seccion": "Charcutería y quesos"
    },
    {
        "id_preferente": 51110,
        "termino_fallback": "mozzarella pizza",
        "filtro_excluir": [],
        "nombre_receta": "Mozzarella rallada (pizza del viernes)",
        "cantidad": 1,
        "unidad": "bolsa 200g",
        "seccion": "Charcutería y quesos"
    },
    {
        "id_preferente": 60329,
        "termino_fallback": "jamon cocido extra",
        "filtro_excluir": ["chopped", "lata"],
        "nombre_receta": "Jamón cocido extra (pizza del viernes)",
        "cantidad": 1,
        "unidad": "paquete lonchas",
        "seccion": "Charcutería y quesos"
    },
    {
        "id_preferente": 59071,
        "termino_fallback": "taquitos jamon",
        "filtro_excluir": [],
        "nombre_receta": "Taquitos de jamón (garbanzos del miércoles)",
        "cantidad": 1,
        "unidad": "paquete",
        "seccion": "Charcutería y quesos"
    },

    # --- ARROZ, LEGUMBRES Y PASTA ---
    {
        "id_preferente": 26029,
        "termino_fallback": "garbanzo cocido",
        "filtro_excluir": [],
        "nombre_receta": "Garbanzos cocidos (tupper del miércoles)",
        "cantidad": 1,
        "unidad": "bote 400g",
        "seccion": "Arroz, legumbres y pasta"
    },
    {
        "id_preferente": 6277,
        "termino_fallback": "spaghetti",
        "filtro_excluir": [],
        "nombre_receta": "Espaguetis (carbonara del domingo)",
        "cantidad": 1,
        "unidad": "paquete 500g",
        "seccion": "Arroz, legumbres y pasta"
    },
    {
        "id_preferente": 9861,
        "termino_fallback": "noodles ramen",
        "filtro_excluir": [],
        "nombre_receta": "Noodles de trigo (ramen del domingo y fideos del martes)",
        "cantidad": 2,
        "unidad": "paquetes",
        "seccion": "Arroz, legumbres y pasta"
    },

    # --- PANADERÍA Y MASAS ---
    {
        "id_preferente": 52602,
        "termino_fallback": "pan burger brioche",
        "filtro_excluir": [],
        "nombre_receta": "Pan de burger brioche (hamburguesas del sábado)",
        "cantidad": 1,
        "unidad": "paquete",
        "seccion": "Panadería y pastelería"
    },
    {
        "id_preferente": 52454,
        "termino_fallback": "masa pizza fresca",
        "filtro_excluir": [],
        "nombre_receta": "Masa de pizza fresca familiar (pizza del viernes)",
        "cantidad": 1,
        "unidad": "paquete 400g",
        "seccion": "Pizzas y platos preparados"
    },

    # --- CONSERVAS Y UNTABLES ---
    {
        "id_preferente": 16043,
        "termino_fallback": "tomate triturado",
        "filtro_excluir": ["frito"],
        "nombre_receta": "Tomate triturado (suflé y pizza)",
        "cantidad": 2,
        "unidad": "botes 400g",
        "seccion": "Conservas, caldos y cremas"
    },
    {
        "id_preferente": 18002,
        "termino_fallback": "atun claro oliva",
        "filtro_excluir": [],
        "nombre_receta": "Atún claro (ensalada de la tortilla)",
        "cantidad": 1,
        "unidad": "pack 6 latas",
        "seccion": "Conservas, caldos y cremas"
    },
    {
        "id_preferente": 16883,
        "termino_fallback": "crema cacahuete",
        "filtro_excluir": [],
        "nombre_receta": "Crema de cacahuete 100% (fideos del martes)",
        "cantidad": 1,
        "unidad": "bote",
        "seccion": "Azúcar, caramelos y chocolate"
    }
]


def resolve_item(cfg: Dict[str, Any], catalog: List[Dict[str, Any]]) -> Dict[str, Any]:
    matched_prod = None
    
    # 1. Intentar ID preferente directo (comparación estricta de string)
    pref_id = cfg.get("id_preferente")
    if pref_id is not None:
        pref_id_str = str(pref_id)
        for p in catalog:
            if str(p.get("id")) == pref_id_str:
                matched_prod = p
                break
                
    # 2. Búsqueda por término dentro de la sección preferida
    if not matched_prod:
        query = cfg["termino_fallback"].lower()
        excluir = [e.lower() for e in cfg.get("filtro_excluir", [])]
        seccion_pref = cfg.get("seccion", "").lower()
        candidates = []
        for p in catalog:
            nombre = p.get("nombre", "").lower()
            pasillo = p.get("pasillo", "").lower()
            
            if any(e in nombre for e in excluir):
                continue
            if "berenjena" in nombre or "oliva" in nombre or "aceituna" in nombre:
                continue
            if "picante" in nombre or "chili" in nombre or "guindilla" in nombre or "jalapeño" in nombre:
                continue
                
            score = 0
            if seccion_pref in pasillo:
                score += 15
            elif seccion_pref and pasillo != seccion_pref:
                score -= 20
                
            if query in nombre:
                score += 30
            elif all(token in nombre for token in query.split() if len(token) > 2):
                score += 20
            elif any(token in nombre for token in query.split() if len(token) > 2):
                score += 5
                
            if score > 15:
                candidates.append((score, p))
                
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            matched_prod = candidates[0][1]

    # 3. Construir registro estructurado
    cant = cfg["cantidad"]
    if matched_prod:
        p_unit = matched_prod.get("precio", 0.0)
        p_total = round(p_unit * cant, 2)
        return {
            "id": str(matched_prod.get("id")),
            "nombre": matched_prod.get("nombre"),
            "nombre_receta": cfg["nombre_receta"],
            "pasillo": matched_prod.get("pasillo", cfg["seccion"]),
            "subseccion": matched_prod.get("subseccion", ""),
            "cantidad": cant,
            "unidad_receta": cfg["unidad"],
            "precio_unitario": p_unit,
            "precio_total": p_total,
            "precio_referencia": matched_prod.get("precio_referencia", 0.0),
            "formato_referencia": matched_prod.get("formato_referencia", "kg"),
            "thumbnail": matched_prod.get("thumbnail", ""),
            "comprado": False
        }
    else:
        # Fallback informativo de emergencia
        print(f"[!] ALERTA CRITICA: No se encontró en catálogo para '{cfg['nombre_receta']}'")
        return {
            "id": f"gen_{cfg['termino_fallback']}",
            "nombre": cfg["nombre_receta"],
            "nombre_receta": cfg["nombre_receta"],
            "pasillo": cfg["seccion"],
            "subseccion": "",
            "cantidad": cant,
            "unidad_receta": cfg["unidad"],
            "precio_unitario": 2.50,
            "precio_total": round(2.50 * cant, 2),
            "precio_referencia": 2.50,
            "formato_referencia": "ud",
            "thumbnail": "",
            "comprado": False
        }


def generar_lista_compra_mercadona() -> Dict[str, Any]:
    print("[*] Generando lista de compra precisa para Mercadona...")
    catalog = []
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            catalog = json.load(f).get("productos", [])

    articulos = [resolve_item(cfg, catalog) for cfg in ITEMS_CONFIG]

    # Pasillos con orden lógico de compra
    orden_secciones = [
        "Fruta y verdura",
        "Pescadería",
        "Congelados",
        "Carne",
        "Huevos, leche y mantequilla",
        "Charcutería y quesos",
        "Arroz, legumbres y pasta",
        "Panadería y pastelería",
        "Pizzas y platos preparados",
        "Conservas, caldos y cremas",
        "Aceite, especias y salsas",
        "Aperitivos",
        "Azúcar, caramelos y chocolate"
    ]

    secciones_map = {}
    for a in articulos:
        pasillo = a["pasillo"]
        if pasillo not in secciones_map:
            secciones_map[pasillo] = []
        secciones_map[pasillo].append(a)

    pasillos_ordenados = []
    for s_nom in orden_secciones:
        for k in list(secciones_map.keys()):
            if s_nom.lower() in k.lower():
                items = secciones_map.pop(k)
                subtotal = round(sum(i["precio_total"] for i in items), 2)
                pasillos_ordenados.append({
                    "nombre_pasillo": k,
                    "subtotal": subtotal,
                    "items": items
                })
                break

    for k, items in secciones_map.items():
        subtotal = round(sum(i["precio_total"] for i in items), 2)
        pasillos_ordenados.append({
            "nombre_pasillo": k,
            "subtotal": subtotal,
            "items": items
        })

    ticket_total = round(sum(p["subtotal"] for p in pasillos_ordenados), 2)

    resultado = {
        "supermercado": "Mercadona",
        "semana": "Semana 4: Otoño de cuchara, pescado azul y batch cooking con pollo entero",
        "total_ticket_estimado": ticket_total,
        "moneda": "EUR",
        "total_articulos": len(articulos),
        "pasillos": pasillos_ordenados,
        "despensa_excluida": [
            "Lentejas pardinas (quedan ~650 g del paquete de la semana pasada)",
            "Arroz redondo (quedan ~700 g del paquete de la semana pasada)",
            "Mayonesa (frasco empezado la semana pasada)",
            "Semillas de sésamo tostado (bote de la semana pasada)",
            "Leche semidesnatada (stock de desayunos, para el puré del suflé)",
            "Curry dulce suave en polvo y hojas de laurel",
            "Aceite de oliva virgen extra (AOVE)",
            "Sal yodada",
            "Pimienta negra molida",
            "Orégano seco",
            "Pimentón dulce de la Vera",
            "Ajos",
            "Vinagre de manzana",
            "Salsa de soja baja en sal",
            "Café e infusiones",
            "Polvo de proteína (Doña.Y stock habitual)"
        ]
    }

    with open(LISTA_FILE, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"[OK] Lista generada: {len(articulos)} articulos. Ticket total: {ticket_total} EUR.")
    return resultado


if __name__ == "__main__":
    res = generar_lista_compra_mercadona()
    print("\n" + "=" * 60)
    print(f"RESUMEN COMPRA MERCADONA: {res['total_ticket_estimado']:.2f} EUR")
    print("=" * 60)
    for p in res["pasillos"]:
        print(f"\n[{p['nombre_pasillo'].upper()}] - {p['subtotal']:.2f} EUR")
        for i in p["items"]:
            print(f"  * {i['nombre_receta']}: {i['nombre']} (x{i['cantidad']}) -> {i['precio_total']:.2f} EUR")
