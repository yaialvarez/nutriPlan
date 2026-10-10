#!/usr/bin/env python3
"""
Semanas guardadas por adelantado y cambio automático de semana según la fecha.

data/semanas/AAAA-MM-DD/ guarda menu_semanal.json, compra_semana.json y lista_compra.json de
cada semana (sábado a viernes). Los ficheros de data/ son la copia de trabajo de la semana
en curso: es lo que validan los scripts y lo que publica la web.

  python scripts/semanas.py activar [--fecha AAAA-MM-DD] [--generar]
      Pone en data/ la semana que corresponde a la fecha (hoy en España por defecto). La semana
      que sale se archiva antes en data/semanas/ con los cambios que se le hubieran hecho, y la
      lista de la compra se recalcula con el catálogo de precios guardado más reciente.
      Con --generar, si esa semana no está guardada la crea scripts/planificar_semana.py.
      Si data/ ya tiene esa semana (o una posterior) no toca nada.

  python scripts/semanas.py comprobar
      Valida con verificar_reglas.py todas las semanas guardadas posteriores a la activa.
"""

import argparse
import os
import shutil
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_lista_compra import generar_lista_compra_mercadona  # noqa: E402
from planificar_semana import (DATA_DIR, FICHEROS_SEMANA, SEMANAS_DIR, cargar_json,  # noqa: E402
                               planificar, sabado_de, verificar_semana)

try:
    from zoneinfo import ZoneInfo
    HOY = datetime.now(ZoneInfo("Europe/Madrid")).date()
except Exception:  # sin base de datos de zonas horarias: UTC basta (el cambio es a las 5:00)
    HOY = datetime.utcnow().date()


def fecha_activa():
    return cargar_json(os.path.join(DATA_DIR, "menu_semanal.json")).get("fecha_inicio", "")


def guardadas():
    if not os.path.isdir(SEMANAS_DIR):
        return []
    return sorted(n for n in os.listdir(SEMANAS_DIR)
                  if all(os.path.exists(os.path.join(SEMANAS_DIR, n, f)) for f in FICHEROS_SEMANA))


def copiar(origen, destino):
    os.makedirs(destino, exist_ok=True)
    for nombre in FICHEROS_SEMANA:
        shutil.copy(os.path.join(origen, nombre), os.path.join(destino, nombre))


def activar(fecha, generar=False):
    objetivo = sabado_de(fecha).isoformat()
    activa = fecha_activa()
    if activa >= objetivo:
        print(f"[OK] data/ ya tiene la semana del {activa}; no hay que cambiar nada.")
        return False
    carpeta = os.path.join(SEMANAS_DIR, objetivo)
    if objetivo not in guardadas():
        if not generar:
            print(f"[aviso] No hay semana guardada para el {objetivo}: se mantiene la del {activa}.")
            return False
        print(f"[*] No hay semana guardada para el {objetivo}: la planifico ahora.")
        planificar(date.fromisoformat(objetivo), carpeta)
    if activa:
        copiar(DATA_DIR, os.path.join(SEMANAS_DIR, activa))
        print(f"[*] Semana del {activa} archivada en data/semanas/{activa}/")
    copiar(carpeta, DATA_DIR)
    # Precios del catálogo más reciente (puede haberse actualizado desde que se planificó)
    generar_lista_compra_mercadona()
    print(f"[OK] Activada la semana del {objetivo}.")
    return True


def comprobar():
    activa = fecha_activa()
    pendientes = [f for f in guardadas() if f > activa]
    fallos = []
    for f in pendientes:
        ok, salida = verificar_semana(os.path.join(SEMANAS_DIR, f))
        print(f"[{'OK' if ok else '!!'}] Semana guardada del {f}")
        if not ok:
            fallos.append(f)
            print("    " + "\n    ".join(salida.strip().splitlines()[-12:]))
    if not pendientes:
        print("[*] No hay semanas guardadas por delante de la activa.")
    return not fallos


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="orden", required=True)
    a = sub.add_parser("activar", help="pone en data/ la semana que toca por fecha")
    a.add_argument("--fecha", help="AAAA-MM-DD (por defecto, hoy en España)")
    a.add_argument("--generar", action="store_true", help="planifica la semana si no está guardada")
    sub.add_parser("comprobar", help="valida las semanas guardadas por delante de la activa")
    args = ap.parse_args()

    if args.orden == "activar":
        activar(date.fromisoformat(args.fecha) if args.fecha else HOY, generar=args.generar)
    elif not comprobar():
        sys.exit(1)


if __name__ == "__main__":
    main()
