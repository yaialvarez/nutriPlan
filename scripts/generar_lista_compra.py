#!/usr/bin/env python3
"""
Generador automático de la Lista de la Compra Semanal con precios reales de Mercadona.

Lee los artículos de la semana de data/compra_semana.json, los busca en el catálogo
(data/mercadona_catalogo_cache.json si se acaba de sincronizar en este ordenador; si no, la
copia guardada en el repositorio, data/catalogo/mercadona.json; y si tampoco, lo descarga con
mercadona_api.py),
los agrupa por pasillos para optimizar el recorrido y escribe data/lista_compra.json
con el ticket estimado. Cada semana solo se edita compra_semana.json, no este script.
"""

import os
import sys
import json
from typing import List, Dict, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MENU_FILE = os.path.join(DATA_DIR, "menu_semanal.json")
LISTA_FILE = os.path.join(DATA_DIR, "lista_compra.json")
CACHE_FILE = os.path.join(DATA_DIR, "mercadona_catalogo_cache.json")
COMPRA_FILE = os.path.join(DATA_DIR, "compra_semana.json")
CATALOGO_FILE = os.path.join(DATA_DIR, "catalogo", "mercadona.json")


def cargar_json(ruta: str) -> Any:
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f)


def cargar_catalogo() -> List[Dict[str, Any]]:
    """Catálogo de Mercadona: caché local, copia guardada en el repositorio o descarga."""
    for ruta in (CACHE_FILE, CATALOGO_FILE):
        if os.path.exists(ruta):
            return cargar_json(ruta).get("productos", [])
    print("[*] No hay caché del catálogo: descargándolo de Mercadona...")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mercadona_api import load_catalog
    return load_catalog()


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
            "subseccion": matched_prod.get("subseccion") or matched_prod.get("subcategoria", ""),
            "cantidad": cant,
            "unidad_receta": cfg["unidad"],
            "precio_unitario": p_unit,
            "precio_total": p_total,
            "precio_referencia": matched_prod.get("precio_referencia", 0.0),
            "formato_referencia": matched_prod.get("formato_referencia", "kg"),
            "thumbnail": matched_prod.get("thumbnail") or matched_prod.get("foto") or "",
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


def generar_lista_compra_mercadona(compra_file: str = COMPRA_FILE, menu_file: str = MENU_FILE,
                                   lista_file: str = LISTA_FILE, catalogo=None) -> Dict[str, Any]:
    print("[*] Generando lista de compra precisa para Mercadona...")
    compra = cargar_json(compra_file)
    menu = cargar_json(menu_file)
    catalog = catalogo if catalogo is not None else cargar_catalogo()
    if not catalog:
        # Sin catálogo todos los precios serían inventados: mejor no tocar la lista actual
        print("[!] Catálogo de Mercadona vacío o inaccesible: lista_compra.json no se modifica.")
        sys.exit(1)

    articulos = [resolve_item(cfg, catalog) for cfg in compra["articulos"]]

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
        "supermercado": compra.get("supermercado", "Mercadona"),
        "semana": menu.get("semana", ""),
        "total_ticket_estimado": ticket_total,
        "moneda": "EUR",
        "total_articulos": len(articulos),
        "pasillos": pasillos_ordenados,
        "despensa_excluida": compra.get("despensa_excluida", [])
    }

    with open(lista_file, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
        f.write("\n")

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
