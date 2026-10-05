"""Cliente en Python del servidor de tools/ai/server.js (sólo biblioteca estándar).

    from smb_env import SmbClient
    env = SmbClient()
    obs = env.reset(world="1-1", seed=7)
    obs, reward, done, info = env.step(2, repeat=4)      # acción 2: derecha + salto

Para entrenar con muchas partidas a la vez (cada una en su hilo, en paralelo) está `SmbVecClient`. Si Gymnasium y NumPy están
instalados, también hay `SuperMarioEnv`, con la interfaz estándar reset/step.
Las posiciones van en píxeles del NES (16 px = una celda). La grilla (`obs["grid"]["cells"]`) tiene 13 filas, de la
2 a la 14 del mapa, y 16 columnas alrededor de Mario; vale 0 vacío, 1 sólido, 2 bloque golpeable, 3 moneda, 4 meta (mástil, hacha o boca del caño de salida).

Con obs="compact" la observación viene en arreglos (mucho más liviana, ver el README) y con obs="none" no viene ninguna.
`compact_grid(obs)` devuelve su grilla como lista de filas de texto, y `compact_mario(obs)` el estado de Mario como diccionario.
"""
import fnmatch
import http.client
import json
import urllib.parse


TIPOS = {"exterior": "overworld", "subterraneo": "underground", "agua": "water", "castillo": "castle"}


def resolve_worlds(spec, levels):
    """Elige niveles con una lista separada por comas: nombres (1-1), comodines (1-*, *-4), grupos (todos, exterior, subterraneo,
    agua, castillo) y, con un - delante, los que se sacan (todos,-8-4 o 1-*,-1-4). `levels` es la lista de /api/info."""
    names = [l["name"] for l in levels]
    chosen = []
    for tok in (t.strip() for t in spec.split(",")):
        if not tok:
            continue
        neg, t = tok[0] in "-!", tok.lstrip("-!")
        if t == "todos":
            found = names
        elif t in TIPOS:
            found = [l["name"] for l in levels if l["type"] == TIPOS[t]]
        else:
            found = [n for n in names if fnmatch.fnmatchcase(n, t)]
        if not found:
            raise ValueError(f"no hay niveles que coincidan con '{tok}' (hay {names[0]} a {names[-1]}; grupos: todos, {', '.join(TIPOS)})")
        chosen = [n for n in chosen if n not in found] if neg else chosen + [n for n in found if n not in chosen]
    if not chosen:
        raise ValueError("no quedó ningún nivel")
    return chosen


GRID_COLS = 16   # 5 columnas a la izquierda de Mario, la suya y 10 a la derecha


def compact_grid(obs, cols=GRID_COLS):
    g = obs["g"]
    return [g[i:i + cols] for i in range(0, len(g), cols)]


def compact_mario(obs):
    x, y, w, h, vx, vy, ground, size, facing, flags = obs["m"]
    return {"x": x, "y": y, "w": w, "h": h, "vx": vx, "vy": vy, "onGround": bool(ground), "size": ("small", "big", "fire")[size],
            "facing": facing, "climbing": bool(flags & 1), "water": bool(flags & 2), "star": bool(flags & 4)}


class _Http:
    """Conexión persistente: abrir una por pedido le cuesta más que correr el paso del juego."""

    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.host, self.port = u.hostname, u.port or 80
        self.conn = None

    def request(self, path, body=None):
        for attempt in (0, 1):
            try:
                if self.conn is None:
                    self.conn = http.client.HTTPConnection(self.host, self.port, timeout=120)
                if body is None:
                    self.conn.request("GET", path)
                else:
                    self.conn.request("POST", path, json.dumps(body), {"Content-Type": "application/json"})
                out = json.loads(self.conn.getresponse().read())
                break
            except (http.client.HTTPException, ConnectionError):
                self.conn = None   # el servidor cerró la conexión: se reintenta una vez con una nueva
                if attempt:
                    raise
        if isinstance(out, dict) and "error" in out:
            raise RuntimeError(out["error"])
        return out


class SmbVecClient:
    """n partidas en paralelo. Con autoreset (lo normal), la partida que termina arranca de nuevo sola: la observación que
    devuelve es la del nuevo comienzo y la última de la anterior queda en info["terminal_obs"]."""

    def __init__(self, n, url="http://127.0.0.1:8777", worlds=("1-1",), size="small", hard=False, seed=0, repeat=4, autoreset=True, obs="compact", shaping=0.0, reward="signed"):
        self.n, self.repeat, self.autoreset, self.obs = n, repeat, autoreset, obs
        self.http = _Http(url)
        self.opts = {"n": n, "worlds": list(worlds), "size": size, "hard": hard, "seed": seed, "obs": obs, "shaping": shaping, "reward": reward}

    def reset(self):
        return self.http.request("/api/vreset", self.opts)

    def reset_one(self, i, world="1-1", seed=None, size=None, start_frac=None):
        """Reinicia sólo la partida i (por ejemplo, en otro nivel). start_frac (0 a 1): empezar en esa parte del nivel."""
        body = {"world": world, "size": size or self.opts["size"], "hard": self.opts["hard"], "obs": self.obs, "shaping": self.opts["shaping"],
                "reward": self.opts["reward"], "env": str(i)}
        if seed is not None:
            body["seed"] = seed
        if start_frac:
            body["startFrac"] = start_frac
        return self.http.request("/api/reset", body)

    def step(self, actions):
        out = self.http.request("/api/vstep", {"actions": list(actions), "repeat": self.repeat, "autoreset": self.autoreset, "obs": self.obs})
        return [o["obs"] for o in out], [o["reward"] for o in out], [o["done"] for o in out], [o["info"] for o in out]


class SmbClient:
    def __init__(self, url="http://127.0.0.1:8777", env=0):
        self.http = _Http(url)
        self.env = env
        info = self._get("/api/info")
        self.actions = info["actions"]
        self.worlds = info["worlds"]
        self.levels = info["levels"]   # [{name, type, width}] de los 32 niveles

    def _call(self, path, body=None):
        return self.http.request(path, None if body is None else {**body, "env": self.env})

    def _get(self, path):
        sep = "&" if "?" in path else "?"
        return self.http.request(f"{path}{sep}env={self.env}")

    def reset(self, world="1-1", seed=None, size="small", hard=False, obs="full", shaping=0.0, reward="signed", start_frac=None):
        """shaping: peso de la recompensa por acercarse a la meta (el mástil, el hacha o el caño de salida); 0 la apaga.
        reward: "signed" (suma lo que avanza y resta lo que retrocede) o "best" (sólo suma lo que pasa de lo más lejos que llegó).
        start_frac: empezar en esa fracción (0 a 1) del largo del nivel, en el primer lugar donde Mario puede caer a suelo firme."""
        body = {"world": world, "size": size, "hard": hard, "obs": obs, "shaping": shaping, "reward": reward}
        if start_frac:
            body["startFrac"] = start_frac
        if seed is not None:
            body["seed"] = seed
        return self._call("/api/reset", body)

    def step(self, action=0, repeat=4, obs="full"):
        out = self._call("/api/step", {"action": action, "repeat": repeat, "obs": obs})
        return out["obs"], out["reward"], out["done"], out["info"]

    def observe(self, obs="full"):
        return self._get(f"/api/observe?obs={obs}")

    def pixels(self, width=84, height=84):
        return self._get(f"/api/pixels?w={width}&h={height}")


try:
    import gymnasium as gym
    import numpy as np
except ImportError:
    gym = None

if gym is not None:
    class SuperMarioEnv(gym.Env):
        """Observación: la grilla de celdas (13x16, uint8) y un vector con Mario (x, y, vx, vy, suelo)."""
        metadata = {"render_modes": []}

        def __init__(self, url="http://127.0.0.1:8777", env=0, worlds=("1-1",), repeat=4, max_steps=2000, hard=False):
            self.client = SmbClient(url, env)   # la observación va en modo compact, que pesa mucho menos
            self.worlds, self.repeat, self.max_steps, self.hard = list(worlds), repeat, max_steps, hard
            self.action_space = gym.spaces.Discrete(len(self.client.actions))
            self.observation_space = gym.spaces.Dict({
                "grid": gym.spaces.Box(0, 4, shape=(13, 16), dtype=np.uint8),
                "mario": gym.spaces.Box(-np.inf, np.inf, shape=(5,), dtype=np.float32),
            })
            self.steps = 0

        @staticmethod
        def _obs(o):
            m = o["m"]
            return {"grid": (np.frombuffer(o["g"].encode(), dtype=np.uint8) - 48).reshape(13, GRID_COLS),
                    "mario": np.array([m[0], m[1], m[4], m[5], float(m[6])], dtype=np.float32)}

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            world = self.worlds[int(self.np_random.integers(len(self.worlds)))]
            self.steps = 0
            return self._obs(self.client.reset(world=world, seed=int(self.np_random.integers(1 << 30)), hard=self.hard, obs="compact")), {}

        def step(self, action):
            o, reward, done, info = self.client.step(int(action), self.repeat, obs="compact")
            self.steps += 1
            return self._obs(o), float(reward), bool(done), self.steps >= self.max_steps and not done, info
