"""Exporta un modelo entrenado (el .zip de Stable-Baselines3) al formato que lee el navegador: assets/ia/modelo.json (la forma de la
red y de quién viene) y assets/ia/modelo.bin (los pesos, números de 32 bits en orden). Con eso el título del juego puede hacer jugar a
la IA cuando nadie lo usa (ia.js).

    python3 tools/ai/export_model.py [modelo.zip] [carpeta de salida]

Sin argumentos usa .entrenamiento/modelos/modelo.zip y escribe en assets/ia/. Hace falta el entorno de Python de entrenar.sh.
"""
import json
import os
import sys
import time

import numpy as np
import torch
from stable_baselines3 import PPO

from smb_env import SmbClient  # noqa: F401  (sólo para fallar pronto si faltan los módulos de tools/ai)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ACTIONS = [[], ["right"], ["right", "jump"], ["right", "run"], ["right", "run", "jump"], ["jump"], ["left"], ["left", "jump"],
           ["left", "run"], ["left", "run", "jump"], ["down"], ["fire"], ["right", "run", "fire"], ["right", "run", "jump", "fire"]]


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".entrenamiento", "modelos", "modelo.zip")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "ia")
    model = PPO.load(src, device="cpu")
    pol = model.policy
    if not isinstance(pol.mlp_extractor.policy_net[1], torch.nn.Tanh):
        raise SystemExit("La red no usa Tanh: ia.js sólo sabe calcular esa activación.")
    layers = [pol.mlp_extractor.policy_net[0], pol.mlp_extractor.policy_net[2], pol.action_net]
    acts = ["tanh", "tanh", "linear"]
    if pol.action_net.out_features != len(ACTIONS):
        raise SystemExit(f"El modelo tiene {pol.action_net.out_features} acciones y el juego {len(ACTIONS)}.")
    chunks, meta_layers = [], []
    for lay, act in zip(layers, acts):
        chunks.append(lay.weight.detach().numpy().astype("<f4").ravel())   # filas = salidas, columnas = entradas
        chunks.append(lay.bias.detach().numpy().astype("<f4").ravel())
        meta_layers.append({"in": lay.in_features, "out": lay.out_features, "act": act})
    blob = np.concatenate(chunks).tobytes()
    steps = None
    try:
        with open(os.path.splitext(src)[0] + ".json") as f:
            steps = json.load(f)["steps"]
    except (OSError, KeyError, ValueError):
        pass
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "modelo.bin"), "wb") as f:
        f.write(blob)
    meta = {"obsDim": layers[0].in_features, "layers": meta_layers, "actions": ACTIONS, "trainedSteps": steps,
            "exportedAt": time.strftime("%Y-%m-%d %H:%M:%S"), "floats": len(blob) // 4}
    with open(os.path.join(out, "modelo.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"exportado: {len(blob) // 4} pesos ({len(blob) / 1024:.0f} KB) de un modelo con {steps} pasos de entrenamiento -> {out}")


if __name__ == "__main__":
    main()
