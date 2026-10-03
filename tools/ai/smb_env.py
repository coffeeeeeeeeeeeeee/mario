"""Cliente en Python del servidor de tools/ai/server.js (sólo biblioteca estándar).

    from smb_env import SmbClient
    env = SmbClient()
    obs = env.reset(world="1-1", seed=7)
    obs, reward, done, info = env.step(2, repeat=4)      # acción 2: derecha + salto

Si Gymnasium y NumPy están instalados, también hay `SuperMarioEnv`, con la interfaz estándar reset/step.
Las posiciones van en píxeles del NES (16 px = una celda). La grilla (`obs["grid"]["cells"]`) tiene 13 filas, de la
2 a la 14 del mapa, y 16 columnas alrededor de Mario; vale 0 vacío, 1 sólido, 2 bloque golpeable, 3 moneda, 4 mástil.
"""
import json
import urllib.request


class SmbClient:
    def __init__(self, url="http://127.0.0.1:8777", env=0):
        self.url = url.rstrip("/")
        self.env = env
        info = self._get("/api/info")
        self.actions = info["actions"]
        self.worlds = info["worlds"]

    def _call(self, path, body=None):
        data = None if body is None else json.dumps({**body, "env": self.env}).encode()
        req = urllib.request.Request(self.url + path, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.loads(r.read())
        if isinstance(out, dict) and "error" in out:
            raise RuntimeError(out["error"])
        return out

    def _get(self, path):
        sep = "&" if "?" in path else "?"
        return self._call(f"{path}{sep}env={self.env}")

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
