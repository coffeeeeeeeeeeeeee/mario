#!/usr/bin/env bash
# Arma el zip del juego para subir a itch.io (proyecto HTML5): lo que el juego necesita para correr, incluida la IA del título
# (assets/ia/modelo.js), y nada más. El zip se guarda FUERA del proyecto, al lado de su carpeta (../mario-itch.zip).
#
#   tools/empaquetar-itch.sh                     arma ../mario-itch.zip
#   tools/empaquetar-itch.sh --salida ruta.zip   lo guarda en otro lado
#   tools/empaquetar-itch.sh --extra ruta        agrega un archivo o carpeta más (por si el juego pasa a usar otro)
#
# Nunca entran tools/ (adentro están la ROM y el desensamblado), .git ni .entrenamiento: si algo así llegara a la lista, se corta.
# Los pesos de la IA quedan fijos al exportarlos: si reentrenaste, corré antes ./entrenar.sh exportar.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="$(cd .. && pwd)/$(basename "$PWD")-itch.zip"
EXTRA=()
while [ $# -gt 0 ]; do
	case "$1" in
		--salida) OUT=$2; shift 2 ;;
		--extra) EXTRA+=("$2"); shift 2 ;;
		*) echo "Opción desconocida: $1 (mirá el principio de este archivo)" >&2; exit 1 ;;
	esac
done

python3 - "$OUT" "${EXTRA[@]+"${EXTRA[@]}"}" <<'PY'
import os
import re
import sys
import zipfile

out, extra = os.path.abspath(sys.argv[1]), sys.argv[2:]
# Lo que carga index.html: los scripts de la raíz y las carpetas css y assets
INCLUIR = ["index.html", "js2d.js", "atlas.js", "levels_smb.js", "mario.js", "ia.js", "game.js", "api.js", "css", "assets"] + extra
PROHIBIDO = re.compile(r"(^|/)(tools|\.git|\.entrenamiento|node_modules|\.venv)(/|$)|\.(nes|asm|zip|log)$|\.env$")

archivos = []
for item in INCLUIR:
    if not os.path.exists(item):
        sys.exit(f"Falta {item}" + (" (se genera con ./entrenar.sh exportar)" if item.startswith("assets/ia") else ""))
    if os.path.isdir(item):
        for d, dirs, fs in os.walk(item):
            dirs.sort()
            archivos += [os.path.join(d, f).replace(os.sep, "/") for f in sorted(fs)]
    else:
        archivos.append(item.replace(os.sep, "/"))

malos = [a for a in archivos if PROHIBIDO.search(a)]
if malos:
    sys.exit("No se arma el zip: la lista incluye archivos que no deben publicarse:\n  " + "\n  ".join(malos))
# index.html tiene que cargar scripts que estén en la lista
html = open("index.html", encoding="utf-8").read()
faltan = [s for s in re.findall(r'src="([^"]+)"', html) + re.findall(r'href="([^"]+)"', html) if not s.startswith("http") and s not in archivos]
if faltan:
    sys.exit("index.html usa archivos que no entran en el zip: " + ", ".join(faltan))

os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for a in archivos:
        z.write(a, a)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None and "index.html" in z.namelist()
print(f"{out}\n  {len(archivos)} archivos, {os.path.getsize(out) / 1e6:.1f} MB; index.html en la raíz; incluye la IA del título: {'sí' if 'assets/ia/modelo.js' in archivos else 'NO'}")
PY
