"""Rebuild the extended, original composition gallery from compact design recipes.

The checked-in projects.json remains the reviewable source of truth. This
authoring helper replaces only its own IDs and verifies each proposed design
with the independent catalog geometry check before writing it.
"""
from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("plega_pipeline", ROOT / "data-pipeline/run.py")
assert SPEC and SPEC.loader
PIPE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PIPE)

# Title, Spanish title, intent EN/ES, design lesson EN/ES, card colour,
# and ordered parts: label|family|cutwork|colour|size.
RECIPES = [
    ("Cathedral of light", "Catedral de luz",
     "A procession of portals and pierced vaults rises through ten independent lanes.",
     "Una procesión de portales y bóvedas caladas asciende por diez bandas independientes.",
     "Compare how a tall V canopy changes the opening silhouette against a lower parallel arch.",
     "Compara cómo un dosel V alto cambia la silueta al abrirse frente a un arco paralelo bajo.",
     "#f5eee3", "Threshold|P|arcade|#a6594d|32, Lantern|V|lattice|#d0a454|34, Gallery|P|arcade|#a6594d|39, North vault|V|wing|#a4a073|40, Rose window|V|lattice|#c57861|32, Nave|P|arcade|#754b5a|37, High vault|V|lattice|#cea757|42, Bell|P|arcade|#a6594d|27, East vault|V|wing|#8a728c|37, Crown|P|arcade|#754b5a|30"),
    ("Tidal observatory", "Observatorio de mareas",
     "Alternating blue fins and open decks trace a rising tidal sequence.",
     "Aletas azules y plataformas abiertas alternan en una secuencia de mareas creciente.",
     "Change one fin's reach and watch its lane, motion, and printable contour respond.",
     "Cambia el alcance de una aleta y observa la banda, el movimiento y el contorno imprimible.",
     "#e7f2ee", "Shore|P|arcade|#1e6979|28, First swell|V|wing|#368e9b|35, Foam|V|lattice|#98c8bb|27, Tidal shelf|P|lattice|#277b8d|36, Crest|V|wing|#1f607f|43, Salt lace|V|lattice|#aad3c9|31, Deep shelf|P|arcade|#184d69|39, Last swell|V|wing|#367e9d|40, Horizon|P|lattice|#7ab8ae|28"),
    ("Canopy laboratory", "Laboratorio del dosel",
     "Branchlike ribs and folding leaf surfaces form a botanical paper canopy.",
     "Nervaduras ramificadas y superficies de hoja plegables forman un dosel botánico de papel.",
     "Inspect the difference between a step backbone and a V-fold leaf in the same motion.",
     "Examina la diferencia entre un eje escalonado y una hoja V en el mismo movimiento.",
     "#f1f1df", "Root plate|P|leaf|#566e4c|31, Low leaf|V|leaf|#78a063|37, Stem rib|P|leaf|#476850|25, West leaf|V|leaf|#9fba6b|44, East leaf|V|wing|#6d9d70|37, Branch|P|leaf|#597b56|29, Upper leaf|V|leaf|#afc47c|41, Seed veil|V|lattice|#719379|32, Crown|P|leaf|#345f51|34"),
    ("City after dark", "Ciudad nocturna",
     "A night skyline becomes a paper sequence of towers, windows, and crossing roofs.",
     "Un horizonte nocturno se convierte en una secuencia de torres, ventanas y techos cruzados.",
     "Change tower height while keeping its lane clear, then inspect the closed footprint.",
     "Cambia la altura de una torre manteniendo libre su banda y examina la huella cerrada.",
     "#e6e3ed", "Street|P|arcade|#394a72|25, Arcade|P|arcade|#586994|30, Tower one|P|lattice|#725e91|40, Roof one|V|wing|#9a78a4|32, Lantern|V|lattice|#d2ac76|29, Tower two|P|lattice|#475b83|43, Roof two|V|wing|#7e76a1|38, Bridge|P|arcade|#9a6689|27, Spire|V|lattice|#cda66f|40"),
    ("Migration theatre", "Teatro de migración",
     "Nine winged profiles move at different elevations across a staged flight path.",
     "Nueve perfiles alados se mueven a distintas alturas a lo largo de una ruta escénica.",
     "Frame each wing in 3D, change its fold geometry, and compare the shared opening.",
     "Encuadra cada ala en 3D, cambia su geometría de pliegue y compara la apertura común.",
     "#eee7e0", "Nest|P|leaf|#8d655b|29, Near wing|V|wing|#c1866c|34, Flight one|V|wing|#c29c7c|41, Rest|P|arcade|#76666f|25, Flight two|V|wing|#8a87aa|37, High wing|V|wing|#657c9c|43, Echo|P|lattice|#bd9787|28, Distant wing|V|wing|#9aabc3|33, Landing|P|leaf|#657c70|34"),
    ("Festival lantern wall", "Muro de faroles",
     "A repeated lattice rhythm alternates with broad light-catching panels.",
     "Un ritmo de celosías repetidas alterna con paneles anchos que capturan luz.",
     "Adjust cutout density without changing the underlying mechanism or page boundaries.",
     "Ajusta la densidad de calados sin cambiar el mecanismo ni los límites de la página.",
     "#fbecdb", "Entry|P|arcade|#d2634d|26, Lantern one|V|lattice|#edaa55|32, Banner|P|lattice|#b45c62|36, Lantern two|V|lattice|#dc8551|39, Curtain|P|arcade|#814b73|32, Lantern three|V|lattice|#e8b662|35, Crossbar|P|lattice|#a6627d|38, Lantern four|V|lattice|#cd704f|42, Finale|P|arcade|#754d68|29"),
    ("Geological section", "Sección geológica",
     "Layered strata, faultlike fins, and pierced shelves turn a cross section into motion.",
     "Estratos, aletas como fallas y repisas caladas convierten una sección en movimiento.",
     "Move an entire stratum along its lane and see exactly when neighbouring material conflicts.",
     "Desplaza un estrato por su banda y observa cuándo entra en conflicto con el material vecino.",
     "#f3eadb", "Sand|P|lattice|#d9b47b|39, Fault one|V|wing|#98664f|36, Clay|P|arcade|#bd795d|32, Seam|P|lattice|#8b7565|26, Fault two|V|wing|#a8745c|42, Limestone|P|arcade|#d6aa79|37, Mineral vein|V|lattice|#759297|30, Bedrock|P|lattice|#766971|42"),
    ("Orbiting forms", "Formas orbitales",
     "Alternating radial fins and quiet planes make an ordered celestial mobile.",
     "Aletas radiales y planos tranquilos alternan para formar un móvil celeste ordenado.",
     "Compare a dense perforated fin with a solid plane at the same opening angle.",
     "Compara una aleta muy calada con un plano sólido al mismo ángulo de apertura.",
     "#e9e9f1", "Ground|P|arcade|#545775|29, Inner orbit|V|wing|#8278a5|37, Transit|P|lattice|#6b88a8|32, Ring one|V|lattice|#b1a7bf|33, Core|P|arcade|#9a7497|39, Ring two|V|lattice|#6f90a7|41, Distant arc|V|wing|#b4a3aa|35, Signal|P|lattice|#c7a87f|27, Apex|V|wing|#6c729b|42"),
    ("Rainforest transect", "Transecto del bosque",
     "Ten separated botanical layers run from roots through understory to the crown.",
     "Diez capas botánicas separadas van de las raíces al sotobosque y la copa.",
     "Follow the material from lower rib to upper leaf while every edit keeps the print plan connected.",
     "Sigue el material desde la nervadura inferior a la hoja superior mientras cada edición conecta el plano de corte.",
     "#e8efdf", "Roots|P|leaf|#705e47|28, Floor|P|lattice|#607b50|26, Fern|V|leaf|#77a060|33, Sapling|P|leaf|#45694d|30, Understory|V|leaf|#9ab36f|36, Trunk|P|leaf|#665a43|42, Liana|V|wing|#668f6b|32, Broadleaf|V|leaf|#9dbd77|41, High branch|P|leaf|#527553|30, Crown|V|leaf|#aec887|43"),
    ("Signal bridge", "Puente de señales",
     "A long pedestrian-bridge silhouette is built from braced spans and repeating deck plates.",
     "La silueta de un puente peatonal se construye con tramos arriostrados y plataformas repetidas.",
     "Change an individual brace and compare its reach with the neighbouring deck lane.",
     "Cambia un arriostramiento y compara su alcance con la banda vecina de la plataforma.",
     "#e7eceb", "Abutment|P|arcade|#516c76|31, Brace one|V|lattice|#8ba7a4|35, Deck one|P|lattice|#c58c67|37, Brace two|V|wing|#6a8991|40, Tower|P|arcade|#546578|43, Brace three|V|lattice|#9db9af|39, Deck two|P|lattice|#c58c67|37, Brace four|V|wing|#6a8991|35, Landing|P|arcade|#516c76|31"),
    ("Coral reef study", "Estudio del arrecife",
     "Fanlike V folds and porous parallel shelves create a marine paper terrain.",
     "Pliegues V en abanico y repisas paralelas porosas crean un relieve marino de papel.",
     "Explore cutout pattern and material web on each reef surface before exporting the contour.",
     "Explora el patrón de calados y el ancho mínimo de papel de cada superficie antes de exportar el contorno.",
     "#e7eeec", "Sea floor|P|lattice|#4d7f81|32, Coral fan|V|wing|#da8f75|39, Branch|V|leaf|#c47570|34, Reef shelf|P|arcade|#72aba0|30, Sea fan|V|wing|#e8b385|44, Sponge|P|lattice|#ba8c73|35, Blue coral|V|leaf|#638f9b|36, Upper shelf|P|arcade|#73aba5|38, Surface|V|wing|#c39fa4|32"),
    ("Equinox garden", "Jardín de equinoccio",
     "Twelve parts organize a dense garden of sun screens, leaf sails, and shadow arches.",
     "Doce piezas organizan un jardín denso de pantallas solares, velas de hojas y arcos de sombra.",
     "Use selected-part framing to work inside a dense composition without losing its complete motion.",
     "Usa el encuadre de pieza seleccionada para trabajar en una composición densa sin perder el movimiento completo.",
     "#f3efe1", "Gate|P|arcade|#8b765d|29, Dew leaf|V|leaf|#9daf70|33, Morning ray|V|wing|#e3b669|38, Sundial|P|lattice|#b98f63|34, Fern|V|leaf|#6f9a6e|34, Shade arch|P|arcade|#7e8273|31, Noon sail|V|wing|#d49e58|42, Canopy|V|leaf|#9cb078|39, Mosaic|P|lattice|#ac806d|35, Dusk sail|V|wing|#b18186|37, Night leaf|V|leaf|#748d80|32, Gate out|P|arcade|#827a71|29"),
]


def slug(value: str) -> str:
    return "-".join("".join(ch.lower() if ch.isalnum() else " " for ch in value).split())


def bounds(module: dict) -> tuple[float, float]:
    p = module["params"]
    y = module["y"]
    if module["kind"] == "P":
        return y, y + p["width"]
    b, g = math.radians(p["betaDeg"]), math.radians(p["gammaDeg"])
    return (y + min(0, p["h"] * math.cos(b + g), p["tabInset"] * math.cos(b) - p["tabWidth"] * math.sin(b)),
            y + max(p["r"] * math.cos(b), p["h"] * math.cos(g) / math.cos(b)))


def composition(recipe: tuple[str, ...]) -> dict:
    title, spanish, description, description_es, learning, learning_es, paper, parts = recipe
    modules = []
    previous_hi = 0.0
    for index, encoded in enumerate(parts.split(", ")):
        label, kind, pattern, color, extent = encoded.split("|")
        if kind == "P":
            width = int(extent)
            params = {"a": 24 + index % 5 * 3, "b": 27 + index % 4 * 3, "width": width}
        else:
            r = int(extent)
            params = {"r": r, "h": r + 15 + index % 3 * 3, "betaDeg": 25,
                      "gammaDeg": 65, "tabWidth": 6, "tabInset": 5}
        module = {"id": slug(label), "kind": kind, "label": label, "color": color,
                  "y": 0, "params": params, "pins": [],
                  "cutwork": {"pattern": pattern, "detail": 2 + index % 4, "web": 1.4}}
        lo, _ = bounds(module)
        module["y"] = round((14 if not modules else previous_hi + 9) - lo, 4)
        _, previous_hi = bounds(module)
        modules.append(module)
    # A finished composition still has one free, checked lane for direct editing.
    height = math.ceil(previous_hi + 85)
    project = {"schemaVersion": 1, "title": title,
               "card": {"W": 112, "H": height, "margin": 7, "gap": 8,
                        "blank": "uncreased", "color": paper, "pins": []},
               "modules": modules}
    issues = PIPE.project_issues(project)
    if issues:
        raise ValueError(f"{title}: {sorted(issues)}")
    return {"id": slug(title), "title": {"en": title, "es": spanish},
            "description": {"en": description, "es": description_es},
            "learning": {"en": learning, "es": learning_es}, "project": project}


def main() -> None:
    path = ROOT / "data/sources/projects.json"
    data = PIPE.read_json(path)
    own = {slug(recipe[0]) for recipe in RECIPES}
    data["starters"] = [item for item in data["starters"] if item["id"] not in own]
    data["starters"].extend(composition(recipe) for recipe in RECIPES)
    PIPE.validate_catalog(data)
    path.write_bytes(PIPE.encode(data))
    print(json.dumps({"projects": len(data["starters"]), "bytes": path.stat().st_size}))


if __name__ == "__main__":
    main()
