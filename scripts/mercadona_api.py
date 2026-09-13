#!/usr/bin/env python3
"""
Conector optimizado con la API digital de supermercado.
Descarga concurrentemente categorías y productos reales de Mercadona, mapea los pasillos
y permite buscar productos exactos con sus precios unitarios y por kilogramo/litro.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
CACHE_FILE = os.path.join(DATA_DIR, "mercadona_catalogo_cache.json")


def get_default_postal_code() -> str:
    env_file = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("POSTAL_CODE="):
                        return line.strip().split("=", 1)[1].strip().replace("'", "").replace('"', '')
        except Exception:
            pass
    return os.environ.get("POSTAL_CODE", "")


DEFAULT_POSTAL_CODE = get_default_postal_code()
API_BASE_URL = "https://tienda.mercadona.es/api"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


def http_get_json(url: str, timeout: int = 8) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                raw = response.read().decode("utf-8")
                return json.loads(raw)
    except Exception:
        return None
    return None


def fetch_root_categories(postal_code: str = DEFAULT_POSTAL_CODE) -> List[Dict[str, Any]]:
    url = f"{API_BASE_URL}/v1_1/categories/?postal_code={postal_code}"
    data = http_get_json(url)
    if not data or "results" not in data:
        return []
    return data["results"]


def extract_products_from_subcat(subcat_data: Dict[str, Any], root_category_name: str) -> List[Dict[str, Any]]:
    products = []
    subcategories = subcat_data.get("categories", [])
    for sub in subcategories:
        sub_name = sub.get("name", "")
        prods = sub.get("products", [])
        for p in prods:
            price_info = p.get("price_instructions", {})
            try:
                unit_price = float(price_info.get("unit_price") or 0.0)
            except (ValueError, TypeError):
                unit_price = 0.0

            try:
                ref_price = float(price_info.get("reference_price") or unit_price)
            except (ValueError, TypeError):
                ref_price = unit_price

            ref_format = price_info.get("reference_format") or "kg"

            photos = p.get("photos", [])
            photo_url = photos[0].get("regular") if photos else None

            item = {
                "id": p.get("id"),
                "nombre": p.get("display_name"),
                "packaging": p.get("packaging"),
                "precio": unit_price,
                "precio_referencia": ref_price,
                "formato_referencia": ref_format,
                "categoria_raiz": root_category_name,
                "subcategoria": sub_name,
                "pasillo": root_category_name,
                "foto": photo_url,
                "disponible": not p.get("is_unavailable", False),
            }
            products.append(item)
    return products


def fetch_subcategory_products(subcat_id: int, root_name: str, postal_code: str = DEFAULT_POSTAL_CODE) -> List[Dict[str, Any]]:
    url = f"{API_BASE_URL}/v1_1/categories/{subcat_id}/?postal_code={postal_code}"
    data = http_get_json(url)
    if not data:
        return []
    return extract_products_from_subcat(data, root_name)


def sync_catalog(postal_code: str = DEFAULT_POSTAL_CODE, max_workers: int = 10) -> List[Dict[str, Any]]:
    """Descarga de forma concurrente el catálogo completo del supermercado local."""
    print(f"[*] Iniciando sincronización del catálogo Mercadona...")
    roots = fetch_root_categories(postal_code)
    if not roots:
        print("[!] Error: No se pudo contactar con la API de Mercadona.")
        return []

    subcats_to_fetch = []
    for root in roots:
        root_name = root.get("name", "Varios")
        for sub in root.get("categories", []):
            sub_id = sub.get("id")
            if sub_id:
                subcats_to_fetch.append((sub_id, root_name))

    all_products = []
    seen_ids = set()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_sub = {
            executor.submit(fetch_subcategory_products, sub_id, rname, postal_code): (sub_id, rname)
            for sub_id, rname in subcats_to_fetch
        }
        for future in as_completed(future_to_sub):
            try:
                prods = future.result()
                for p in prods:
                    pid = p["id"]
                    if pid and pid not in seen_ids:
                        seen_ids.add(pid)
                        all_products.append(p)
            except Exception:
                pass

    if all_products:
        os.makedirs(DATA_DIR, exist_ok=True)
        payload = {
            "ultima_actualizacion": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_productos": len(all_products),
            "productos": all_products,
        }
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"[OK] Catálogo sincronizado con éxito: {len(all_products)} productos en caché.")
    return all_products


def load_catalog(force_sync: bool = False, postal_code: str = DEFAULT_POSTAL_CODE) -> List[Dict[str, Any]]:
    """Carga el catálogo desde caché local o lo descarga si no existe."""
    if not force_sync and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("productos", [])
        except Exception:
            pass
    return sync_catalog(postal_code=postal_code)


def search_products(query: str, catalog: Optional[List[Dict[str, Any]]] = None, limit: int = 5) -> List[Dict[str, Any]]:
    """Búsqueda insensible a mayúsculas y acentos."""
    if catalog is None:
        catalog = load_catalog()

    def normalize(text: str) -> str:
        t = text.lower()
        replacements = (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n"))
        for a, b in replacements:
            t = t.replace(a, b)
        return t

    q_clean = normalize(query)
    tokens = [tok for tok in q_clean.split() if len(tok) > 2]

    matches = []
    for p in catalog:
        name_clean = normalize(p.get("nombre", ""))
        score = 0
        if q_clean in name_clean:
            score += 100
        for tok in tokens:
            if tok in name_clean:
                score += 15

        sub_clean = normalize(p.get("subcategoria", ""))
        for tok in tokens:
            if tok in sub_clean:
                score += 5

        if score > 0 and p.get("disponible", True):
            matches.append((score, p))

    matches.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in matches[:limit]]


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sync":
        sync_catalog()
    elif len(sys.argv) > 2 and sys.argv[1] == "search":
        q = " ".join(sys.argv[2:])
        results = search_products(q)
        print(f"\nResultados para '{q}' en Mercadona:")
        for r in results:
            print(f"- [{r['pasillo']}] {r['nombre']} -> {r['precio']:.2f}€ ({r['precio_referencia']:.2f}€/{r['formato_referencia']})")
    else:
        print(f"Probando conexión con Mercadona API...")
        sync_catalog()
