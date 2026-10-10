#!/usr/bin/env python3
"""
Planificador automático del menú semanal (sábado a viernes).

Elige 13 recetas del recetario (la comida del domingo queda libre para comer en familia)
cumpliendo las mismas reglas que comprueba el despliegue: reglas médicas de
verificar_reglas.py, equilibrio semanal de data/reglas_semana.json, límites de proteína
de Lord.I y kcal de Doña.Y de data/nutricion_base.json. Además:

- comidas de lunes a viernes en tupper del batch cooking del domingo (recetas aptas);
- cenas de entre semana y del domingo rápidas (20 min como mucho);
- pescado fresco (salmón, dorada) solo de sábado a lunes, para que no espere en la nevera;
- rotación: no repite ninguna receta de la semana anterior y penaliza las de las dos previas.

Con el menú genera compra_semana.json a partir de los ingredientes de las recetas
(data/planificador/ingredientes.json los traduce a productos de Mercadona) y la lista de
la compra con precios del catálogo guardado (data/catalogo/mercadona.json). Cada intento
se valida con verificar_reglas.py antes de darlo por bueno.

Uso:
  python scripts/planificar_semana.py --fecha 2026-11-07      # guarda data/semanas/2026-11-07/
  python scripts/planificar_semana.py --prueba                # planifica la semana siguiente a la
                                                              # última guardada sin escribir nada
"""

import argparse
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import equilibrio_semanal as eq  # noqa: E402
from equilibrio_semanal import normalizar  # noqa: E402
from generar_lista_compra import cargar_catalogo, generar_lista_compra_mercadona  # noqa: E402

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SEMANAS_DIR = os.path.join(DATA_DIR, "semanas")
REGLAS_COMPRA = os.path.join(DATA_DIR, "planificador", "ingredientes.json")
FICHEROS_SEMANA = ("menu_semanal.json", "compra_semana.json", "lista_compra.json")

DIAS = ["Sábado", "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
COMIDA_LIBRE = (1, "comida")          # domingo a mediodía: comida en familia
MAX_MIN_CENA_RAPIDA = 20
DIAS_PESCADO_FRESCO = {0, 1, 2}       # sábado, domingo y lunes
PERECEDEROS = {"salmon", "dorada"}    # reglas de compra que son pescado fresco
# Ingredientes principales: mejor no repetirlos en la semana (pollo en filetes se admite dos veces)
PRINCIPALES = {"salmon", "merluza", "bacalao", "dorada", "atun_fresco", "atun_lata", "sardinillas",
               "salmon_ahumado", "pollo_entero", "jamoncitos", "muslos_contramuslos", "contramuslos",
               "pollo_picado", "picada_mixta", "picada_vacuno", "vacuno_guisar", "vacuno_filetes", "cordero",
               "costillas", "cabeza_lomo", "lomo_adobado", "cerdo_tacos", "lomo_cerdo", "salchichas",
               "garbanzo", "lenteja", "alubia_roja", "alubia_blanca", "pechuga"}
GRUPOS_DIA = ("pescado", "carne_roja", "ave", "procesada", "legumbre")


def cargar_json(ruta):
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f)


def guardar_json(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Ingredientes → artículos de la compra
# ---------------------------------------------------------------------------

def _patron(clave):
    return re.compile(r"(^|[^a-z])" + re.escape(normalizar(clave)) + r"(s|es)?(?![a-z])")


class Compra:
    """Traduce ingredientes del recetario a reglas de compra y suma cantidades."""

    def __init__(self, config):
        self.config = config
        self.reglas = config["reglas"]
        for r in self.reglas:
            r["_patrones"] = [_patron(c) for c in r["claves"]]
            r["_frases"] = [_patron(c) for c in r["claves"] if " y " in c]

    def regla(self, texto):
        for r in self.reglas:
            if any(p.search(texto) for p in r["_patrones"]):
                return r
        return None

    @staticmethod
    def cantidad(texto):
        """{'g': gramos o ml, 'ud': unidades} con lo que se pueda leer de la cantidad."""
        t = normalizar(texto)
        res = {}
        m = re.search(r"\(([^)]*)\)", t)
        if m:
            g = re.search(r"(\d+(?:[.,]\d+)?)(?:-\d+)?\s*(kg|g|gr|ml|l)\b", m.group(1))
            if g:
                v = float(g.group(1).replace(",", "."))
                res["g"] = v * (1000 if g.group(2) in ("kg", "l") else 1)
                if "cada" in m.group(1):
                    res["g_cada"] = True
            t = (t[:m.start()] + t[m.end():]).strip()
        m = re.match(r"(un|una|media|medio|\d+(?:[.,]\d+)?(?:/\d+)?(?:-\d+(?:[.,]\d+)?)?)\s*(.*)", t)
        if not m:
            return res
        num, resto = m.group(1), m.group(2)
        if num in ("un", "una"):
            v = 1.0
        elif num in ("media", "medio"):
            v = 0.5
        elif "/" in num:
            a, b = num.split("/")
            v = float(a) / float(b)
        elif "-" in num:
            v = float(num.split("-")[1].replace(",", "."))
        else:
            v = float(num.replace(",", "."))
        if re.match(r"y media|y medio", resto.split(" ", 1)[-1] if " " in resto else ""):
            v += 0.5
        unidad = (resto.split() or [""])[0]
        if unidad in ("g", "gr", "gramos", "kg", "ml", "l", "litro", "litros"):
            res["g"] = v * (1000 if unidad in ("kg", "l", "litro", "litros") else 1)
        elif unidad.startswith("cucharadita"):
            res.setdefault("g", v * 5)
        elif unidad.startswith("cucharada"):
            res.setdefault("g", v * 15)
        elif unidad.startswith("pizca"):
            res.setdefault("g", v)
        elif num in ("un", "una") and unidad in ("punado", "chorrito", "poco"):
            pass
        else:
            res["ud"] = v
            if res.pop("g_cada", False) and "g" in res:
                res["g"] *= v
        res.pop("g_cada", None)
        return res

    def desglosar(self, ingrediente):
        """[(regla, cantidad)] de un ingrediente; regla None si una parte no se reconoce."""
        texto = normalizar(ingrediente.get("item", ""))
        base = re.sub(r"\([^)]*\)", " ", texto)
        cant = ingrediente.get("cantidad", "")
        # Reglas cuya clave ya lleva una 'y' ("muslos y contramuslos") van enteras
        entera = self.regla(base)
        if entera and any(p.search(base) for p in entera["_frases"]):
            return [(entera, self.cantidad(cant))]
        partes = [p.strip() for p in re.split(r",\s*|\s+y\s+|\s*\+\s*", base) if p.strip()]
        reglas = [self.regla(re.split(r"\s+o\s+", p)[0]) for p in partes]
        utiles = [i for i, r in enumerate(reglas) if r and not r.get("ignorar")]
        if not utiles:
            return [(None, ingrediente.get("item", ""))] if not any(reglas) else []
        if len(utiles) == 1:
            return [(reglas[utiles[0]], self.cantidad(cant))]
        cant_n = normalizar(cant)
        if "de cada" in cant_n:
            q = self.cantidad(cant_n.replace("de cada", ""))
            return [(reglas[i], q) for i in utiles]
        trozos = [c for c in re.split(r",\s*|\s+y\s+|\s*\+\s*", cant_n) if c.strip()]
        if len(trozos) == len(partes):
            return [(reglas[i], self.cantidad(trozos[i])) for i in utiles]
        return [(reglas[utiles[0]], self.cantidad(cant))] + [(reglas[i], {}) for i in utiles[1:]]

    def reglas_de_receta(self, receta):
        """(claves de compra, ingredientes sin regla) de una receta."""
        claves, sin_regla = set(), []
        for ing in receta.get("ingredientes", []):
            for regla, _ in self.desglosar(ing):
                if regla is None:
                    sin_regla.append(ing.get("item", ""))
                elif not regla.get("despensa") and not regla.get("ignorar"):
                    claves.add(regla["clave"])
        return claves, sin_regla

    def articulos(self, tomas, catalogo):
        """compra_semana.json para las tomas [(etiqueta, receta)] de la semana."""
        por_id = {str(p.get("id")): p for p in catalogo}
        necesidad, usos, despensa = {}, {}, []
        for etiqueta, receta in tomas:
            for ing in receta.get("ingredientes", []):
                for regla, q in self.desglosar(ing):
                    if regla is None or regla.get("ignorar"):
                        continue
                    if regla.get("despensa"):
                        if regla["despensa"] not in despensa:
                            despensa.append(regla["despensa"])
                        continue
                    clave = regla["clave"]
                    necesidad[clave] = necesidad.get(clave, 0.0) + self._en_medida(regla, q)
                    usos.setdefault(clave, [])
                    if etiqueta not in usos[clave]:
                        usos[clave].append(etiqueta)

        articulos = [dict(f) for f in self.config.get("fijos", [])]
        for regla in self.reglas:
            clave = regla["clave"]
            if clave not in necesidad:
                continue
            envase = self._envase(regla, por_id.get(str(regla["id"])))
            total = necesidad[clave]
            paquetes = max(1, math.ceil(total / envase - 0.15)) if envase else 1
            articulos.append({
                "nombre_receta": f"{regla['nombre']} ({_lista(usos[clave])})",
                "cantidad": paquetes,
                "unidad": regla.get("unidad", "ud"),
                "seccion": regla["seccion"],
                "id_preferente": regla["id"],
                "termino_fallback": regla["termino"],
                "filtro_excluir": regla.get("excluir_catalogo", []),
            })
        despensa_siempre = self.config.get("despensa_siempre", [])
        return {
            "_nota": "Generado por scripts/planificar_semana.py a partir de las recetas del menú y "
                     "data/planificador/ingredientes.json. Se puede retocar a mano y volver a ejecutar "
                     "scripts/generar_lista_compra.py.",
            "supermercado": "Mercadona",
            "articulos": articulos,
            "despensa_excluida": despensa + [d for d in despensa_siempre if d not in despensa],
        }

    def coste(self, receta, por_id):
        """Coste aproximado en € de los ingredientes de una receta (fracción de envase usada)."""
        total = 0.0
        for ing in receta.get("ingredientes", []):
            for regla, q in self.desglosar(ing):
                if regla is None or regla.get("ignorar") or regla.get("despensa"):
                    continue
                producto = por_id.get(str(regla["id"]))
                if not producto:
                    continue
                envase = self._envase(regla, producto)
                cantidad = self._en_medida(regla, q)
                total += producto.get("precio", 0) * (min(cantidad / envase, 3) if envase and cantidad else 0.3)
        return total

    @staticmethod
    def _en_medida(regla, q):
        g_ud = regla.get("g_ud")
        if regla["medida"] == "g":
            if "g" in q:
                return q["g"]
            if "ud" in q and g_ud:
                return q["ud"] * g_ud
        else:
            if "ud" in q:
                return q["ud"]
            if "g" in q and g_ud:
                return q["g"] / g_ud
        return 0.0  # "al gusto", "un puñado": basta con un envase

    @staticmethod
    def _envase(regla, producto):
        if regla.get("envase"):
            return regla["envase"]
        if regla["medida"] == "g" and producto:
            precio, ref = producto.get("precio") or 0, producto.get("precio_referencia") or 0
            formato = (producto.get("formato_referencia") or "").lower()
            if precio and ref:
                if formato in ("kg", "l"):
                    return precio / ref * 1000
                if formato == "100 g":
                    return precio / ref * 100
        return None


def _lista(elementos):
    return elementos[0] if len(elementos) == 1 else ", ".join(elementos[:-1]) + " y " + elementos[-1]


# ---------------------------------------------------------------------------
# Elección de recetas
# ---------------------------------------------------------------------------

def sabado_de(d):
    return d - timedelta(days=(d.weekday() - 5) % 7)


def historial(fecha_inicio):
    """{receta_id: semanas de distancia} de los menús anteriores a fecha_inicio (1 = semana pasada)."""
    menus = []
    if os.path.isdir(SEMANAS_DIR):
        for nombre in os.listdir(SEMANAS_DIR):
            ruta = os.path.join(SEMANAS_DIR, nombre, "menu_semanal.json")
            if os.path.exists(ruta):
                menus.append(cargar_json(ruta))
    activo = os.path.join(DATA_DIR, "menu_semanal.json")
    if os.path.exists(activo):
        menus.append(cargar_json(activo))
    distancia = {}
    for m in menus:
        try:
            f = date.fromisoformat(m.get("fecha_inicio", ""))
        except ValueError:
            continue
        semanas = (fecha_inicio - f).days // 7
        if semanas < 1:
            continue
        for d in m.get("dias", []):
            for tipo in ("comida", "cena"):
                rid = (d.get(tipo) or {}).get("receta_id")
                if rid:
                    distancia[rid] = min(distancia.get(rid, 99), semanas)
    return distancia


class Planificador:
    def __init__(self, fecha_inicio, verbose=True):
        self.inicio = fecha_inicio
        self.verbose = verbose
        self.recetario = cargar_json(os.path.join(DATA_DIR, "recetario.json"))
        self.nutricion = cargar_json(os.path.join(DATA_DIR, "nutricion_recetas.json")).get("recetas", {})
        self.base = cargar_json(os.path.join(DATA_DIR, "nutricion_base.json"))
        self.reglas_semana = cargar_json(os.path.join(DATA_DIR, "reglas_semana.json"))
        self.compra = Compra(cargar_json(REGLAS_COMPRA))
        self.recetas = {r["id"]: r for r in self.recetario}
        self.distancia = historial(fecha_inicio)
        self.grupos = {rid: eq.clasificar(r, self.reglas_semana["grupos"]) for rid, r in self.recetas.items()}
        # evaluar() clasifica todas las recetas en cada llamada: con miles de pruebas se reutiliza el resultado
        eq.clasificar = lambda receta, grupos: self.grupos[receta["id"]]
        self.claves_compra, descartadas = {}, {}
        for rid, r in self.recetas.items():
            claves, sin_regla = self.compra.reglas_de_receta(r)
            if sin_regla:
                descartadas[rid] = sin_regla
            self.claves_compra[rid] = claves
        if descartadas and verbose:
            print("[aviso] Recetas que no se usan porque tienen ingredientes sin regla de compra "
                  "en data/planificador/ingredientes.json:")
            for rid, items in sorted(descartadas.items()):
                print(f"  - {rid}: {', '.join(items)}")
        por_id = {str(p.get("id")): p for p in cargar_catalogo()}
        self.coste = {rid: self.compra.coste(r, por_id) for rid, r in self.recetas.items()}
        self.validas = {rid for rid in self.recetas if rid in self.nutricion and rid not in descartadas
                        and self._segura_para_lord_i(self.recetas[rid])}
        self.slots = [(i, t) for i in range(7) for t in ("comida", "cena") if (i, t) != COMIDA_LIBRE]
        self.candidatas = {s: self._candidatas(*s) for s in self.slots}
        vacios = [s for s, c in self.candidatas.items() if not c]
        if vacios:
            raise RuntimeError(f"No hay recetas posibles para {vacios}")

    @staticmethod
    def _segura_para_lord_i(receta):
        # Mismo criterio que verificar_reglas.py con el texto que se copia al menú
        t = json.dumps(receta.get("adaptacion_lord_i", {}), ensure_ascii=False).lower()
        if "batido" in t and "sin batido" not in t and "cero" not in t:
            return False
        if "cebolla cruda" in t and "sin cebolla cruda" not in t and "cero cebolla cruda" not in t:
            return False
        return True

    def _perecedera(self, rid):
        return bool(self.claves_compra[rid] & PERECEDEROS)

    def _candidatas(self, idx, tipo):
        laborable = idx >= 2
        res = []
        for rid in self.validas:
            r = self.recetas[rid]
            if r.get("tipo") != tipo or self.distancia.get(rid) == 1:
                continue
            if self._perecedera(rid) and idx not in DIAS_PESCADO_FRESCO:
                continue
            if tipo == "comida" and laborable and not r.get("apto_batch_cooking"):
                continue
            if tipo == "cena" and idx >= 1 and r.get("tiempo_minutos", 99) > MAX_MIN_CENA_RAPIDA:
                continue
            res.append(rid)
        return sorted(res)

    def _menu_ligero(self, asignacion):
        dias = []
        for i in range(7):
            dias.append({"dia": DIAS[i], "comida": {"receta_id": asignacion.get((i, "comida"))},
                         "cena": {"receta_id": asignacion.get((i, "cena"))}})
        return {"fecha_inicio": self.inicio.isoformat(), "dias": dias}

    def puntuar(self, asignacion):
        ids = set(asignacion.values())
        problemas, resumen = eq.evaluar(self._menu_ligero(asignacion), [self.recetas[r] for r in ids],
                                        self.nutricion, self.base, self.reglas_semana)
        g = resumen["grupos"]
        p = 0.0
        for pr in problemas:
            p += (1000 if pr["nivel"] == "error" else 25) * max(1, pr.get("desvio", 1))
        p += 6 * max(0, g.get("legumbre", 0) - 3) + 6 * max(0, g.get("pescado", 0) - 3)
        p += 6 * max(0, g.get("carne_roja", 0) - 3) + 5 * max(0, g.get("procesada", 0) - 2)
        p += 6 * max(0, g.get("ave", 0) - 4) + 4 * max(0, 3 - g.get("pescado", 0))
        media = resumen["proteina_lord_i_media"] or 0
        p += abs(media - 88) * 1.5
        for rid in ids:
            d = self.distancia.get(rid)
            p += {2: 30, 3: 12, 4: 4}.get(d, 0)
        # Compra con precio comedido (~0,5 puntos por euro)...
        p += 0.5 * sum(self.coste[r] for r in ids)
        # ...compartir ingredientes la abarata y evita restos...
        claves = set().union(*(self.claves_compra[r] for r in ids))
        p += 0.8 * len(claves)
        # ...pero el ingrediente principal conviene variarlo
        for clave in PRINCIPALES:
            n = sum(1 for r in ids if clave in self.claves_compra[r])
            p += 6 * max(0, n - (2 if clave == "pechuga" else 1))
        # y que comida y cena del mismo día no sean del mismo grupo (pollo y pollo, ternera y ternera)
        for i in range(7):
            a, b = asignacion.get((i, "comida")), asignacion.get((i, "cena"))
            if a and b:
                p += 5 * sum(1 for g in GRUPOS_DIA if g in self.grupos[a] and g in self.grupos[b])
        p += 200 * (len(asignacion) - len(ids))  # cada receta una sola vez en la semana
        errores = [pr for pr in problemas if pr["nivel"] == "error"]
        return p, errores, resumen

    def buscar(self, semilla, reinicios=12, pasos=1500):
        rng = random.Random(f"nutriplan-{self.inicio.isoformat()}-{semilla}")
        mejor = None
        for _ in range(reinicios):
            asignacion, usadas = {}, set()
            for s in rng.sample(self.slots, len(self.slots)):
                libres = [r for r in self.candidatas[s] if r not in usadas] or self.candidatas[s]
                asignacion[s] = rng.choice(libres)
                usadas.add(asignacion[s])
            actual = self.puntuar(asignacion)
            for _ in range(pasos):
                s = rng.choice(self.slots)
                nueva = rng.choice(self.candidatas[s])
                if nueva == asignacion[s]:
                    continue
                prueba = dict(asignacion)
                otro = next((k for k, v in asignacion.items() if v == nueva), None)
                if otro:  # intercambio si la receta ya estaba en otra toma compatible
                    if asignacion[s] not in self.candidatas[otro]:
                        continue
                    prueba[otro] = asignacion[s]
                prueba[s] = nueva
                resultado = self.puntuar(prueba)
                if resultado[0] <= actual[0]:
                    asignacion, actual = prueba, resultado
            if mejor is None or actual[0] < mejor[1][0]:
                mejor = (asignacion, actual)
        return mejor

    # ---- menú completo ----------------------------------------------------

    def construir_menu(self, asignacion, resumen):
        fin = self.inicio + timedelta(days=6)
        dias = []
        for i in range(7):
            f = self.inicio + timedelta(days=i)
            dia = {"dia": f"{DIAS[i]} ({f.day:02d}/{f.month:02d})"}
            for tipo in ("comida", "cena"):
                rid = asignacion.get((i, tipo))
                dia[tipo] = self._toma(i, tipo, rid) if rid else _toma_libre()
            dias.append(dia)
        return {
            "semana": f"Semana {_rango(self.inicio, fin)} (generada automáticamente)",
            "fecha_inicio": self.inicio.isoformat(),
            "ciclo_semanal": f"Sábado {self.inicio:%d/%m} a Viernes {fin:%d/%m}",
            "objetivo_semana": self._objetivo(asignacion, resumen),
            "batch_cooking_domingo": self._batch(asignacion),
            "dias": dias,
        }

    def _toma(self, idx, tipo, rid):
        r = self.recetas[rid]
        t = r.get("tiempo_minutos", 0)
        if tipo == "comida" and idx >= 2:
            origen, tiempo = "Tupper Batch Cooking (recalentar 3 min microondas)", "3 min"
        elif tipo == "comida":
            origen, tiempo = f"Cocina fresca de fin de semana ({t} min)", f"{t} min"
        elif idx == 0:
            origen, tiempo = f"Cena de sábado ({t} min)", f"{t} min"
        elif idx == 1:
            origen, tiempo = f"Cena ligera tras el batch cooking ({t} min)", f"{t} min"
        else:
            origen, tiempo = f"Cena rápida ({t} min)", f"{t} min"
        n = self.nutricion.get(rid, {})
        ai, ay = r.get("adaptacion_lord_i", {}), r.get("adaptacion_dona_y", {})
        return {
            "receta_id": rid,
            "nombre": r["nombre"],
            "origen": origen,
            "tiempo_preparacion": tiempo,
            "adaptacion_lord_i": {
                "porcion": ai.get("plato", ""),
                "detalles": ai.get("proporciones", ""),
                "volumen_macros": f"Proteína de comida real (~{n.get('lord_i', {}).get('proteina_g', '?')} g).",
            },
            "adaptacion_dona_y": {
                "porcion": ay.get("plato", ""),
                "detalles": ay.get("proporciones", ""),
                "suplementacion": "Batido pautado a media tarde y tentempiés.",
            },
        }

    def _objetivo(self, asignacion, resumen):
        g = resumen["grupos"]
        pescados = [_corto(self.recetas[rid]["nombre"]) for s, rid in sorted(asignacion.items())
                    if "pescado" in self.grupos[rid]]
        lord_i, dona_y = self.base.get("lord_i", {}), self.base.get("dona_y", {})
        prot_dia = []
        for i in range(7):
            ids = [asignacion.get((i, t)) for t in ("comida", "cena")]
            if all(ids):
                prot_dia.append(sum(f.get("proteina_g", 0) for f in lord_i.get("fijos", []))
                                + sum(self.nutricion[r]["lord_i"]["proteina_g"] for r in ids))
        return (
            f"Menú elegido automáticamente entre las recetas del recetario sin repetir ninguna de la semana pasada. "
            f"Pescado {_veces(g.get('pescado', 0))} ({_lista(pescados) if pescados else 'ninguno'}), legumbre "
            f"{_veces(g.get('legumbre', 0))}, carne roja {_veces(g.get('carne_roja', 0))} y "
            f"{resumen['verduras_distintas']} verduras distintas. Comidas de lunes a viernes en tupper del batch "
            f"cooking del domingo y cenas de 20 minutos como mucho; la comida del domingo queda libre para comer "
            f"en familia. Lord.I queda en ~{resumen['proteina_lord_i_media']} g de proteína de media (máximo "
            f"{max(prot_dia)} g en un día, tope {lord_i.get('proteina_max_dia')} g) y Doña.Y en "
            f"~{resumen['kcal_dona_y_media']} kcal de media con su batido y tentempiés (objetivo "
            f"{dona_y.get('kcal_min')} kcal)."
        )

    def _batch(self, asignacion):
        tuppers = [(i, asignacion[(i, "comida")]) for i in range(2, 7)]
        recetas = sorted(tuppers, key=lambda x: -self.recetas[x[1]].get("tiempo_minutos", 0))
        total = sum(self.recetas[r].get("tiempo_minutos", 0) for _, r in tuppers)
        duracion = max(60, int(round(total * 0.55 / 15.0)) * 15)
        pasos, cursor, fin = [], 10, 10
        pasos.append({"orden": 1, "tiempo": "00:00 - 00:10",
                      "accion": "Sacar todo, lavar y picar la verdura de las cinco recetas. Si hay pescado "
                                "congelado para los tuppers, descongelarlo en la nevera desde la mañana."})
        for n, (i, rid) in enumerate(recetas, start=2):
            r = self.recetas[rid]
            t = r.get("tiempo_minutos", 30)
            ini, fin_r = cursor, cursor + t
            fin = max(fin, fin_r)
            destino = "a la nevera" if i <= 4 else "al congelador"
            pasos.append({"orden": n, "tiempo": f"{_hhmm(ini)} - {_hhmm(fin_r)}",
                          "accion": f"{r['nombre']} (tupper del {DIAS[i].lower()}, {destino}): "
                                    + " ".join(r.get("pasos_preparacion", []))})
            cursor += max(10, t // 2)
        pasos.append({"orden": len(pasos) + 1, "tiempo": f"{_hhmm(fin)} - {_hhmm(fin + 10)}",
                      "accion": "Envasado: tuppers de lunes a miércoles a la nevera a 4 °C; jueves y viernes "
                                "al congelador (pasarlos a la nevera la noche anterior)."})
        nombres = [f"{_corto(self.recetas[r]['nombre']).lower()} ({DIAS[i].lower()})" for i, r in tuppers]
        horno = any("horno" in " ".join(self.recetas[r].get("pasos_preparacion", [])).lower() for _, r in tuppers)
        equipo = ["Arrocera u olla grande para el arroz o la pasta", "2 cazuelas amplias para los guisos",
                  "2 sartenes"]
        if horno:
            equipo.append("Bandeja de horno")
        equipo.append("10 recipientes herméticos de cristal (4 aptos para congelador)")
        return {
            "duracion_estimada_minutos": duracion,
            "resumen": f"Sesión del domingo por la tarde (~{duracion // 60} h {duracion % 60:02d} min) con los "
                       f"cinco tuppers de la semana: {_lista(nombres)}.",
            "equipamiento": equipo,
            "cronograma_pasos": pasos,
            "conservacion": "Lunes a miércoles en nevera (máximo 3 días); jueves y viernes congelados el domingo "
                            "para no pasar de 4 días de nevera, sobre todo el pescado.",
        }


def _toma_libre():
    return {
        "receta_id": None,
        "nombre": "🎉 Comida en familia (toma flexible)",
        "origen": "Plan familiar fuera de casa; no se compra para esta toma",
        "tiempo_preparacion": "0 min",
        "adaptacion_lord_i": {"porcion": "Comida a elección", "detalles": "Sin quesos fuertes y sin cebolla cruda.",
                              "volumen_macros": "Toma libre."},
        "adaptacion_dona_y": {"porcion": "Comida a elección", "detalles": "Disfrutar de la comida familiar.",
                              "suplementacion": "Batido pautado."},
    }


def _corto(nombre):
    """'Poke bowl de salmón fresco, aguacate y...' → 'Poke bowl de salmón fresco'."""
    return re.split(r",| con | y | en salsa | sobre ", nombre)[0]


def _veces(n):
    return "1 vez" if n == 1 else f"{n} veces"


def _hhmm(minutos):
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _rango(ini, fin):
    if ini.month == fin.month:
        return f"del {ini.day} al {fin.day} de {MESES[fin.month - 1]}"
    return f"del {ini.day} de {MESES[ini.month - 1]} al {fin.day} de {MESES[fin.month - 1]}"


# ---------------------------------------------------------------------------
# Validación con los scripts del despliegue
# ---------------------------------------------------------------------------

def verificar_semana(carpeta):
    """Ejecuta verificar_reglas.py con los ficheros de la semana en una copia de data/. (ok, salida)"""
    with tempfile.TemporaryDirectory() as tmp:
        for nombre in os.listdir(DATA_DIR):
            ruta = os.path.join(DATA_DIR, nombre)
            if os.path.isfile(ruta) and nombre.endswith(".json"):
                shutil.copy(ruta, tmp)
        for nombre in FICHEROS_SEMANA:
            shutil.copy(os.path.join(carpeta, nombre), tmp)
        env = dict(os.environ, NUTRIPLAN_DATA_DIR=tmp)
        proc = subprocess.run([sys.executable, os.path.join(BASE_DIR, "scripts", "verificar_reglas.py")],
                              capture_output=True, text=True, env=env)
    return proc.returncode == 0, proc.stdout + proc.stderr


def planificar(fecha_inicio, destino, intentos=6, verbose=True):
    """Genera y valida la semana en la carpeta destino. Devuelve el menú."""
    plan = Planificador(fecha_inicio, verbose=verbose)
    catalogo = cargar_catalogo()
    ultimo = ""
    for intento in range(intentos):
        asignacion, (puntos, errores, resumen) = plan.buscar(intento)
        if errores:
            ultimo = "; ".join(e["texto"] for e in errores)
            continue
        menu = plan.construir_menu(asignacion, resumen)
        tomas = []
        for i, d in enumerate(menu["dias"]):
            for tipo in ("comida", "cena"):
                rid = d[tipo]["receta_id"]
                if rid:
                    tomas.append((f"{tipo} del {DIAS[i].lower()}", plan.recetas[rid]))
        compra = plan.compra.articulos(tomas, catalogo)
        os.makedirs(destino, exist_ok=True)
        guardar_json(os.path.join(destino, "menu_semanal.json"), menu)
        guardar_json(os.path.join(destino, "compra_semana.json"), compra)
        generar_lista_compra_mercadona(
            compra_file=os.path.join(destino, "compra_semana.json"),
            menu_file=os.path.join(destino, "menu_semanal.json"),
            lista_file=os.path.join(destino, "lista_compra.json"),
            catalogo=catalogo,
        )
        ok, salida = verificar_semana(destino)
        if ok:
            if verbose:
                print(f"[OK] Semana del {fecha_inicio} planificada (puntuación {puntos:.1f}) y validada.")
                print(f"     {resumen}")
            return menu
        ultimo = salida.strip().splitlines()[-5:]
        if verbose:
            print(f"[!] El intento {intento + 1} no pasa verificar_reglas.py:\n    " + "\n    ".join(ultimo))
    raise RuntimeError(f"No se ha encontrado un menú válido para la semana del {fecha_inicio}: {ultimo}")


def ultima_semana_guardada():
    fechas = []
    if os.path.isdir(SEMANAS_DIR):
        fechas = [n for n in os.listdir(SEMANAS_DIR) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", n)]
    activo = cargar_json(os.path.join(DATA_DIR, "menu_semanal.json")).get("fecha_inicio", "")
    return max(fechas + [activo])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fecha", help="sábado de inicio (AAAA-MM-DD); por defecto, el siguiente a la última semana guardada")
    ap.add_argument("--prueba", action="store_true", help="planifica y valida sin guardar nada")
    args = ap.parse_args()

    if args.fecha:
        inicio = date.fromisoformat(args.fecha)
    else:
        inicio = date.fromisoformat(ultima_semana_guardada()) + timedelta(days=7)
    if inicio.weekday() != 5:
        sys.exit(f"[!] {inicio} no es sábado: el menú va de sábado a viernes.")

    if args.prueba:
        with tempfile.TemporaryDirectory() as tmp:
            menu = planificar(inicio, tmp)
        print(f"[OK] Prueba superada: el planificador encuentra un menú válido para la semana del {inicio}.")
    else:
        destino = os.path.join(SEMANAS_DIR, inicio.isoformat())
        menu = planificar(inicio, destino)
        print(f"[OK] Guardada en {os.path.relpath(destino, BASE_DIR)}/")
    for i, d in enumerate(menu["dias"]):
        print(f"  {d['dia']}: {d['comida']['nombre']} | {d['cena']['nombre']}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        sys.exit(f"[!] {e}")
