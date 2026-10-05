#!/usr/bin/env bash
# Entrena una IA para jugar y deja ver las partidas en vivo en el navegador.
#
#   ./entrenar.sh setup                 instala lo que hace falta (una vez): un entorno de Python con PyTorch y Stable-Baselines3
#   ./entrenar.sh start [opciones]      arranca el servidor del juego y el entrenamiento, y abre la vista en vivo; si ya hay un
#                                       modelo guardado, CONTINÚA desde ahí (con los mismos niveles) en vez de empezar de cero
#   ./entrenar.sh stop                  detiene todo y guarda el modelo
#   ./entrenar.sh status                dice si está corriendo y cómo viene
#   ./entrenar.sh logs                  sigue el registro del entrenamiento
#   ./entrenar.sh watch                 abre de nuevo la vista en vivo
#   ./entrenar.sh exportar [modelo]     pasa el modelo guardado (por defecto el que se está entrenando) a assets/ia/, de donde lo lee
#                                       el título del juego para que juegue la IA cuando nadie lo usa
#
# Opciones de start:
#   --worlds 1-1,2-1     niveles en los que entrena (se sortea uno en cada episodio, y cada partida toma uno distinto)  [todos]
#                        acepta comodines (1-*, *-4), grupos (todos, exterior, subterraneo, agua, castillo) y, con un
#                        - delante, los que se sacan: "todos,-8-4" o "todos,-5-*,-6-*" (para evaluar en los que faltan)
#   --steps 2000000      pasos de entrenamiento (cada paso son 4 cuadros del juego)         [1000000]
#   --envs 8             partidas en paralelo                                              [8]
#   --name modelo        nombre del modelo, que queda en .entrenamiento/modelos/            [modelo]
#   --shaping 0.5        peso de la recompensa por acercarse a la meta (mástil, hacha o caño de salida); 0 la apaga  [0.5]
#   --nuevo              empezar de cero aunque haya un modelo guardado (el viejo queda como modelo.copia-FECHA.zip). Los modelos
#                        nuevos llevan memoria de los últimos pasos; uno de antes (sin ella) sigue sin ella al continuarlo
#   --resume modelo      seguir desde otro modelo guardado antes (nombre o ruta); sin esto se sigue el del --name
#   --watch 6            cuántas pantallas se ven a la vez al abrir la vista (1, 2, 4, 6, 8 o 16; se cambia en la
#                        propia página). Sólo hay datos para tantas como --envs                [6]
#   --speed 2            velocidad de la vista en vivo (1, 2, 4 u 8)                        [1]
#   --port 8777          puerto del servidor                                               [8777]
#   --no-browser         no abrir el navegador (la dirección se muestra igual)
#
# Con --pausa al principio (./entrenar.sh --pausa start) la ventana espera una tecla al terminar; sirve para los accesos directos.
# Todo lo que genera queda en .entrenamiento/: modelos/modelo.zip (el modelo, que se va acumulando) con modelo.json (los pasos que lleva),
# las copias de los últimos 5 arranques, train.log (la corrida actual) e historial.log (las anteriores). Se puede cambiar el Python con PYTHON=ruta.
set -euo pipefail
cd "$(dirname "$0")"

# --pausa (lo usan los accesos directos): al terminar, la ventana espera una tecla para que se pueda leer el resultado
if [ "${1:-}" = "--pausa" ]; then
	shift
	trap 'echo; read -r -n1 -s -p "Enter para cerrar esta ventana" || true; echo' EXIT
fi

RUN=${ENTRENAR_DIR:-.entrenamiento}   # ENTRENAR_DIR: otra carpeta de trabajo, para no tocar los modelos de otro entrenamiento
VENV=tools/ai/.venv
PY=${PYTHON:-}
if [ -z "$PY" ]; then
	if [ -x "$VENV/bin/python" ]; then PY="$VENV/bin/python"; else PY=python3; fi
fi

WORLDS=todos; STEPS=1000000; ENVS=8; NAME=modelo; RESUME=""; WATCH=6; SPEED=1; PORT=8777; OPEN=1; NEW=0; SHAPING=0.5

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

# Arranca un proceso en segundo plano, en su propia sesión (así se lo puede detener con todo lo que lanza), y guarda su pid.
# El pid lo escribe el propio proceso: con setsid, $! a veces es el de un intermediario que ya terminó.
launch() {   # $1 archivo de pid, $2 archivo de registro, resto: el comando
	local pf=$1 lf=$2; shift 2
	rm -f "$pf"
	setsid bash -c 'echo $$ > "$0"; exec "$@"' "$pf" "$@" > "$lf" 2>&1 < /dev/null &
	for _ in $(seq 1 30); do [ -s "$pf" ] && break; sleep 0.1; done
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
	# Lo que se usó la vez anterior (niveles, partidas, vista...) queda como valor por defecto, así que arrancar sin opciones
	# sigue con lo mismo
	load_settings
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
			--shaping) SHAPING=$2; shift 2 ;;
			--nuevo) NEW=1; shift ;;
			*) die "opción desconocida: $1 (mirá el principio de este archivo)" ;;
		esac
	done
	[ "$WATCH" -le "$ENVS" ] 2>/dev/null || echo "Aviso: la vista pide $WATCH pantallas pero el entrenamiento tiene $ENVS partidas; las que sobren quedan sin datos (para verlas, --envs $WATCH)."
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
	if alive "$RUN/train.pid"; then die "ya hay un entrenamiento en marcha (./entrenar.sh status, ./entrenar.sh stop)"; fi
	# Si el entrenamiento terminó solo, el servidor del juego queda encendido: se apaga acá en vez de pedir que se lo detenga a mano
	if alive "$RUN/server.pid"; then echo "Apagando el servidor que quedó de la vez anterior..."; stop_one "$RUN/server.pid" "el servidor" 5; fi

	local resume_args=() own="$RUN/modelos/$NAME.zip"
	if [ -n "$RESUME" ]; then
		[ -f "$RESUME" ] || RESUME="$RUN/modelos/${RESUME%.zip}.zip"
		[ -f "$RESUME" ] || die "no encuentro el modelo para --resume"
		resume_args=(--resume "$RESUME")
	elif [ "$NEW" = 1 ]; then
		if [ -f "$own" ]; then
			local copia="$RUN/modelos/$NAME.copia-$(date +%Y%m%d-%H%M%S).zip"
			mv "$own" "$copia"; [ -f "$RUN/modelos/$NAME.json" ] && mv "$RUN/modelos/$NAME.json" "${copia%.zip}.json"
			echo "Empezando de cero; el modelo anterior quedó en $copia"
		fi
	elif [ -f "$own" ]; then
		resume_args=(--resume "$own")   # lo normal: seguir con lo aprendido
	fi
	# Copia del modelo tal como estaba antes de esta corrida: el entrenamiento lo va guardando encima cada 50.000 pasos, y si se
	# retoma con otros niveles o con un error, así se puede volver atrás
	if [ ${#resume_args[@]} -gt 0 ]; then
		# Se guardan las copias de los últimos 5 arranques (inicio = el último, inicio.1 = el anterior, ... inicio.5): cada una es el
		# modelo tal como estaba antes de esa corrida
		local m="$RUN/modelos/$NAME" i
		for i in 4 3 2 1; do
			[ -f "$m.inicio.$i.zip" ] && mv -f "$m.inicio.$i.zip" "$m.inicio.$((i + 1)).zip"
			[ -f "$m.inicio.$i.json" ] && mv -f "$m.inicio.$i.json" "$m.inicio.$((i + 1)).json"
		done
		[ -f "$m.inicio.zip" ] && mv -f "$m.inicio.zip" "$m.inicio.1.zip"
		[ -f "$m.inicio.json" ] && mv -f "$m.inicio.json" "$m.inicio.1.json"
		cp -f "${resume_args[1]}" "$m.inicio.zip"
		[ -f "${resume_args[1]%.zip}.json" ] && cp -f "${resume_args[1]%.zip}.json" "$m.inicio.json" || true
		echo "Copia del modelo antes de seguir: $m.inicio.zip"
	fi
	# El registro de la corrida anterior se agrega al historial antes de que el nuevo lo reemplace
	if [ -s "$RUN/train.log" ]; then { echo; echo "===== $(date '+%F %T') ====="; cat "$RUN/train.log"; } >> "$RUN/historial.log"; fi

	if curl -sf "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1; then
		die "el puerto $PORT ya está en uso (¿otro entrenamiento que sigue en marcha? probá ./entrenar.sh stop o --port)"
	fi
	PORT=$PORT launch "$RUN/server.pid" "$RUN/server.log" node tools/ai/server.js
	for _ in $(seq 1 50); do
		curl -sf "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1 && break
		alive "$RUN/server.pid" || { cat "$RUN/server.log"; die "el servidor no arrancó"; }
		sleep 0.3
	done
	curl -sf "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1 || die "el servidor no contesta en el puerto $PORT"

	launch "$RUN/train.pid" "$RUN/train.log" "$PY" -u tools/ai/train.py train --worlds "$WORLDS" --steps "$STEPS" --envs "$ENVS" \
		--out "$RUN/modelos/$NAME" --url "http://127.0.0.1:$PORT" --goal-shaping "$SHAPING" "${resume_args[@]}"
	printf 'PORT=%q\nWATCH=%q\nSPEED=%q\nNAME=%q\nWORLDS=%q\nSTEPS=%q\nENVS=%q\nSHAPING=%q\n' "$PORT" "$WATCH" "$SPEED" "$NAME" "$WORLDS" "$STEPS" "$ENVS" "$SHAPING" > "$RUN/settings"

	if [ ${#resume_args[@]} -gt 0 ]; then echo "Continuando desde ${resume_args[1]}."; else echo "Empezando de cero."; fi
	echo "Entrenando en $WORLDS ($STEPS pasos más, $ENVS partidas en paralelo)."
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

cmd_exportar() {
	local src="${1:-$RUN/modelos/$NAME.zip}"
	[ -f "$src" ] || src="$RUN/modelos/${1%.zip}.zip"
	[ -f "$src" ] || die "no encuentro el modelo a exportar"
	"$PY" -c "import stable_baselines3" 2>/dev/null || die "faltan PyTorch y Stable-Baselines3: corré ./entrenar.sh setup"
	local py="$PY"; case "$py" in /*) ;; */*) py="$PWD/$py" ;; esac   # el Python con ruta relativa deja de servir al cambiar de carpeta
	local abs="$PWD/$src"; [ -f "$src" ] && case "$src" in /*) abs="$src" ;; esac
	(cd tools/ai && "$py" export_model.py "$abs" ../../assets/ia) || die "no se pudo exportar"
	echo "Listo: el título del juego va a usar este modelo (recargá la página). Para subirlo al repositorio: git add assets/ia"
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
	exportar) shift; cmd_exportar "$@" ;;
	watch) cmd_watch ;;
	*) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 1 ;;
esac
