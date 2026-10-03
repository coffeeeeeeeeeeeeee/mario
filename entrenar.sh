#!/usr/bin/env bash
# Entrena una IA para jugar y deja ver las partidas en vivo en el navegador.
#
#   ./entrenar.sh setup                 instala lo que hace falta (una vez): un entorno de Python con PyTorch y Stable-Baselines3
#   ./entrenar.sh start [opciones]      arranca el servidor del juego y el entrenamiento, y abre la vista en vivo
#   ./entrenar.sh stop                  detiene todo y guarda el modelo
#   ./entrenar.sh status                dice si está corriendo y cómo viene
#   ./entrenar.sh logs                  sigue el registro del entrenamiento
#   ./entrenar.sh watch                 abre de nuevo la vista en vivo
#
# Opciones de start:
#   --worlds 1-1,2-1     niveles en los que entrena (se sortea uno en cada episodio)        [1-1]
#                        acepta comodines (1-*, *-4), grupos (todos, exterior, subterraneo, agua, castillo) y, con un
#                        - delante, los que se sacan: "todos,-8-4" o "todos,-5-*,-6-*" (para evaluar en los que faltan)
#   --steps 2000000      pasos de entrenamiento (cada paso son 4 cuadros del juego)         [1000000]
#   --envs 8             partidas en paralelo                                              [8]
#   --name modelo        nombre del modelo, que queda en .entrenamiento/modelos/            [modelo]
#   --resume modelo      seguir desde un modelo guardado antes (nombre o ruta)
#   --watch 4            cuántas partidas se ven a la vez en la vista en vivo               [4]
#   --speed 2            velocidad de la vista en vivo (1, 2, 4 u 8)                        [1]
#   --port 8777          puerto del servidor                                               [8777]
#   --no-browser         no abrir el navegador (la dirección se muestra igual)
#
# Con --pausa al principio (./entrenar.sh --pausa start) la ventana espera una tecla al terminar; sirve para los accesos directos.
# Todo lo que genera (registros, modelos, procesos) queda en .entrenamiento/. Se puede cambiar el Python con PYTHON=ruta.
set -euo pipefail
cd "$(dirname "$0")"

# --pausa (lo usan los accesos directos): al terminar, la ventana espera una tecla para que se pueda leer el resultado
if [ "${1:-}" = "--pausa" ]; then
	shift
	trap 'echo; read -r -n1 -s -p "Enter para cerrar esta ventana" || true; echo' EXIT
fi

RUN=.entrenamiento
VENV=tools/ai/.venv
PY=${PYTHON:-}
if [ -z "$PY" ]; then
	if [ -x "$VENV/bin/python" ]; then PY="$VENV/bin/python"; else PY=python3; fi
fi

WORLDS=1-1; STEPS=1000000; ENVS=8; NAME=modelo; RESUME=""; WATCH=4; SPEED=1; PORT=8777; OPEN=1

die() { echo "Error: $*" >&2; exit 1; }
alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
url() { echo "http://127.0.0.1:$PORT/watch?n=$WATCH&speed=$SPEED"; }

open_url() {
	if [ "$OPEN" = 1 ]; then
		if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
		elif command -v open >/dev/null 2>&1; then open "$1" >/dev/null 2>&1 &
		else echo "(no encontré cómo abrir el navegador: abrí la dirección a mano)"; fi
	fi
}

load_settings() {   # el puerto y la vista que se usaron al arrancar
	[ -f "$RUN/settings" ] && . "$RUN/settings" || true
}

cmd_setup() {
	command -v python3 >/dev/null || die "falta python3"
	[ -d "$VENV" ] || python3 -m venv "$VENV"
	echo "Instalando PyTorch (versión para CPU) y Stable-Baselines3; son unos 1000 MB de descarga..."
	"$VENV/bin/pip" install -q torch --index-url https://download.pytorch.org/whl/cpu
	"$VENV/bin/pip" install -q stable-baselines3
	echo "Listo. Ahora: ./entrenar.sh start"
}

cmd_start() {
	while [ $# -gt 0 ]; do
		case "$1" in
			--worlds) WORLDS=$2; shift 2 ;;
			--steps) STEPS=$2; shift 2 ;;
			--envs) ENVS=$2; shift 2 ;;
			--name) NAME=$2; shift 2 ;;
			--resume) RESUME=$2; shift 2 ;;
			--watch) WATCH=$2; shift 2 ;;
			--speed) SPEED=$2; shift 2 ;;
			--port) PORT=$2; shift 2 ;;
			--no-browser) OPEN=0; shift ;;
			*) die "opción desconocida: $1 (mirá el principio de este archivo)" ;;
		esac
	done
	command -v node >/dev/null || die "falta node"
	if ! "$PY" -c "import stable_baselines3" 2>/dev/null; then
		# En una ventana interactiva (por ejemplo, desde el acceso directo) se ofrece instalarlo en el momento
		if [ -t 0 ]; then
			read -r -p "Faltan PyTorch y Stable-Baselines3 (unos 1000 MB de descarga). ¿Instalarlos ahora? [s/N] " ans
			case "$ans" in s|S|si|sí|Si|SI) cmd_setup; [ -n "${PYTHON:-}" ] || PY="$VENV/bin/python" ;; *) die "sin eso no se puede entrenar (./entrenar.sh setup)" ;; esac
		else
			die "faltan PyTorch y Stable-Baselines3: corré ./entrenar.sh setup"
		fi
	fi
	mkdir -p "$RUN/modelos"
	if alive "$RUN/train.pid" || alive "$RUN/server.pid"; then die "ya hay un entrenamiento en marcha (./entrenar.sh status, ./entrenar.sh stop)"; fi

	local resume_args=()
	if [ -n "$RESUME" ]; then
		[ -f "$RESUME" ] || RESUME="$RUN/modelos/${RESUME%.zip}.zip"
		[ -f "$RESUME" ] || die "no encuentro el modelo para --resume"
		resume_args=(--resume "$RESUME")
	fi

	PORT=$PORT setsid node tools/ai/server.js > "$RUN/server.log" 2>&1 < /dev/null &
	echo $! > "$RUN/server.pid"
	for _ in $(seq 1 50); do
		curl -sf "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1 && break
		alive "$RUN/server.pid" || { cat "$RUN/server.log"; die "el servidor no arrancó"; }
		sleep 0.3
	done
	curl -sf "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1 || die "el servidor no contesta en el puerto $PORT"

	setsid "$PY" -u tools/ai/train.py train --worlds "$WORLDS" --steps "$STEPS" --envs "$ENVS" --out "$RUN/modelos/$NAME" \
		--url "http://127.0.0.1:$PORT" "${resume_args[@]}" > "$RUN/train.log" 2>&1 < /dev/null &
	echo $! > "$RUN/train.pid"
	printf 'PORT=%s\nWATCH=%s\nSPEED=%s\nNAME=%s\n' "$PORT" "$WATCH" "$SPEED" "$NAME" > "$RUN/settings"

	echo "Entrenando en $WORLDS ($STEPS pasos, $ENVS partidas en paralelo)."
	echo "Vista en vivo: $(url)"
	echo "Registro:      ./entrenar.sh logs      Detener y guardar: ./entrenar.sh stop"
	open_url "$(url)"
}

stop_one() {   # $1 archivo de pid, $2 nombre, $3 segundos de espera
	alive "$1" || { rm -f "$1"; return 0; }
	local pid; pid=$(cat "$1")
	kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
	for _ in $(seq 1 $(($3 * 5))); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
	if kill -0 "$pid" 2>/dev/null; then
		echo "$2 no terminó a tiempo: se lo fuerza"
		kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
	fi
	rm -f "$1"
}

cmd_stop() {
	load_settings
	if ! alive "$RUN/train.pid" && ! alive "$RUN/server.pid"; then echo "No hay nada en marcha."; return 0; fi
	echo "Deteniendo el entrenamiento (se guarda el modelo)..."
	stop_one "$RUN/train.pid" "el entrenamiento" 60
	stop_one "$RUN/server.pid" "el servidor" 5
	[ -f "$RUN/train.log" ] && tail -n 2 "$RUN/train.log"
	echo "Modelos en $RUN/modelos/"
}

cmd_status() {
	load_settings
	if alive "$RUN/train.pid"; then
		echo "Entrenamiento en marcha (pid $(cat "$RUN/train.pid"))."
		echo "Vista en vivo: $(url)"
		tail -n 3 "$RUN/train.log"
	else
		echo "No hay un entrenamiento en marcha."
		[ -f "$RUN/train.log" ] && { echo "Último registro:"; tail -n 2 "$RUN/train.log"; }
	fi
	ls "$RUN/modelos" 2>/dev/null | sed 's/^/  modelo: /' || true
}

cmd_logs() { [ -f "$RUN/train.log" ] || die "todavía no hay registro"; tail -n 20 -f "$RUN/train.log"; }

cmd_watch() {
	load_settings
	alive "$RUN/server.pid" || die "no hay un entrenamiento en marcha"
	echo "$(url)"; open_url "$(url)"
}

case "${1:-}" in
	setup) cmd_setup ;;
	start) shift; cmd_start "$@" ;;
	stop) cmd_stop ;;
	status) cmd_status ;;
	logs) cmd_logs ;;
	watch) cmd_watch ;;
	*) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 1 ;;
esac
