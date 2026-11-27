# pont.py : relie le Raspberry Pi au backend du site (Socket.IO, connexion sortante).
#
# Utilisation (une seule fois) :
#   python pont.py serveur http://ADRESSE_DU_BACKEND:5000
#   python pont.py coupler CODE_AFFICHE_SUR_LE_SITE
# Ensuite, python app.py se connecte tout seul.
import json
import os
import sys
import threading
import time

import numpy as np
import requests
import socketio

import config

NS = "/device"


def lire_fichier():
    try:
        with open(config.FICHIER_APPAREIL) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def ecrire_fichier(donnees):
    with open(config.FICHIER_APPAREIL, "w") as f:
        json.dump(donnees, f)
    os.chmod(config.FICHIER_APPAREIL, 0o600)


def adresse():
    return (lire_fichier().get("serveur") or getattr(config, "BACKEND_URL", "") or "").rstrip("/")


def commande_serveur(url):
    if not url.startswith("http"):
        print("L'adresse doit commencer par http:// (exemple : http://192.168.1.3:5000)")
        sys.exit(1)
    d = lire_fichier()
    d["serveur"] = url.rstrip("/")
    ecrire_fichier(d)
    print("Adresse enregistrée :", d["serveur"])


def commande_coupler(code):
    url = adresse()
    if not url:
        print("Adresse du site inconnue. Indique-la d'abord :\n  python pont.py serveur http://ADRESSE:5000")
        sys.exit(1)
    try:
        r = requests.post(url + "/api/cardio/device/pair", json={"code": code}, timeout=10)
    except requests.RequestException as e:
        print("Backend injoignable :", e)
        sys.exit(1)
    if r.status_code != 200:
        try:
            print("Appairage refusé :", r.json().get("message", r.status_code))
        except ValueError:
            print("Appairage refusé :", r.status_code)
        sys.exit(1)
    d = lire_fichier()
    d["deviceKey"] = r.json()["deviceKey"]
    ecrire_fichier(d)
    print("Appareil couplé. Lancez maintenant : python app.py")


class Pont(threading.Thread):
    def __init__(self, acq, mouv, get_metriques, get_courbe):
        super().__init__(daemon=True)
        self.acq, self.mouv = acq, mouv
        self.get_metriques = get_metriques
        self.get_courbe = get_courbe
        self.session_id = None
        self.derniere_mesure = 0.0
        self.sio = socketio.Client(reconnection=False)
        self.sio.on("session:sync", self._sync, namespace=NS)
        self.sio.on("disconnect", self._deconnecte, namespace=NS)

    def _sync(self, d):
        self.session_id = (d or {}).get("sessionId")
        self.derniere_mesure = 0.0
        print("Session :", self.session_id or "aucune")

    def _deconnecte(self, *_):
        print("Déconnecté du backend")
        self.session_id = None

    def _connecter(self, url, cle):
        try:
            self.sio.connect(url, namespaces=[NS], auth={"deviceKey": cle},
                             transports=["websocket"], wait_timeout=10)
            print("Connecté au backend")
        except Exception as e:
            print("Connexion au backend impossible :", e)
            try:
                self.sio.disconnect()
            except Exception:
                pass
            time.sleep(5)

    def _etat(self):
        t, _ = self.acq.derniers(2)
        recu = bool(len(t) > 10 and time.time() - t[-1] < 2)
        return {"signal_recu": recu, "electrodes_ok": bool(self.acq.electrodes_ok),
                "mpu": bool(self.mouv.dispo), "simulation": bool(config.SIMULATION)}

    def _metriques_et_mesure(self, courbe):
        m = dict(self.get_metriques())
        m["mpu"] = self.mouv.mesure()
        self.sio.emit("state", self._etat(), namespace=NS)
        self.sio.emit("metrics", m, namespace=NS)
        if (self.session_id and m.get("valide") and not m.get("mouvement") and courbe
                and time.time() - self.derniere_mesure >= config.INTERVALLE_SAUVEGARDE):
            _, y, _ = courbe
            self.sio.emit("measure", {
                "session_id": self.session_id, "bpm": m["bpm"], "rmssd": m["rmssd"], "sdnn": m["sdnn"],
                "pnn50": m["pnn50"], "stress": m["stress"], "niveau": m["niveau"],
                "nb_battements": m["nb_battements"], "mouvement": self.mouv.niveau,
                "ecg": np.round(y[::2], 1).tolist()}, namespace=NS)
            self.derniere_mesure = time.time()

    def run(self):
        url, cle = adresse(), lire_fichier().get("deviceKey")
        if not url or not cle:
            print("Appareil non couplé. Exécutez :\n  python pont.py serveur http://ADRESSE:5000\n"
                  "  python pont.py coupler CODE")
            return
        tick = 0
        while True:
            if not self.sio.connected:
                self._connecter(url, cle)
                continue
            try:
                courbe = self.get_courbe()
                if courbe:
                    fs, y, pics = courbe
                    self.sio.emit("signal", {"y": np.round(y, 1).tolist(), "pics": pics.tolist(),
                                             "fs": round(float(fs), 1)}, namespace=NS)
                if tick % 5 == 0:
                    self._metriques_et_mesure(courbe)
                tick += 1
            except Exception as e:
                print("Erreur d'envoi :", e)
            time.sleep(0.4)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "serveur":
        commande_serveur(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == "coupler":
        commande_coupler(sys.argv[2])
    else:
        print("Usage :\n  python pont.py serveur http://ADRESSE:5000\n  python pont.py coupler CODE")
