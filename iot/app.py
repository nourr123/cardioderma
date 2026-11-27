# app.py : serveur du Raspberry Pi. Lance l'acquisition, l'analyse et la liaison avec le site.
import threading
import time

import numpy as np
from flask import Flask, jsonify, render_template, request

import base
import config
import traitement
from acquisition import Acquisition
from mouvement import Mouvement
from pont import Pont

app = Flask(__name__)
base.initialiser()

acq = Acquisition()
acq.start()
mouv = Mouvement()
mouv.start()

etat = {
    "metriques": traitement.analyser(np.array([]), np.array([])),
    "enregistrement": False,
    "derniere_sauvegarde": 0.0,
    "sauvegardes": 0,
}


def boucle_analyse():
    """Toutes les 2 secondes : calcule BPM / HRV / stress, tient compte des mouvements."""
    while True:
        time.sleep(2)
        t, v = acq.derniers(config.FENETRE_ANALYSE)
        m = traitement.analyser(t, v, acq.electrodes_ok)
        bouge = mouv.bouge_depuis(config.MOUVEMENT_FENETRE)
        m["mouvement"] = bouge
        if bouge and m["bpm_ok"]:
            m["message"] = "Mouvement détecté : le pouls et le stress peuvent être faussés. Reste immobile."
        etat["metriques"] = m
        if (etat["enregistrement"] and m["valide"] and not bouge
                and time.time() - etat["derniere_sauvegarde"] >= config.INTERVALLE_SAUVEGARDE):
            base.enregistrer(m)
            etat["derniere_sauvegarde"] = time.time()
            etat["sauvegardes"] += 1


threading.Thread(target=boucle_analyse, daemon=True).start()


def courbe_pics():
    """(fréquence, signal filtré, positions des pics R) pour l'envoi au site."""
    t, v = acq.derniers(config.FENETRE_AFFICHAGE + 4)
    fs = traitement.frequence_reelle(t)
    y = traitement.filtrer(v, fs)
    if len(y) == 0:
        return None
    y = y[-int(config.FENETRE_AFFICHAGE * fs):]
    return fs, y, traitement.detecter_R(y, fs)


pont = Pont(acq, mouv, lambda: etat["metriques"], courbe_pics)
pont.start()


@app.route("/")
def accueil():
    return render_template("index.html", fenetre=config.FENETRE_AFFICHAGE)


@app.route("/api/signal")
def api_signal():
    """La courbe filtrée à afficher, avec la position des pics R (page locale du Pi)."""
    c = courbe_pics()
    if c is None:
        return jsonify(ok=False)
    fs, y, pics = c
    t, v = acq.derniers(2)
    return jsonify(ok=True, fs=round(fs, 1), y=np.round(y, 1).tolist(), pics=pics.tolist(),
                   brut_moyen=int(np.mean(v)), brut_amplitude=int(np.ptp(v)))


@app.route("/api/metriques")
def api_metriques():
    return jsonify({**etat["metriques"], "enregistrement": etat["enregistrement"],
                    "sauvegardes": etat["sauvegardes"]})


@app.route("/api/enregistrement", methods=["POST"])
def api_enregistrement():
    etat["enregistrement"] = bool(request.get_json(force=True).get("actif"))
    etat["derniere_sauvegarde"] = 0.0
    etat["sauvegardes"] = 0
    return jsonify(enregistrement=etat["enregistrement"])


@app.route("/api/historique")
def api_historique():
    return jsonify(base.historique(int(request.args.get("limite", 100))))


@app.route("/api/historique", methods=["DELETE"])
def api_effacer():
    base.effacer()
    return jsonify(ok=True)


if __name__ == "__main__":
    if config.SIMULATION:
        print("MODE SIMULATION : le signal est artificiel.")
    print(f"Page locale : http://<IP-du-Pi>:{config.PORT}")
    app.run(host="0.0.0.0", port=config.PORT, debug=False, threaded=True)
