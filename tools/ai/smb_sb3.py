"""Entorno vectorial de Stable-Baselines3 sobre el servidor de tools/ai/server.js: las n partidas avanzan juntas, en paralelo,
con un solo pedido HTTP por paso. Necesita gymnasium, numpy y stable-baselines3.

La observación es un vector: la grilla de celdas alrededor de Mario en one-hot (5 clases x 13 x 16), su estado (velocidad,
si está en el suelo, tamaño, hacia dónde mira, altura) y los 6 enemigos más cercanos (posición relativa y tamaño).
Los episodios se cortan (truncados) a los `max_steps` pasos o si Mario no avanza en `stuck_steps`; al terminar uno, la partida
arranca de nuevo en un nivel sorteado entre `worlds`.
"""
import random

import numpy as np
import gymnasium as gym
from stable_baselines3.common.vec_env import VecEnv

from smb_env import GRID_COLS, SmbClient, SmbVecClient

N_ENEMIES = 6
OBS_DIM = 5 * 13 * GRID_COLS + 8 + N_ENEMIES * 4
_EYE = np.eye(5, dtype=np.float32)


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
                 size="small", hard=False, seed=0, reward_scale=0.1, goal_shaping=0.5):
        self.client = SmbVecClient(n_envs, url, worlds=worlds, size=size, hard=hard, seed=seed, repeat=repeat, autoreset=False, obs="compact", shaping=goal_shaping)
        n_actions = len(SmbClient(url).actions)
        super().__init__(n_envs, gym.spaces.Box(-np.inf, np.inf, shape=(OBS_DIM,), dtype=np.float32), gym.spaces.Discrete(n_actions))
        self.worlds, self.max_steps, self.stuck_steps, self.reward_scale = list(worlds), max_steps, stuck_steps, reward_scale
        self.rng = random.Random(seed)
        self.seed_counter = seed * 100003
        self.size, self.hard = size, hard
        self._actions = None
        self._begin()

    def _begin(self):
        self.world = [None] * self.num_envs
        self.recent = []   # los últimos niveles sorteados
        self.steps = [0] * self.num_envs
        self.best_x = [0.0] * self.num_envs
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
        return featurize(self.client.reset_one(i, self.world[i], seed=self.seed_counter))

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
            f = featurize(obs[i])
            if done or truncated:
                info["terminal_observation"] = f
                info["TimeLimit.truncated"] = truncated
                info["episode"] = {"r": self.ret[i], "l": self.steps[i], "world": self.world[i], "clear": info.get("reason") == "clear",
                                   "progress": min(1.0, self.best_x[i] / max(1, info.get("width", 1)))}
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
