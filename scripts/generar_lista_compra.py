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

# Definición precisa de los artículos necesarios para el Cierre de Semana (Martes a Sábado)
# y sus identificadores o términos clave preferentes en el catálogo de Mercadona
ITEMS_CONFIG = [
    # --- FRUTA Y VERDURA ---
    {
        "id_preferente": 69586,
        "termino_fallback": "zanahoria",
        "filtro_excluir": ["bebé", "papilla", "tarrina"],
        "nombre_receta": "Zanahorias (salsa albóndigas, arroz y salmón)",
        "cantidad": 1,
        "unidad": "malla 1 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69166,
        "termino_fallback": "patatas",
        "filtro_excluir": ["fritas", "chispas", "snack"],
        "nombre_receta": "Patatas para guisar y puré (albóndigas y salmón)",
        "cantidad": 1,
        "unidad": "malla 3 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69411,
        "termino_fallback": "puerro",
        "filtro_excluir": [],
        "nombre_receta": "Puerros limpios (salsa albóndigas y arroz salteado)",
        "cantidad": 1,
        "unidad": "manojo",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69155,
        "termino_fallback": "cebollas dulces",
        "filtro_excluir": ["frita"],
        "nombre_receta": "Cebollas dulces para pochar (salsa albóndigas)",
        "cantidad": 1,
        "unidad": "malla 1 kg",
        "seccion": "Fruta y verdura"
    },
    {
        "id_preferente": 69984,
        "termino_fallback": "espinaca",
        "filtro_excluir": [],
        "nombre_receta": "Espinacas baby lavadas (garbanzos jueves)",
        "cantidad": 1,
        "unidad": "bolsa 100g",
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

    # --- CARNICERÍA ---
    {
        "id_preferente": 2868,
        "termino_fallback": "carne picada vacuno",
        "filtro_excluir": ["cerdo", "mixta"],
        "nombre_receta": "Carne picada de vacuno 100% (albóndigas caseras)",
        "cantidad": 1,
        "unidad": "bandeja 400g",
        "seccion": "Carne"
    },
    {
        "id_preferente": 2787,
        "termino_fallback": "filetes pechuga pollo",
        "filtro_excluir": ["adobada", "empanado"],
        "nombre_receta": "Filetes pechuga de pollo (arroz salteado viernes)",
        "cantidad": 1,
        "unidad": "bandeja ~500g",
        "seccion": "Carne"
    },

    # --- PESCADERÍA / CONGELADOS DE PESCADO ---
    {
        "id_preferente": 24511,
        "termino_fallback": "lomos de salmon",
        "filtro_excluir": ["paté", "ahumado"],
        "nombre_receta": "Lomos de salmón sin piel (sábado comida)",
        "cantidad": 1,
        "unidad": "pack 2 lomos",
        "seccion": "Congelados"
    },

    # --- HUEVOS Y LÁCTEOS ---
    {
        "id_preferente": 15768,
        "termino_fallback": "huevos camperas",
        "filtro_excluir": ["chocolate", "sorpresa"],
        "nombre_receta": "Huevos camperos frescos clase L (garbanzos y arroz salteado)",
        "cantidad": 1,
        "unidad": "docena clase L",
        "seccion": "Huevos, leche y mantequilla"
    },

    # --- CHARCUTERÍA Y QUESOS SUAVES ---
    {
        "id_preferente": 59071,
        "termino_fallback": "taquitos jamon",
        "filtro_excluir": [],
        "nombre_receta": "Taquitos de jamón curado (garbanzos salteados)",
        "cantidad": 1,
        "unidad": "pack taquitos",
        "seccion": "Charcutería y quesos"
    },

    # --- ARROZ, LEGUMBRES Y PASTA ---
    {
        "id_preferente": 26029,
        "termino_fallback": "garbanzo cocido",
        "filtro_excluir": [],
        "nombre_receta": "Garbanzo cocido Hacendado (garbanzos jueves)",
        "cantidad": 1,
        "unidad": "tarro 400g",
        "seccion": "Arroz, legumbres y pasta"
    },
    {
        "id_preferente": 5044,
        "termino_fallback": "arroz redondo",
        "filtro_excluir": [],
        "nombre_receta": "Arroz blanco para arrocera (onigiris y salteado)",
        "cantidad": 1,
        "unidad": "paquete 1 kg",
        "seccion": "Arroz, legumbres y pasta"
    },

    # --- SALSAS Y CONSERVAS ---
    {
        "id_preferente": 16043,
        "termino_fallback": "tomate triturado",
        "filtro_excluir": ["frito"],
        "nombre_receta": "Tomate triturado natural (salsa albóndigas)",
        "cantidad": 1,
        "unidad": "bote 400g",
        "seccion": "Conservas, caldos y cremas"
    },
    {
        "id_preferente": 18002,
        "termino_fallback": "atun claro oliva",
        "filtro_excluir": [],
        "nombre_receta": "Atún claro en aceite de oliva Hacendado (onigiris)",
        "cantidad": 1,
        "unidad": "pack 6 latas",
        "seccion": "Conservas, caldos y cremas"
    },
    {
        "id_preferente": 13406,
        "termino_fallback": "mayonesa",
        "filtro_excluir": ["trufa", "picante", "ligera"],
        "nombre_receta": "Mayonesa clásica favorita Hacendado",
        "cantidad": 1,
        "unidad": "frasco 450ml",
        "seccion": "Aceite, especias y salsas"
    },

    # --- APERITIVOS Y CONDIMENTOS FRESCOS ---
    {
        "id_preferente": 34964,
        "termino_fallback": "semillas sesamo tostado",
        "filtro_excluir": [],
        "nombre_receta": "Semillas de sésamo tostado (onigiris)",
        "cantidad": 1,
        "unidad": "bote 150g",
        "seccion": "Aperitivos"
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
        "semana": "Semana Adaptada: Cierre de Semana (Martes 29/09 a Sábado 03/10)",
        "total_ticket_estimado": ticket_total,
        "moneda": "EUR",
        "total_articulos": len(articulos),
        "pasillos": pasillos_ordenados,
        "despensa_excluida": [
            "Filetes para cena del martes (stock ya disponible en casa)",
            "Espaguetis, tomate casero y bacon para cena del jueves (stock ya disponible en casa)",
            "Aceite de oliva virgen extra (AOVE)",
            "Sal yodada",
            "Pimienta negra molida",
            "Orégano seco",
            "Pimentón dulce de la Vera",
            "Ajos",
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
