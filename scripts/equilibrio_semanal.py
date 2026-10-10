#!/usr/bin/env python3
"""
Equilibrio de la semana completa según data/reglas_semana.json: pescado, legumbres,
carne roja y procesada, fritos, verdura diaria, variedad, proteína media de Lord.I y
kcal medias de Doña.Y. Las reglas de cada receta están en verificar_reglas.py.

La app aplica las mismas reglas al cambiar un plato (app/src/utils/equilibrio.js):
si se toca la lógica aquí, hay que tocarla también allí.

Uso: python scripts/equilibrio_semanal.py   (imprime el resumen de la semana publicada)
"""

import json
import os
import re
import unicodedata
from datetime import date, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TOMAS = ("comida", "cena")


def normalizar(texto):
    sin_tildes = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn").lower()


def _patron(palabra):
    # Palabra completa con plural opcional: 'lenteja' casa con 'lentejas' pero 'col' no con 'coliflor'
    return re.compile(r"(^|[^a-z])" + re.escape(normalizar(palabra)) + r"(s|es)?(?![a-z])")


def clasificar(receta, grupos):
    """{grupo: [palabras encontradas]} con los grupos presentes en la receta."""
    # De un ingrediente con alternativas ("pollo o jamón") solo cuenta la primera
    items = [re.split(r"\s+o\s+", normalizar(i.get("item", "")))[0] for i in receta.get("ingredientes", [])]
    texto = " | ".join([normalizar(receta.get("nombre", ""))] + items)
    forzados = receta.get("grupos", {})
    resultado = {}
    for clave, grupo in grupos.items():
        t = texto
        for excl in grupo.get("excluir", []):
            t = t.replace(normalizar(excl), " ")
        encontradas = [p for p in grupo["palabras"] if _patron(p).search(t)]
        if clave in forzados:
            encontradas = (encontradas or [clave]) if forzados[clave] else []
        if encontradas:
            resultado[clave] = encontradas
    return resultado


def _veces(n):
    return "1 vez" if n == 1 else f"{n} veces"


def _media(valores):
    return round(sum(valores) / len(valores)) if valores else None


def evaluar(menu, recetario, nutricion, base, reglas, cambios=None):
    """Lista de problemas {clave, nivel, texto} y resumen por grupo de la semana."""
    cambios = cambios or {}
    recetas = {r["id"]: r for r in recetario}
    grupos = reglas.get("grupos", {})
    clases = {rid: clasificar(r, grupos) for rid, r in recetas.items()}
    dias = menu.get("dias", [])
    try:
        inicio = date.fromisoformat(menu.get("fecha_inicio") or "")
    except ValueError:
        inicio = None

    problemas = []
    conteo = {g: 0 for g in grupos}
    usos = {}
    verduras = set()
    prot_i, kcal_y = [], []
    lord_i, dona_y = base.get("lord_i", {}), base.get("dona_y", {})
    fijos = lambda p: (sum(f.get("proteina_g", 0) for f in p.get("fijos", [])), sum(f.get("kcal", 0) for f in p.get("fijos", [])))

    for idx, d in enumerate(dias):
        etiqueta = d.get("dia", f"día {idx + 1}")
        laborable = inicio is not None and (inicio + timedelta(days=idx)).weekday() < 5
        verdura_dia, completo = False, True
        p_i, k_y = fijos(lord_i)[0], fijos(dona_y)[1]
        for tipo in TOMAS:
            rid = cambios.get(f"{idx}-{tipo}") or d.get(tipo, {}).get("receta_id")
            if not rid or rid not in recetas:
                completo = False
                continue
            usos[rid] = usos.get(rid, 0) + 1
            c = clases[rid]
            for g in c:
                conteo[g] += 1
            verduras.update(c.get("verdura", []))
            verdura_dia = verdura_dia or "verdura" in c
            if "frito" in c and tipo == "comida" and laborable and "sin_fritos_comida_laborable" in reglas:
                problemas.append({"clave": f"frito_laborable:{idx}", "desvio": 1, "nivel": reglas["sin_fritos_comida_laborable"]["nivel"],
                                  "texto": f"{etiqueta}: frito o rebozado en la comida de entre semana ({recetas[rid]['nombre']})"})
            n = nutricion.get(rid)
            if n:
                p_toma = n.get("lord_i", {}).get("proteina_g", 0)
                if lord_i.get("proteina_max_toma") and p_toma > lord_i["proteina_max_toma"]:
                    problemas.append({"clave": f"prot_toma:{idx}-{tipo}", "desvio": p_toma - lord_i["proteina_max_toma"], "nivel": "aviso",
                                      "texto": f"{etiqueta} ({tipo}): ración de Lord.I con ~{p_toma} g de proteína, más de {lord_i['proteina_max_toma']} g en una sola toma"})
                p_i += p_toma
                k_y += n.get("dona_y", {}).get("kcal", 0)
            else:
                completo = False
        if not verdura_dia and completo and "verdura_cada_dia" in reglas:
            problemas.append({"clave": f"verdura_dia:{idx}", "desvio": 1, "nivel": reglas["verdura_cada_dia"]["nivel"],
                              "texto": f"{etiqueta}: ni la comida ni la cena llevan verdura"})
        if completo:
            prot_i.append(p_i)
            kcal_y.append(k_y)
            tope_dia = lord_i.get("proteina_max_dia") or lord_i.get("proteina_max")
            if tope_dia and p_i > tope_dia:
                problemas.append({"clave": f"prot_dia:{idx}", "desvio": p_i - tope_dia, "nivel": "error",
                                  "texto": f"{etiqueta}: Lord.I ~{p_i} g de proteína supera el tope diario de {tope_dia} g"})
            elif lord_i.get("proteina_max") and p_i > lord_i["proteina_max"]:
                problemas.append({"clave": f"prot_alto:{idx}", "desvio": p_i - lord_i["proteina_max"], "nivel": "aviso",
                                  "texto": f"{etiqueta}: Lord.I ~{p_i} g de proteína, por encima de su rango de {lord_i.get('proteina_min')}-{lord_i['proteina_max']} g"})

    for lim in reglas.get("limites", []):
        g = lim["grupo"]
        nombre, n = grupos[g]["nombre"], conteo.get(g, 0)
        if "min" in lim and n < lim["min"]:
            problemas.append({"clave": f"min:{g}", "desvio": lim["min"] - n, "nivel": lim["nivel"],
                              "texto": f"{nombre}: {_veces(n)} en la semana, mínimo {lim['min']} ({lim['motivo']})"})
        if "max" in lim and n > lim["max"]:
            problemas.append({"clave": f"max:{g}", "desvio": n - lim["max"], "nivel": lim["nivel"],
                              "texto": f"{nombre}: {_veces(n)} en la semana, máximo {lim['max']} ({lim['motivo']})"})

    regla = reglas.get("verduras_distintas_min")
    if regla and len(verduras) < regla["valor"]:
        problemas.append({"clave": "verduras_distintas", "desvio": regla["valor"] - len(verduras), "nivel": regla["nivel"],
                          "texto": f"Solo {len(verduras)} verduras distintas en la semana, mínimo {regla['valor']}"})

    regla = reglas.get("receta_max_tomas")
    if regla:
        for rid, n in sorted(usos.items()):
            if n > regla["valor"]:
                problemas.append({"clave": f"repetida:{rid}", "desvio": n - regla["valor"], "nivel": regla["nivel"],
                                  "texto": f"'{recetas[rid]['nombre']}' aparece {_veces(n)} en la semana"})

    media_i, media_y = _media(prot_i), _media(kcal_y)
    regla = reglas.get("proteina_lord_i_media")
    if regla and media_i is not None:
        # El tope manda (protección renal); quedarse algo corto solo es un aviso
        if lord_i.get("proteina_max") and media_i > lord_i["proteina_max"]:
            problemas.append({"clave": "prot_media", "desvio": media_i - lord_i["proteina_max"], "nivel": regla.get("nivel_alto", "error"),
                              "texto": f"Lord.I: media de ~{media_i} g de proteína al día, por encima del tope de {lord_i['proteina_max']} g"})
        elif lord_i.get("proteina_min") and media_i < lord_i["proteina_min"]:
            problemas.append({"clave": "prot_media", "desvio": lord_i["proteina_min"] - media_i, "nivel": regla.get("nivel_bajo", "aviso"),
                              "texto": f"Lord.I: media de ~{media_i} g de proteína al día, por debajo de {lord_i['proteina_min']} g"})
    if "kcal_dona_y_media" in reglas and media_y is not None and dona_y.get("kcal_min") and media_y < dona_y["kcal_min"]:
        problemas.append({"clave": "kcal_media", "desvio": dona_y["kcal_min"] - media_y, "nivel": reglas["kcal_dona_y_media"]["nivel"],
                          "texto": f"Doña.Y: media de ~{media_y} kcal al día (con tentempiés), por debajo de {dona_y['kcal_min']} kcal"})

    resumen = {"grupos": conteo, "verduras_distintas": len(verduras), "proteina_lord_i_media": media_i, "kcal_dona_y_media": media_y}
    return problemas, resumen


def cargar():
    datos = {}
    for nombre in ("menu_semanal", "recetario", "nutricion_recetas", "nutricion_base", "reglas_semana"):
        with open(os.path.join(DATA_DIR, f"{nombre}.json"), "r", encoding="utf-8") as fp:
            datos[nombre] = json.load(fp)
    return datos


def comprobar(menu, recetario, avisos):
    """Errores de equilibrio para verificar_reglas.py. Antes de 'vigente_desde' todo queda en aviso."""
    ruta = os.path.join(DATA_DIR, "reglas_semana.json")
    if not os.path.exists(ruta):
        avisos.append("Falta reglas_semana.json: no se comprueba el equilibrio de la semana")
        return []
    datos = cargar()
    reglas = datos["reglas_semana"]
    problemas, resumen = evaluar(menu, recetario, datos["nutricion_recetas"].get("recetas", {}), datos["nutricion_base"], reglas)
    print(f"[*] Equilibrio semanal: {resumen}")
    exigible = (menu.get("fecha_inicio") or "") >= reglas.get("vigente_desde", "")
    errores = []
    for p in problemas:
        if p["clave"].startswith("prot_dia:"):
            continue  # ya lo comprueba verificar_reglas.py con su propio mensaje
        if p["nivel"] == "error" and exigible:
            errores.append(f"Equilibrio semanal: {p['texto']}")
        else:
            avisos.append(f"Equilibrio semanal: {p['texto']}")
    return errores


if __name__ == "__main__":
    d = cargar()
    problemas, resumen = evaluar(d["menu_semanal"], d["recetario"], d["nutricion_recetas"].get("recetas", {}),
                                 d["nutricion_base"], d["reglas_semana"])
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    for p in problemas:
        print(f"  [{p['nivel']}] {p['texto']}")
