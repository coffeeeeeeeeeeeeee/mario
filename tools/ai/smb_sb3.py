"""Entorno vectorial de Stable-Baselines3 sobre el servidor de tools/ai/server.js: las n partidas avanzan juntas, en paralelo,
con un solo pedido HTTP por paso. Necesita gymnasium, numpy y stable-baselines3.

La observación es un vector: la grilla de celdas alrededor de Mario en one-hot (5 clases x 13 x 16), su estado (velocidad,
si está en el suelo, tamaño, hacia dónde mira, altura) y los 6 enemigos más cercanos (posición relativa y tamaño).
Con memoria (lo normal en los modelos nuevos) se le suman 19 números que resumen lo que pasó en los últimos pasos: la última acción
que eligió, hace cuánto no avanza, cuánto retrocedió respecto de lo más lejos que llegó y cuánto se movió en los últimos 8 y 32 pasos
(clase Memory). Sin eso la red no puede darse cuenta de que lleva rato empujando contra lo mismo y que le conviene retroceder.
Los episodios se cortan (truncados) a los `max_steps` pasos o si Mario no avanza en `stuck_steps`; al terminar uno, la partida
arranca de nuevo en un nivel sorteado entre `worlds`.
"""
import random

import numpy as np
import gymnasium as gym
from stable_baselines3.common.vec_env import VecEnv

from smb_env import GRID_COLS, SmbClient, SmbVecClient

N_ENEMIES = 6
BASE_DIM = 5 * 13 * GRID_COLS + 8 + N_ENEMIES * 4
N_ACTIONS = 14
MEM_DIM = N_ACTIONS + 5
OBS_DIM = BASE_DIM + MEM_DIM
_EYE = np.eye(5, dtype=np.float32)


class Memory:
    """Lo que la red recuerda de un episodio. Se actualiza en cada paso con la acción que se acaba de elegir y la posición en que
    quedó Mario (la x de la observación, ya redondeada); ia.js tiene la misma cuenta (SmbIA.newMemory) y check_ia.py comprueba que
    coincidan. Al cambiar de nivel (una zona de atajos, el laberinto) se olvida la posición, no la última acción."""
    HIST = 33   # posiciones guardadas: la actual y las 32 anteriores

    def __init__(self, x, world):
        self.prev = None
        self.reset_position(x, world)

    def reset_position(self, x, world):
        self.world, self.best, self.since, self.hist = world, x, 0, [x]

    def update(self, action, x, world):
        self.prev = action
        if world != self.world:
            self.reset_position(x, world)
            return
        self.hist.append(x)
        del self.hist[:-self.HIST]
        if x > self.best + 0.5:
            self.best, self.since = x, 0
        else:
            self.since += 1

    def features(self):
        out = np.zeros(MEM_DIM, dtype=np.float32)
        if self.prev is not None:
            out[self.prev] = 1
        x, h = self.hist[-1], self.hist
        out[N_ACTIONS:] = (min(self.since / 32, 1), min(self.since / 200, 1), min(max((self.best - x) / 64, 0), 2),
                           min(max((x - h[max(0, len(h) - 9)]) / 32, -2), 2), min(max((x - h[max(0, len(h) - 33)]) / 64, -2), 2))
        return out


def featurize(o):
    m = o["m"]
    grid = _EYE[(np.frombuffer(o["g"].encode(), dtype=np.uint8) - 48).reshape(13, GRID_COLS)]   # (13, 16, 5)
    mario = np.array([m[4] / 4, m[5] / 4, m[6], m[7] == 1, m[7] == 2, m[8], m[1] / 240, m[3] / 32], dtype=np.float32)
    cx, cy = m[0] + m[2] / 2, m[1] + m[3] / 2
    near = sorted(o["e"], key=lambda e: abs(e[2] + e[4] / 2 - cx))[:N_ENEMIES]
    enemies = np.zeros((N_ENEMIES, 4), dtype=np.float32)
    for i, e in enumerate(near):
        enemies[i] = ((e[2] + e[4] / 2 - cx) / 128, (e[3] + e[5] / 2 - cy) / 128, e[4] / 16, 1)
    return np.concatenate([grid.transpose(2, 0, 1).ravel(), mario, enemies.ravel()])


class SmbSb3VecEnv(VecEnv):
    def __init__(self, n_envs, worlds=("1-1",), url="http://127.0.0.1:8777", repeat=4, max_steps=2500, stuck_steps=200,
                 size="small", hard=False, seed=0, reward_scale=0.1, goal_shaping=0.5, memory=True, progress_reward="best", mid_start=0.0):
        self.client = SmbVecClient(n_envs, url, worlds=worlds, size=size, hard=hard, seed=seed, repeat=repeat, autoreset=False, obs="compact", shaping=goal_shaping, reward=progress_reward)
        n_actions = len(SmbClient(url).actions)
        super().__init__(n_envs, gym.spaces.Box(-np.inf, np.inf, shape=(OBS_DIM if memory else BASE_DIM,), dtype=np.float32), gym.spaces.Discrete(n_actions))
        self.worlds, self.max_steps, self.stuck_steps, self.reward_scale = list(worlds), max_steps, stuck_steps, reward_scale
        self.rng = random.Random(seed)
        self.seed_counter = seed * 100003
        self.size, self.hard, self.memory = size, hard, memory
        self.mid_start = mid_start   # fracción de los episodios que empiezan en el medio del nivel (sólo al entrenar)
        self.mem = [None] * n_envs
        self._actions = None
        self._begin()

    def _begin(self):
        self.world = [None] * self.num_envs
        self.recent = []   # los últimos niveles sorteados
        self.steps = [0] * self.num_envs
        self.best_x = [0.0] * self.num_envs
        self.start_x = [0.0] * self.num_envs   # x de donde empezó el episodio (0 si fue desde el principio): el avance se mide desde ahí
        self.last_gain = [0] * self.num_envs
        self.ret = [0.0] * self.num_envs

    def _pick_world(self, i):
        """Sortea un nivel, evitando los que ya están jugando las otras partidas mientras haya otros: así los lotes de
        entrenamiento (y la vista en vivo) muestran un surtido de niveles y no el mismo en todas."""
        in_use = {w for j, w in enumerate(self.world) if j != i and w is not None}
        # También se evitan los de los últimos episodios: la vista en vivo repite las partidas con un poco de retraso, y así
        # tampoco coinciden dos niveles iguales ahí
        blocked = in_use | set(self.recent)
        free = [w for w in self.worlds if w not in blocked] or [w for w in self.worlds if w not in in_use]
        w = self.rng.choice(free or self.worlds)
        self.recent.append(w)
        del self.recent[:max(0, len(self.recent) - min(len(self.worlds) - 1, 2 * self.num_envs))]
        return w

    def _start(self, i):
        self.seed_counter += 1
        self.world[i] = self._pick_world(i)
        self.steps[i], self.best_x[i], self.last_gain[i], self.ret[i] = 0, 0.0, 0, 0.0
        mid = self.mid_start > 0 and self.rng.random() < self.mid_start
        o = self.client.reset_one(i, self.world[i], seed=self.seed_counter, start_frac=self.rng.uniform(0.1, 0.9) if mid else None)
        # Si no encontró un lugar para empezar en el medio (castillos, algunos niveles de agua) arranca desde el principio
        self.start_x[i] = o["m"][0] if mid and o["m"][0] > 80 else 0.0
        return self._features(i, o, None)

    def _features(self, i, o, action):
        """Las entradas de la red para la partida i: la observación y, si el modelo tiene memoria, lo que recuerda (se actualiza
        con la acción elegida, o con None al empezar el episodio)."""
        f = featurize(o)
        if not self.memory:
            return f
        if action is None:
            self.mem[i] = Memory(o["m"][0], o["w"])
        else:
            self.mem[i].update(action, o["m"][0], o["w"])
        return np.concatenate([f, self.mem[i].features()])

    def reset(self):
        self._begin()
        return np.stack([self._start(i) for i in range(self.num_envs)])

    def step_async(self, actions):
        self._actions = actions

    def step_wait(self):
        obs, rewards, dones, infos = self.client.step([int(a) for a in self._actions])
        feats, out_r, out_d, out_i = [], [], [], []
        for i in range(self.num_envs):
            info, done = dict(infos[i]), bool(dones[i])
            self.steps[i] += 1
            self.ret[i] += rewards[i]
            if info["x"] > self.best_x[i] + 0.5:
                self.best_x[i], self.last_gain[i] = info["x"], self.steps[i]
            truncated = not done and (self.steps[i] >= self.max_steps or self.steps[i] - self.last_gain[i] >= self.stuck_steps)
            f = self._features(i, obs[i], int(self._actions[i]))
            if done or truncated:
                info["terminal_observation"] = f
                info["TimeLimit.truncated"] = truncated
                info["episode"] = {"r": self.ret[i], "l": self.steps[i], "world": self.world[i], "clear": info.get("reason") == "clear",
                                   "progress": min(1.0, max(0.0, self.best_x[i] - self.start_x[i]) / max(1, info.get("width", 1) - self.start_x[i]))}
                f = self._start(i)
            feats.append(f)
            out_r.append(rewards[i] * self.reward_scale)
            out_d.append(done or truncated)
            out_i.append(info)
        return np.stack(feats), np.array(out_r, dtype=np.float32), np.array(out_d), out_i

    def close(self):
        pass

    def get_attr(self, attr_name, indices=None):
        return [getattr(self, attr_name, None)] * len(self._get_indices(indices))

    def set_attr(self, attr_name, value, indices=None):
        pass

    def env_method(self, method_name, *args, indices=None, **kwargs):
        return [None] * len(self._get_indices(indices))

    def env_is_wrapped(self, wrapper_class, indices=None):
        return [False] * len(self._get_indices(indices))

    def seed(self, seed=None):
        return [seed] * self.num_envs
