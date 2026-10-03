"""Mide cuántos cuadros por segundo da el servidor con n partidas en paralelo.
Uso: python3 vector_demo.py [n] [pasos] [full|compact|none]"""
import random
import sys
import time

from smb_env import SmbVecClient

n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
mode = sys.argv[3] if len(sys.argv) > 3 else "compact"
env = SmbVecClient(n, worlds=("1-1", "1-2", "2-1", "3-1"), repeat=4, obs=mode)
env.reset()
rng = random.Random(0)
steps = int(sys.argv[2]) if len(sys.argv) > 2 else 200
deaths, t0 = 0, time.time()
for _ in range(steps):
    obs, rewards, dones, infos = env.step([rng.choice([1, 2, 2, 3, 4, 4, 5]) for _ in range(n)])
    deaths += sum(dones)
dt = time.time() - t0
print(f"[{mode}] {n} partidas x {steps} pasos x 4 cuadros = {n * steps * 4} cuadros en {dt:.1f} s = {n * steps * 4 / dt:.0f} cuadros/s ({deaths} reinicios)")
