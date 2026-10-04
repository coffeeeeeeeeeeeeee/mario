"""Comprueba que la IA dentro del juego (ia.js) calcula lo mismo que el entrenamiento: para cientos de situaciones de los 32 niveles
compara las 1072 entradas de la red (Python: smb_sb3.featurize, navegador: ia.js) y las salidas de la red (Stable-Baselines3 contra
los pesos exportados). Conviene correrlo después de tocar la observación (api.js, smb_sb3.py, ia.js) o la red.

    python3 check_ia.py [modelo.zip]          (por defecto .entrenamiento/modelos/modelo.zip)
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import torch
from stable_baselines3 import PPO

from smb_sb3 import featurize

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".entrenamiento", "modelos", "modelo.zip")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, os.path.join(HERE, "export_model.py"), src, tmp], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["node", os.path.join(HERE, "ia_dump.js"), tmp], check=True)
        data = json.load(open(os.path.join(tmp, "paridad.json")))
    model = PPO.load(src, device="cpu")
    fdiff = pdiff = 0.0
    agree = 0
    samples = data["samples"]
    for s in samples:
        py = featurize(s["obs"])
        fdiff = max(fdiff, float(np.abs(py - np.array(s["js"], dtype=np.float32)).max()))
        x = torch.as_tensor(py[None])
        with torch.no_grad():
            p_py = model.policy.get_distribution(x).distribution.probs[0].numpy()
        lg = np.array(s["logits"])
        e = np.exp(lg - lg.max())
        p_js = e / e.sum()
        pdiff = max(pdiff, float(np.abs(p_py - p_js).max()))
        agree += int(p_py.argmax() == p_js.argmax())
    ok = fdiff < 1e-6 and pdiff < 1e-4 and data["actionsOk"] and agree == len(samples)
    print(f"{len(samples)} situaciones de {len(set(s['world'] for s in samples))} niveles")
    print(f"entradas de la red: diferencia máxima {fdiff:.1e} | probabilidades de cada acción: {pdiff:.1e} | misma acción preferida: {agree}/{len(samples)}")
    print(f"lista de acciones igual a la del entrenamiento: {'sí' if data['actionsOk'] else 'NO'}")
    print("RESULTADO:", "iguales" if ok else "HAY DIFERENCIAS")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
