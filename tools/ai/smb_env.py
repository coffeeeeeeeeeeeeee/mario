"""Cliente en Python del servidor de tools/ai/server.js (sólo biblioteca estándar).

    from smb_env import SmbClient
    env = SmbClient()
    obs = env.reset(world="1-1", seed=7)
    obs, reward, done, info = env.step(2, repeat=4)      # acción 2: derecha + salto

Para entrenar con muchas partidas a la vez (cada una en su hilo, en paralelo) está `SmbVecClient`. Si Gymnasium y NumPy están
instalados, también hay `SuperMarioEnv`, con la interfaz estándar reset/step.
Las posiciones van en píxeles del NES (16 px = una celda). La grilla (`obs["grid"]["cells"]`) tiene 13 filas, de la
2 a la 14 del mapa, y 16 columnas alrededor de Mario; vale 0 vacío, 1 sólido, 2 bloque golpeable, 3 moneda, 4 mástil.
"""
import http.client
import json
import urllib.parse


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

    def __init__(self, n, url="http://127.0.0.1:8777", worlds=("1-1",), size="small", hard=False, seed=0, repeat=4, autoreset=True):
        self.n, self.repeat, self.autoreset = n, repeat, autoreset
        self.http = _Http(url)
        self.opts = {"n": n, "worlds": list(worlds), "size": size, "hard": hard, "seed": seed}

    def reset(self):
        return self.http.request("/api/vreset", self.opts)

    def step(self, actions):
        out = self.http.request("/api/vstep", {"actions": list(actions), "repeat": self.repeat, "autoreset": self.autoreset})
        return [o["obs"] for o in out], [o["reward"] for o in out], [o["done"] for o in out], [o["info"] for o in out]


class SmbClient:
    def __init__(self, url="http://127.0.0.1:8777", env=0):
        self.http = _Http(url)
        self.env = env
        info = self._get("/api/info")
        self.actions = info["actions"]
        self.worlds = info["worlds"]

    def _call(self, path, body=None):
        return self.http.request(path, None if body is None else {**body, "env": self.env})

    def _get(self, path):
        sep = "&" if "?" in path else "?"
        return self.http.request(f"{path}{sep}env={self.env}")

    def reset(self, world="1-1", seed=None, size="small", hard=False):
        body = {"world": world, "size": size, "hard": hard}
        if seed is not None:
            body["seed"] = seed
        return self._call("/api/reset", body)

    def step(self, action=0, repeat=4):
        out = self._call("/api/step", {"action": action, "repeat": repeat})
        return out["obs"], out["reward"], out["done"], out["info"]

    def observe(self):
        return self._get("/api/observe")

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
            self.client = SmbClient(url, env)
            self.worlds, self.repeat, self.max_steps, self.hard = list(worlds), repeat, max_steps, hard
            self.action_space = gym.spaces.Discrete(len(self.client.actions))
            self.observation_space = gym.spaces.Dict({
                "grid": gym.spaces.Box(0, 4, shape=(13, 16), dtype=np.uint8),
                "mario": gym.spaces.Box(-np.inf, np.inf, shape=(5,), dtype=np.float32),
            })
            self.steps = 0

        @staticmethod
        def _obs(o):
            m = o["mario"]
            return {"grid": np.array(o["grid"]["cells"], dtype=np.uint8),
                    "mario": np.array([m["x"], m["y"], m["vx"], m["vy"], float(m["onGround"])], dtype=np.float32)}

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            world = self.worlds[int(self.np_random.integers(len(self.worlds)))]
            self.steps = 0
            return self._obs(self.client.reset(world=world, seed=int(self.np_random.integers(1 << 30)), hard=self.hard)), {}

        def step(self, action):
            o, reward, done, info = self.client.step(int(action), self.repeat)
            self.steps += 1
            return self._obs(o), float(reward), bool(done), self.steps >= self.max_steps and not done, info
