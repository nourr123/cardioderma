# app.py : serveur du Raspberry Pi. Acquisition, analyse, sessions par patient, API pour le site React.
import hmac
import threading
import time

import numpy as np
from flask import Flask, abort, jsonify, render_template, request
from flask_cors import CORS

import base
import config
import traitement
from acquisition import Acquisition
from mouvement import Mouvement

app = Flask(__name__)
CORS(app, origins=config.ORIGINES_AUTORISEES, allow_headers=["Content-Type", "X-Device-Token"])
base.initialiser()

acq = Acquisition()
acq.start()
mouv = Mouvement()
mouv.start()

verrou = threading.Lock()
etat = {
    "metriques": traitement.analyser(np.array([]), np.array([])),
    "session_id": None, "patient_id": None, "debut": None,
    "derniere_sauvegarde": 0.0, "sauvegardes": 0,
}


@app.before_request
def verifier_acces():
    """Jeton obligatoire pour l'API, sauf depuis le Pi lui-même (page locale)."""
    if request.method == "OPTIONS" or request.endpoint in ("accueil", "static"):
        return
    if not config.TOKEN_APPAREIL or request.remote_addr in ("127.0.0.1", "::1"):
        return
    if not hmac.compare_digest(request.headers.get("X-Device-Token", ""), config.TOKEN_APPAREIL):
        abort(401)


def courbe(fenetre):
    """(fs, signal filtré sur la fenêtre, signal brut) ou None."""
    t, v = acq.derniers(fenetre + 4)
    fs = traitement.frequence_reelle(t)
    y = traitement.filtrer(v, fs)
    if len(y) == 0:
        return None
    return fs, y[-int(fenetre * fs):], v


def session_courante():
    if not etat["session_id"]:
        return None
    return {"id": etat["session_id"], "patient_id": etat["patient_id"],
            "debut": etat["debut"], "sauvegardes": etat["sauvegardes"]}


def boucle_analyse():
    """Toutes les 2 secondes : BPM / HRV / stress, prise en compte des mouvements, enregistrement."""
    while True:
        time.sleep(2)
        t, v = acq.derniers(config.FENETRE_ANALYSE)
        m = traitement.analyser(t, v, acq.electrodes_ok)
        bouge = mouv.bouge_depuis(config.MOUVEMENT_FENETRE)
        m["mouvement"] = bouge
        if bouge and m["bpm_ok"]:
            m["message"] = "Mouvement détecté : le pouls et le stress peuvent être faussés. Reste immobile."
        etat["metriques"] = m

        with verrou:
            sid = etat["session_id"]
            pret = (sid and m["valide"] and not bouge
                    and time.time() - etat["derniere_sauvegarde"] >= config.INTERVALLE_SAUVEGARDE)
            if pret:
                c = courbe(config.FENETRE_AFFICHAGE)
                ecg = np.round(c[1][::2], 1).tolist() if c else None   # courbe réduite de moitié
                base.enregistrer(sid, m, ecg, mouv.niveau)
                etat["derniere_sauvegarde"] = time.time()
                etat["sauvegardes"] += 1


threading.Thread(target=boucle_analyse, daemon=True).start()


def _patient():
    p = request.args.get("patient_id", "").strip()
    if not p:
        abort(400)
    return p


@app.route("/")
def accueil():
    return render_template("index.html", fenetre=config.FENETRE_AFFICHAGE)


@app.route("/api/etat")
def api_etat():
    """Le Pi répond = il est connecté. signal_recu = des mesures arrivent bien du capteur."""
    t, _ = acq.derniers(2)
    recu = bool(len(t) > 10 and time.time() - t[-1] < 2)
    return jsonify(connecte=True, simulation=config.SIMULATION, signal_recu=recu,
                   electrodes_ok=acq.electrodes_ok, mpu=mouv.dispo, session=session_courante())


@app.route("/api/signal")
def api_signal():
    c = courbe(config.FENETRE_AFFICHAGE)
    if c is None:
        return jsonify(ok=False)
    fs, y, v = c
    pics = traitement.detecter_R(y, fs)
    brut = v[-int(2 * fs):]
    return jsonify(ok=True, fs=round(fs, 1), y=np.round(y, 1).tolist(), pics=pics.tolist(),
                   brut_moyen=int(np.mean(brut)), brut_amplitude=int(np.ptp(brut)))


@app.route("/api/metriques")
def api_metriques():
    return jsonify({**etat["metriques"], "enregistrement": bool(etat["session_id"]),
                    "sauvegardes": etat["sauvegardes"], "mpu": mouv.mesure()})


@app.route("/api/session/demarrer", methods=["POST"])
def api_demarrer():
    pid = str((request.get_json(silent=True) or {}).get("patient_id", "")).strip()
    if not pid:
        return jsonify(erreur="patient_id manquant"), 400
    with verrou:
        if etat["session_id"]:
            if etat["patient_id"] != pid:
                return jsonify(erreur="Une session d'un autre patient est en cours."), 409
            return jsonify(session_courante())
        etat.update(session_id=base.demarrer_session(pid), patient_id=pid,
                    debut=time.strftime("%Y-%m-%d %H:%M:%S"), derniere_sauvegarde=0.0, sauvegardes=0)
        return jsonify(session_courante())


@app.route("/api/session/arreter", methods=["POST"])
def api_arreter():
    pid = str((request.get_json(silent=True) or {}).get("patient_id", "")).strip()
    with verrou:
        if etat["session_id"] and etat["patient_id"] == pid:
            base.terminer_session(etat["session_id"])
            etat.update(session_id=None, patient_id=None, debut=None)
        elif etat["session_id"]:
            return jsonify(erreur="Cette session appartient à un autre patient."), 403
    return jsonify(session=None)


@app.route("/api/sessions")
def api_sessions():
    return jsonify(base.sessions(_patient()))


@app.route("/api/sessions/<int:sid>")
def api_session(sid):
    d = base.session_detail(sid, _patient())
    return (jsonify(d), 200) if d else (jsonify(erreur="introuvable"), 404)


@app.route("/api/mesures/<int:mid>/ecg")
def api_mesure_ecg(mid):
    e = base.ecg_mesure(mid, _patient())
    return (jsonify(ecg=e), 200) if e else (jsonify(erreur="introuvable"), 404)


# --- anciennes routes, conservées pour la page locale du Pi ---
@app.route("/api/enregistrement", methods=["POST"])
def api_enregistrement():
    actif = bool((request.get_json(force=True) or {}).get("actif"))
    with verrou:
        if actif and not etat["session_id"]:
            etat.update(session_id=base.demarrer_session("local"), patient_id="local",
                        debut=time.strftime("%Y-%m-%d %H:%M:%S"), derniere_sauvegarde=0.0, sauvegardes=0)
        elif not actif and etat["session_id"]:
            base.terminer_session(etat["session_id"])
            etat.update(session_id=None, patient_id=None, debut=None)
        return jsonify(enregistrement=bool(etat["session_id"]))


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
    print(f"API disponible sur http://<IP-du-Pi>:{config.PORT}")
    app.run(host="0.0.0.0", port=config.PORT, debug=False, threaded=True)
