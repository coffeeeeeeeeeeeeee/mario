"""Agente al azar de ejemplo: juega unos episodios y cuenta lo que avanza. Uso: python3 random_agent.py [nivel]"""
import random
import sys
import time

from smb_env import SmbClient

world = sys.argv[1] if len(sys.argv) > 1 else "1-1"
env = SmbClient()
rng = random.Random(1)
for ep in range(3):
    obs = env.reset(world=world, seed=ep)
    total, steps, t0 = 0.0, 0, time.time()
    done, info = False, {}
    while not done and steps < 1500:
        # Sesgado a la derecha: ir con salto o sin él, a veces corriendo
        action = rng.choice([1, 2, 2, 3, 4, 4, 4, 5, 0])
        obs, reward, done, info = env.step(action, repeat=4)
        total += reward
        steps += 1
    print(f"episodio {ep}: {steps} pasos ({steps * 4} cuadros) en {time.time() - t0:.1f} s, "
          f"x final {info.get('x', 0):.0f}, recompensa {total:.0f}, fin: {info.get('reason')}")
