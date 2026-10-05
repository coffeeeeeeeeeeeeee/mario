Play at -> https://mario-a9z.pages.dev/

## Controles

Las flechas y `W` `A` `S` `D` hacen lo mismo.

| Tecla | En el juego | En los menús |
|---|---|---|
| Izquierda / Derecha | Caminar | Elegir nivel (título) o cambiar un valor (ajustes) |
| Arriba | Saltar (o nadar) | Subir en el menú |
| Abajo | Agacharse y entrar a un caño | Bajar en el menú |
| `Shift` | Correr | |
| `Espacio` o `Ctrl` | Bola de fuego | Confirmar |
| `Enter` | Pausar y retomar | Confirmar |
| `P` | Salir al menú y guardar la partida (se retoma con CONTINUE) | |
| `Esc` | Salir al menú sin guardar | Volver |
| `E` | Editor de niveles | |

Si en el título no se toca nada durante unos 8 segundos, arranca un demo en el que juega la IA (ver más abajo); cualquier tecla o clic lo corta.

En el editor: flechas para mover la vista, rueda del ratón para elegir el bloque, clic izquierdo para colocar y clic derecho para borrar.

En celulares y tablets aparecen una palanca (mover), un botón A (saltar) y un botón B (bola de fuego).

## Herramientas

Los niveles y los gráficos se generan con las herramientas de `tools/` y se versionan ya generados (`levels_smb.js`, `atlas.js`). Ver [`tools/README.md`](tools/README.md).

## API para agentes (IA)

Con `index.html?api` el juego no corre solo: un agente lo maneja con `window.smbApi` (`api.js`), cuadro a cuadro y de forma determinista (mismo nivel, misma semilla y mismas acciones dan siempre lo mismo), sin sonido y más rápido que el tiempo real. Para usarlo desde otro programa hay un servidor local y un cliente en Python (`tools/ai`):

```
cd tools/ai
node server.js                 # sin navegador: el juego corre en hilos de Node, unos 14.000 cuadros por segundo por hilo
node server.js --browser       # en un Chrome sin ventana (hace falta "npm install"); más lento, pero da imágenes
python3 random_agent.py 1-1    # agente de ejemplo (sólo biblioteca estándar)
```

```python
from smb_env import SmbClient, SmbVecClient
env = SmbClient()
obs = env.reset(world="1-1", seed=7, size="small")   # size: small, big o fire; hard=True para el modo difícil
obs, reward, done, info = env.step(2, repeat=4)      # acción 2: derecha + salto, durante 4 cuadros

vec = SmbVecClient(8, worlds=("1-1", "1-2", "2-1"))  # 8 partidas en paralelo, cada una en su hilo (observaciones compactas)
obs = vec.reset()
obs, rewards, dones, infos = vec.step([2] * 8)       # la que termina arranca de nuevo sola (info["terminal_obs"] guarda la última)
```

- **Observación:** posición, velocidad y estado de Mario (en px lógicos, 16 px = una celda), una grilla de 13 filas por 16 columnas alrededor de Mario (0 vacío, 1 sólido, 2 bloque golpeable, 3 moneda, 4 meta: el mástil, el hacha o la boca de un caño que lleva a otro nivel), enemigos, plataformas y hongos o flores cercanos. Con `--browser`, `env.pixels()` da el cuadro achicado en grises.
- **Formatos de observación** (`obs=` en `reset` y `step`): `"full"` (la de arriba, lo normal), `"compact"` (lo mismo en arreglos, que pesa menos de la mitad) y `"none"` (sólo recompensa y fin). En `compact`: `m` es `[x, y, ancho, alto, vx, vy, suelo, tamaño (0 chico, 1 grande, 2 fuego), mira a, banderas]`, `g` la grilla como texto de 13 x 16 dígitos fila por fila, `e` los enemigos `[tipo, color, x, y, ancho, alto, dir, estado]`, `p` las plataformas, `u` los hongos y flores, y además `w` nivel, `f` cuadro, `t` tiempo, `s` puntos, `c` monedas, `l` vidas. `compact_grid` y `compact_mario` de `smb_env.py` los decodifican.
- **Acciones:** 14 combinaciones predefinidas (`env.actions`), o una lista de botones (`left`, `right`, `down`, `jump`, `run`, `fire`).
- **Recompensa:** lo que avanza Mario en x, menos una pequeña penalidad por el reloj del juego, -15 al morir y +50 al completar el nivel. Opcionalmente (`shaping=` en `reset`, `--shaping` en `entrenar.sh`, 0,5 por defecto al entrenar) se suma el peso por lo que se acerca Mario, en x e y, a la meta más cercana (mástil, hacha o boca de caño de salida), lo que debería ayudar donde hay que alinearse con la meta, como en los caños de los niveles de agua. En `info` vienen los datos crudos (`x`, `shaping`, `goal_distance`...) para armar otra.
- **Fin del episodio:** `done` al morir (también por tiempo), al completar el nivel o al salirse por el final del mapa (nadando); `info["reason"]` dice cuál: `dead`, `clear` u `out`. Se completa un nivel al tomar el mástil o el hacha, y también al entrar a un caño que lleva a otro de los 32 niveles (el del final de 1-2, 2-2 y 7-2, las zonas de atajos), en el momento en que Mario se mete; entrar a una sala secreta, o volver de ella, no cuenta. Esas metas se ven en la grilla con el valor 4. Los saltos de más de 48 px en un paso (el laberinto que devuelve a Mario, un caño) no suman ni restan recompensa.
- **Velocidad:** con 8 partidas en paralelo por HTTP salen unos 8.000 cuadros por segundo con `full`, 14.000 con `compact` y 21.000 con `none` (hasta unas 350 veces el tiempo real), medidos en una máquina de 8 núcleos; `vector_demo.py` los mide.
- El modo sin navegador da exactamente lo mismo que el navegador, cuadro por cuadro. `node tools/ai/check.js` lo comprueba en los 32 niveles; conviene correrlo después de tocar `mario.js`.
- Con Gymnasium y NumPy instalados, `smb_env.SuperMarioEnv` ofrece la interfaz estándar `reset/step` y puede sortear niveles en cada episodio.

### Entrenar una IA y verla jugar

`entrenar.sh` arranca el servidor y el entrenamiento (PPO, de Stable-Baselines3) y abre en el navegador una vista en vivo con las partidas:

```
./entrenar.sh setup                                   # una vez: instala PyTorch (CPU) y Stable-Baselines3 en tools/ai/.venv (~1 GB)
./entrenar.sh start                                    # entrena en los 32 niveles y abre http://127.0.0.1:8777/watch
./entrenar.sh start --worlds 1-1,2-1 --steps 2000000  # o sólo en algunos
./entrenar.sh status | logs | watch                   # cómo viene, seguir el registro, volver a abrir la vista
./entrenar.sh stop                                    # detiene todo y guarda el modelo en .entrenamiento/modelos/
```

Si ya hay un modelo guardado, `start` lo continúa (con los mismos niveles y opciones de la vez anterior, y contando los pasos acumulados) en vez de empezar de cero; para empezar de cero está `--nuevo`, que guarda una copia del modelo viejo. Cada partida toma un nivel distinto de los que están en juego, así que la vista muestra un surtido (`--watch 6` por defecto).

**Memoria de la red.** Los modelos nuevos reciben, además de lo que ven (1072 números), 19 que resumen lo que pasó en los últimos pasos: la última acción elegida, hace cuánto no avanza, cuánto retrocedió respecto de lo más lejos que llegó y cuánto se movió en los últimos 8 y 32 pasos (`Memory` en `tools/ai/smb_sb3.py`, y lo mismo en `ia.js`). Sin eso la red no se da cuenta de que lleva rato empujando contra lo mismo y que le conviene retroceder para tomar carrera. Un modelo de antes (1072 entradas) sigue funcionando y se puede seguir entrenando sin memoria; para tenerla hay que empezar un modelo nuevo (`./entrenar.sh start --name memoria`, o `--nuevo`). `train.py` lo detecta solo por el tamaño de la entrada del modelo, y `--memory si|no` fuerza lo que se quiere para los nuevos.

`--worlds` acepta los 32 niveles: nombres (`1-1`), comodines (`1-*`, `*-4`), grupos (`todos`, `exterior`, `subterraneo`, `agua`, `castillo`) y, con un `-` delante, los que se sacan. Por ejemplo `--worlds "todos,-5-*,-6-*"` entrena en todos menos los mundos 5 y 6, que quedan para evaluar si lo aprendido sirve en niveles nuevos (`python3 tools/ai/train.py worlds` los lista con su tipo).

La vista (`/watch`) deja elegir arriba cuántas pantallas ver a la vez (1, 2, 4, 6, 8 o 16) y la velocidad (×1 a ×8); `--watch N` fija la cantidad con que abre. Sólo hay datos para tantas pantallas como partidas tenga el entrenamiento (`--envs`, 8 por defecto): para ver 16 hay que entrenar con `--envs 16`, y las que sobren avisan que no tienen partida. La vista repite en el navegador las partidas que juega el agente: el servidor guarda cómo arrancó cada episodio y sus acciones, y como el juego es determinista sale exactamente lo mismo, con un pequeño retraso; al terminar un episodio salta al más nuevo. Arriba de cada partida se ve qué episodio es y si la repetición coincidió con la del entrenamiento. `python3 tools/ai/train.py eval --model modelo --worlds 1-1,2-1,3-1` mide cuánto avanza un modelo por nivel; para ver si aprendió a jugar en general hay que evaluar en niveles que no estuvieron en el entrenamiento.

### La IA juega sola en el título

Si el título pasa unos 8 segundos sin que nadie toque nada, arranca solo un demo en el que juega la IA entrenada, en uno de los 32 niveles (cartel "IA JUGANDO 4-4  7/32"); al terminar uno, vuelve al título y empieza otro. Los niveles salen de un mazo mezclado: no se repite ninguno hasta haber pasado los 32, y el mazo se recuerda en el navegador aunque se recargue la página. El demo se corta si Mario muere, llega a la meta, pasa 12 segundos sin avanzar o dura más de 2 minutos y medio, y cualquier tecla, clic o toque lo interrumpe.

La red corre dentro del navegador (`ia.js`) con los pesos de `assets/ia/modelo.js` (1,6 MB), un script y no un archivo aparte para que funcione también abriendo el `index.html` directo desde la carpeta (`file://`), donde el navegador no deja leer archivos con `fetch`; si faltan o fallan, el título avisa en la consola y usa un demo grabado en el 1-1. Para usar un modelo nuevo: `./entrenar.sh exportar` (toma el modelo que se está entrenando; recargá la página después). `python3 tools/ai/check_ia.py` comprueba que lo que calcula el navegador coincide con el entrenamiento (las entradas de la red salen idénticas y las salidas difieren en el orden de 1e-7); conviene correrlo si se toca la observación.

### Publicar en itch.io

`tools/empaquetar-itch.sh` arma el zip HTML5 con lo que el juego necesita para correr, incluida la IA del título (`assets/ia/modelo.js`), y lo guarda fuera del proyecto, en `../mario-itch.zip`. Se corta si la lista llegara a incluir algo que no deba publicarse (`tools/`, `.git`, `.entrenamiento` y archivos que no son del juego). Los pesos de la IA quedan fijos al exportarlos: si se reentrenó, correr antes `./entrenar.sh exportar`.
