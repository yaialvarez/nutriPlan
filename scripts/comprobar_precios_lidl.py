#!/usr/bin/env python3
"""
Comprueba qué artículos de la lista de la compra semanal tienen precio en
data/precios_lidl.json, usando el mismo emparejamiento que la app.
Ejecutar después de generar_lista_compra.py para ver qué falta añadir a la tabla.
"""

import os
import json
import unicodedata

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LISTA_FILE = os.path.join(DATA_DIR, "lista_compra.json")
LIDL_FILE = os.path.join(DATA_DIR, "precios_lidl.json")


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", (texto or "").lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


def buscar(texto, productos):
    t = normalizar(texto)
    if not t:
        return None
    for p in productos:
        if any(normalizar(c) in t for c in p["claves"]):
            return p
    return None


def main() -> None:
    with open(LISTA_FILE, encoding="utf-8") as f:
        lista = json.load(f)
    with open(LIDL_FILE, encoding="utf-8") as f:
        productos = json.load(f)["productos"]

    total_mercadona = total_lidl = 0.0
    sin_precio = []
    for pasillo in lista["pasillos"]:
        for item in pasillo["items"]:
            ref = buscar(item.get("nombre"), productos) or buscar(item.get("nombre_receta"), productos)
            if not ref or ref.get("precio_unitario") is None:
                sin_precio.append(item.get("nombre"))
                print(f"  [--] {item.get('nombre')}: sin precio LIDL")
                continue
            lidl = round(ref["precio_unitario"] * item.get("cantidad", 1), 2)
            total_mercadona += item.get("precio_total", 0.0)
            total_lidl += lidl
            print(f"  [OK] {item.get('nombre')} -> {ref['nombre_lidl']}: "
                  f"{item.get('precio_total', 0.0):.2f} vs {lidl:.2f} EUR")

    print("\n" + "=" * 60)
    print(f"Mercadona: {total_mercadona:.2f} EUR | LIDL (estimado): {total_lidl:.2f} EUR")
    if sin_precio:
        print(f"Sin precio LIDL ({len(sin_precio)}): {', '.join(sin_precio)}")


if __name__ == "__main__":
    main()
