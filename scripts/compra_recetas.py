#!/usr/bin/env python3
"""
Compra por receta para que la web recalcule la lista al cambiar platos del menú.

Traduce los ingredientes de cada receta del recetario a artículos de Mercadona con las mismas
reglas que el planificador (data/planificador/ingredientes.json) y guarda en
data/compra_recetas.json:

- productos: por regla de compra, el producto del catálogo, su envase y su precio;
- recetas: por receta, cuánto necesita de cada regla (en la medida de la regla) y los
  ingredientes que no encajan en ninguna regla (la web los muestra aparte).

La web compara las necesidades del menú publicado con las del menú con los cambios hechos en
la app (platos cambiados, comidas ignoradas o huecos rellenados) y suma o resta envases a la
lista de la compra publicada.

Uso:
  python scripts/compra_recetas.py               # regenera data/compra_recetas.json
  python scripts/compra_recetas.py --comprobar   # falla si el fichero no está al día
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_lista_compra import cargar_catalogo  # noqa: E402
from planificar_semana import DATA_DIR, REGLAS_COMPRA, Compra, cargar_json  # noqa: E402

DESTINO = os.path.join(DATA_DIR, "compra_recetas.json")


def generar():
    compra = Compra(cargar_json(REGLAS_COMPRA))
    por_id = {str(p.get("id")): p for p in cargar_catalogo()}
    recetas, usadas = {}, set()

    for receta in cargar_json(os.path.join(DATA_DIR, "recetario.json")):
        necesidades, sin_producto = {}, []
        for ing in receta.get("ingredientes", []):
            for regla, q in compra.desglosar(ing):
                if regla is None:
                    sin_producto.append({"item": ing.get("item", ""), "cantidad": ing.get("cantidad", "")})
                    continue
                if regla.get("ignorar") or regla.get("despensa"):
                    continue
                clave = regla["clave"]
                usadas.add(clave)
                necesidades[clave] = round(necesidades.get(clave, 0.0) + compra._en_medida(regla, q), 2)
        recetas[receta["id"]] = {"necesidades": necesidades, "sin_producto": sin_producto}

    productos = {}
    for regla in compra.reglas:
        clave = regla["clave"]
        if clave not in usadas:
            continue
        p = por_id.get(str(regla["id"])) or {}
        envase = compra._envase(regla, p or None)
        productos[clave] = {
            "id": str(regla["id"]),
            "nombre": p.get("nombre") or regla["nombre"],
            "nombre_receta": regla["nombre"],
            "pasillo": p.get("pasillo") or regla["seccion"],
            "subseccion": p.get("subseccion") or p.get("subcategoria", ""),
            "unidad_receta": regla.get("unidad", "ud"),
            "envase": round(envase, 2) if envase else None,
            "precio_unitario": p.get("precio"),
            "precio_referencia": p.get("precio_referencia"),
            "formato_referencia": p.get("formato_referencia"),
        }

    return {
        "_nota": "Generado por scripts/compra_recetas.py a partir de data/recetario.json, "
                 "data/planificador/ingredientes.json y el catálogo de Mercadona. No editar a mano.",
        "productos": productos,
        "recetas": recetas,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--comprobar", action="store_true", help="falla si data/compra_recetas.json no está al día")
    args = parser.parse_args()

    datos = generar()
    texto = json.dumps(datos, ensure_ascii=False, indent=1) + "\n"
    if args.comprobar:
        actual = open(DESTINO, encoding="utf-8").read() if os.path.exists(DESTINO) else ""
        if actual != texto:
            sys.exit("[!] data/compra_recetas.json no está al día: ejecuta python scripts/compra_recetas.py")
        print("[OK] data/compra_recetas.json al día.")
        return
    with open(DESTINO, "w", encoding="utf-8") as f:
        f.write(texto)
    sin = sum(1 for r in datos["recetas"].values() if r["sin_producto"])
    print(f"[OK] Compra de {len(datos['recetas'])} recetas con {len(datos['productos'])} productos "
          f"({sin} recetas con algún ingrediente sin producto).")


if __name__ == "__main__":
    main()
