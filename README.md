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

Si en el título no se toca nada durante unos 8 segundos, Mario juega solo el 1-1 (demo); cualquier tecla o clic lo corta.

En el editor: flechas para mover la vista, rueda del ratón para elegir el bloque, clic izquierdo para colocar y clic derecho para borrar.

En celulares y tablets aparecen una palanca (mover), un botón A (saltar) y un botón B (bola de fuego).

## Herramientas

Los niveles y los gráficos se generan desde el desensamblado y la ROM del juego original, que no se incluyen en el repo. Ver [`tools/README.md`](tools/README.md).

## API para agentes (IA)

Con `index.html?api` el juego no corre solo: un agente lo maneja con `window.smbApi` (`api.js`), cuadro a cuadro y de forma determinista (mismo nivel, misma semilla y mismas acciones dan siempre lo mismo), sin sonido y más rápido que el tiempo real. Para usarlo desde otro programa hay un servidor local y un cliente en Python (`tools/ai`):

```
cd tools/ai && npm install && node server.js        # abre el juego en un Chrome sin ventana, en http://127.0.0.1:8777
python3 random_agent.py 1-1                          # agente de ejemplo (sólo biblioteca estándar)
```

```python
from smb_env import SmbClient
env = SmbClient()
obs = env.reset(world="1-1", seed=7, size="small")   # size: small, big o fire; hard=True para el modo difícil
obs, reward, done, info = env.step(2, repeat=4)      # acción 2: derecha + salto, durante 4 cuadros
```

- **Observación:** posición, velocidad y estado de Mario (en px del NES, 16 px = una celda), una grilla de 13 filas por 16 columnas alrededor de Mario (0 vacío, 1 sólido, 2 bloque golpeable, 3 moneda, 4 mástil), enemigos, plataformas y hongos o flores cercanos. `env.pixels()` da el cuadro achicado en grises.
- **Acciones:** 14 combinaciones predefinidas (`env.actions`), o una lista de botones (`left`, `right`, `down`, `jump`, `run`, `fire`).
- **Recompensa:** lo que avanza Mario en x, menos una pequeña penalidad por el reloj del juego, -15 al morir y +50 al llegar al mástil. En `info` vienen los datos crudos para armar otra.
- **Fin del episodio:** `done` al morir (también por tiempo) o al tomar el mástil; `info["reason"]` dice cuál (`dead` o `clear`).
- Con Gymnasium y NumPy instalados, `smb_env.SuperMarioEnv` ofrece la interfaz estándar `reset/step` y puede sortear niveles en cada episodio.
