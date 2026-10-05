"""Entrena y evalúa un agente PPO (Stable-Baselines3) sobre el servidor de tools/ai/server.js, que tiene que estar corriendo.

    python3 train.py train --worlds 1-1,2-1,3-1 --steps 2000000 --out modelo      # sin --worlds, todos los niveles
    python3 train.py eval  --model modelo --worlds 1-1,2-1,3-1,4-1 --episodes 10
    python3 train.py worlds                      # lista los niveles y sus tipos

--worlds acepta nombres (1-1), comodines (1-*, *-4), grupos (todos, exterior, subterraneo, agua, castillo) y, con un - delante, los
que se sacan: "todos,-8-4" entrena en todos menos el 8-4; "todos,-5-*,-6-*" deja para evaluar los mundos 5 y 6.

Cada paso del agente son 4 cuadros del juego. Al entrenar se imprime cada tanto el avance medio (la parte del nivel recorrida)
y cuántos episodios terminaron en el mástil; al evaluar, lo mismo por nivel. Para ver si aprendió a jugar "en general" hay que
evaluar en niveles que no estuvieron en --worlds del entrenamiento.
"""
import argparse
import collections
import json
import urllib.request
import os
import signal
import sys
import time

if sys.argv[1:2] == ["worlds"]:   # listar los niveles no necesita PyTorch: se resuelve antes de importarlo
    from smb_env import SmbClient
    url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:8777"
    for l in SmbClient(url).levels:
        print(f"{l['name']:<5} {l['type']:<11} {l['width'] // 16:>4} celdas")
    sys.exit(0)

import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

from smb_env import SmbClient, resolve_worlds
from smb_sb3 import BASE_DIM, OBS_DIM, SmbSb3VecEnv


class Progress(BaseCallback):
    """Resumen de los últimos episodios cada `every` pasos."""

    def __init__(self, every=20000, save_path=None, save_every=0, offset=0, url=None, info=None):
        super().__init__()
        self.url, self.info, self.last_save = url, info or {}, None   # url: dónde mandar los datos de la barra de /watch
        self.offset = offset   # pasos que el modelo ya tenía de antes, para mostrar el total acumulado
        self.every, self.next, self.recent, self.t0 = every, every, collections.deque(maxlen=100), time.time()
        self.save_path, self.save_every, self.next_save = save_path, save_every, save_every
        self.sent = 0.0
        self.stop = False   # lo activa la señal de parada: se termina la pasada actual y se guarda

    def save(self):
        # Se guarda en un archivo temporal y recién entonces reemplaza al anterior: si el proceso se corta justo mientras escribe,
        # queda el modelo de antes completo y no un zip a medias. (Con .zip explícito, SB3 no le cambia el nombre.)
        tmp = self.save_path + "_tmp.zip"
        self.model.save(tmp)
        os.replace(tmp, self.save_path + ".zip")
        # Cuántos pasos lleva el modelo en total, para seguir contando al retomarlo
        self.last_save = {"t": time.time(), "steps": self.offset + self.num_timesteps}
        with open(self.save_path + ".json.tmp", "w") as f:
            json.dump({"steps": self.offset + self.num_timesteps}, f)
        os.replace(self.save_path + ".json.tmp", self.save_path + ".json")

    def _on_rollout_end(self):
        self.report()

    def report(self, force=False):
        """Manda a la barra de /watch cómo va el entrenamiento: pasos, rendimiento, pérdidas y estado del optimizador."""
        if not self.url or (not force and time.time() - self.sent < 1.0):
            return
        self.sent = time.time()
        n = len(self.recent)
        v = self.model.logger.name_to_value   # lo último que registró PPO al actualizar la red
        opt = self.model.policy.optimizer
        st = list(opt.state.values())
        mean = lambda xs: sum(xs) / len(xs) if xs else None
        stats = {
            "t": time.time(), "run_steps": self.num_timesteps, "total_steps": self.offset + self.num_timesteps,
            "sps": self.num_timesteps / max(1e-9, time.time() - self.t0), "elapsed": time.time() - self.t0, **self.info,
            "episodes": n,
            "progress": 100 * sum(e["progress"] for e in self.recent) / n if n else None,
            "clear": 100 * sum(e["clear"] for e in self.recent) / n if n else None,
            "reward": sum(e["r"] for e in self.recent) / n if n else None,
            "ep_len": sum(e["l"] for e in self.recent) / n if n else None,
            "train": {k.split("/")[-1]: float(x) for k, x in v.items() if k.startswith("train/")},
            "optimizer": {
                "name": type(opt).__name__, "lr": opt.param_groups[0]["lr"], "betas": list(opt.param_groups[0].get("betas", [])),
                "step": int(float(st[0]["step"])) if st else 0,
                "momentum": mean([float(s["exp_avg"].abs().mean()) for s in st]),       # |m| medio de Adam (la dirección acumulada)
                "variance": mean([float(s["exp_avg_sq"].mean()) for s in st]),          # v medio de Adam (el tamaño típico del gradiente al cuadrado)
                "tensors": len(st),
            },
            "last_save": self.last_save,
        }
        try:
            req = urllib.request.Request(self.url.rstrip("/") + "/api/stats", data=json.dumps(stats).encode(), headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=1).read()
        except Exception:
            pass   # si el servidor no contesta, el entrenamiento sigue igual

    def _on_step(self):
        if self.stop:
            return False
        if self.save_every and self.num_timesteps >= self.next_save:
            self.next_save += self.save_every
            self.save()
        for info in self.locals["infos"]:
            if "episode" in info:
                self.recent.append(info["episode"])
        if self.num_timesteps >= self.next and self.recent:
            self.next += self.every
            n = len(self.recent)
            print(f"{self.offset + self.num_timesteps:>9} pasos | {self.num_timesteps / (time.time() - self.t0):>5.0f} pasos/s | "
                  f"avance medio {100 * sum(e['progress'] for e in self.recent) / n:4.1f}% | "
                  f"mástil {100 * sum(e['clear'] for e in self.recent) / n:4.1f}% | recompensa {sum(e['r'] for e in self.recent) / n:6.1f} "
                  f"(últimos {n} episodios)", flush=True)
        return True


def has_memory(a, path):
    """Si el entorno tiene que darle memoria a la red: la de un modelo guardado se ve por cuántas entradas tiene (así se puede seguir
    entrenando, o evaluar, uno de antes de que existiera); un modelo nuevo la tiene salvo que se pida --memory no."""
    if path:
        dim = PPO.load(path, device="cpu").observation_space.shape[0]
        if dim not in (BASE_DIM, OBS_DIM):
            raise SystemExit(f"{path} espera {dim} entradas y el entorno arma {BASE_DIM} (sin memoria) o {OBS_DIM} (con memoria)")
        if a.memory != "auto" and (a.memory == "si") != (dim == OBS_DIM):
            raise SystemExit(f"{path} {'tiene' if dim == OBS_DIM else 'no tiene'} memoria y se pidió --memory {a.memory}: para cambiarlo hay que entrenar un modelo nuevo (otro --name o --nuevo)")
        return dim == OBS_DIM
    return a.memory != "no"


def train(a):
    torch.set_num_threads(a.threads)
    worlds = resolve_worlds(a.worlds, SmbClient(a.url).levels)
    if a.seed is None:   # al retomar, otra semilla: si no, el agente vería otra vez los mismos primeros episodios
        a.seed = int(time.time()) % 100000 if a.resume else 0
    print(f"entrenando en {len(worlds)} nivel{'es' if len(worlds) > 1 else ''}: {' '.join(worlds)}", flush=True)
    memory = has_memory(a, a.resume)
    print("con memoria (últimas acciones y avance)" if memory else "SIN memoria (modelo de antes; para tenerla hay que empezar un modelo nuevo)", flush=True)
    env = SmbSb3VecEnv(a.envs, worlds=worlds, url=a.url, seed=a.seed, goal_shaping=a.goal_shaping, memory=memory)
    model = PPO("MlpPolicy", env, learning_rate=lambda f: a.lr * f, n_steps=128, batch_size=256, n_epochs=4, gamma=0.995,
                gae_lambda=0.95, clip_range=0.2, ent_coef=0.01, seed=a.seed, verbose=0,
                policy_kwargs=dict(net_arch=dict(pi=[256, 128], vf=[256, 128])))
    if a.resume:
        model.set_parameters(a.resume)
    done_before = 0
    if a.resume:
        try:
            with open(os.path.splitext(a.resume)[0] + ".json") as f:
                done_before = json.load(f)["steps"]
        except (OSError, KeyError, ValueError):
            pass
        print(f"continuando desde {a.resume} ({done_before} pasos acumulados)", flush=True)
    progress = Progress(save_path=a.out, save_every=a.save_every, offset=done_before, url=a.url,
                        info={"memory": memory, "target_steps": a.steps, "envs": a.envs, "worlds": len(worlds), "shaping": a.goal_shaping, "resumed_from": done_before})
    # Con TERM o INT (por ejemplo, ./entrenar.sh stop) se corta y se guarda lo aprendido hasta ahí
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: setattr(progress, "stop", True))
    model.learn(a.steps, callback=progress, progress_bar=False)
    progress.save()
    print(("detenido, " if progress.stop else "") + f"guardado en {a.out}.zip ({progress.offset + model.num_timesteps} pasos acumulados)", flush=True)


def evaluate(a):
    worlds = resolve_worlds(a.worlds, SmbClient(a.url).levels)
    model = PPO.load(a.model, device="cpu")
    n = min(a.envs, len(worlds) * a.episodes)
    env = SmbSb3VecEnv(n, worlds=worlds, url=a.url, seed=(a.seed or 0) + 7, max_steps=a.max_steps, memory=has_memory(a, a.model if os.path.exists(a.model) else a.model + ".zip"))
    results = collections.defaultdict(list)
    obs = env.reset()
    target = len(worlds) * a.episodes
    while sum(map(len, results.values())) < target:
        actions, _ = model.predict(obs, deterministic=a.deterministic)
        obs, _, _, infos = env.step(actions)
        for info in infos:
            ep = info.get("episode")
            if ep and len(results[ep["world"]]) < a.episodes:
                results[ep["world"]].append(ep)
    print(f"{'nivel':<6} {'episodios':>9} {'avance':>7} {'mástil':>7}")
    for w in worlds:
        r = results[w]
        if r:
            print(f"{w:<6} {len(r):>9} {100 * sum(e['progress'] for e in r) / len(r):>6.1f}% {100 * sum(e['clear'] for e in r) / len(r):>6.1f}%")
    allr = [e for r in results.values() for e in r]
    print(f"{'todos':<6} {len(allr):>9} {100 * sum(e['progress'] for e in allr) / len(allr):>6.1f}% {100 * sum(e['clear'] for e in allr) / len(allr):>6.1f}%")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=["train", "eval"])
    p.add_argument("--worlds", default="todos")
    p.add_argument("--steps", type=int, default=1_000_000)
    p.add_argument("--envs", type=int, default=8)
    p.add_argument("--out", default="modelo")
    p.add_argument("--model", default="modelo")
    p.add_argument("--resume", default=None, help="continuar desde un modelo guardado")
    p.add_argument("--save-every", type=int, default=50000, help="guardar el modelo cada tantos pasos (0: sólo al final)")
    p.add_argument("--episodes", type=int, default=10)
    p.add_argument("--max-steps", type=int, default=2500)
    p.add_argument("--deterministic", action="store_true")
    p.add_argument("--lr", type=float, default=2.5e-4)
    p.add_argument("--goal-shaping", type=float, default=0.5, help="peso de la recompensa por acercarse a la meta; 0 la apaga")
    p.add_argument("--memory", choices=["auto", "si", "no"], default="auto", help="darle a la red memoria de los últimos pasos (auto: la de un modelo que se retoma; si es nuevo, sí)")
    p.add_argument("--threads", type=int, default=2)
    p.add_argument("--seed", type=int, default=None, help="semilla (si se retoma un modelo, por defecto una distinta cada vez)")
    p.add_argument("--url", default="http://127.0.0.1:8777")
    args = p.parse_args()
    train(args) if args.mode == "train" else evaluate(args)
