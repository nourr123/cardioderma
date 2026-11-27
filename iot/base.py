# base.py : sessions et mesures, par patient, dans SQLite (fichier ecg.db).
import json
import sqlite3
from contextlib import closing
from datetime import datetime

import config


def _c():
    c = sqlite3.connect(config.BASE)
    c.row_factory = sqlite3.Row
    return c


def _maintenant():
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def initialiser():
    with closing(_c()) as c:
        c.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL, debut TEXT NOT NULL, fin TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS mesures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            horodatage TEXT NOT NULL, bpm REAL, rmssd REAL, sdnn REAL, pnn50 REAL,
            stress INTEGER, niveau TEXT, nb_battements INTEGER)""")
        # migration : on ajoute les nouvelles colonnes à l'ancienne table sans perdre les données
        colonnes = {r["name"] for r in c.execute("PRAGMA table_info(mesures)")}
        for nom, typ in (("session_id", "INTEGER"), ("ecg", "TEXT"), ("mouvement", "REAL")):
            if nom not in colonnes:
                c.execute(f"ALTER TABLE mesures ADD COLUMN {nom} {typ}")
        # une session restée ouverte après une coupure de courant est refermée
        c.execute("""UPDATE sessions SET fin = COALESCE(
            (SELECT MAX(horodatage) FROM mesures WHERE session_id = sessions.id), debut)
            WHERE fin IS NULL""")
        c.commit()


def demarrer_session(patient_id):
    with closing(_c()) as c:
        cur = c.execute("INSERT INTO sessions (patient_id, debut) VALUES (?, ?)", (patient_id, _maintenant()))
        c.commit()
        return cur.lastrowid


def terminer_session(session_id):
    with closing(_c()) as c:
        c.execute("UPDATE sessions SET fin = ? WHERE id = ? AND fin IS NULL", (_maintenant(), session_id))
        c.commit()


def enregistrer(session_id, m, ecg=None, mouvement=None):
    with closing(_c()) as c:
        c.execute(
            "INSERT INTO mesures (session_id, horodatage, bpm, rmssd, sdnn, pnn50, stress, niveau, "
            "nb_battements, ecg, mouvement) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (session_id, _maintenant(), m["bpm"], m["rmssd"], m["sdnn"], m["pnn50"], m["stress"],
             m["niveau"], m["nb_battements"], json.dumps(ecg) if ecg else None, mouvement))
        c.commit()


def sessions(patient_id, limite=50):
    with closing(_c()) as c:
        lignes = c.execute("""
            SELECT s.id, s.debut, s.fin, COUNT(m.id) AS nb_mesures,
                   ROUND(AVG(m.bpm), 1) AS bpm_moyen, ROUND(AVG(m.stress), 0) AS stress_moyen,
                   ROUND(AVG(m.rmssd), 1) AS rmssd_moyen
            FROM sessions s LEFT JOIN mesures m ON m.session_id = s.id
            WHERE s.patient_id = ? GROUP BY s.id ORDER BY s.id DESC LIMIT ?""",
                           (patient_id, limite)).fetchall()
    return [dict(l) for l in lignes]


def session_detail(session_id, patient_id):
    with closing(_c()) as c:
        s = c.execute("SELECT id, debut, fin FROM sessions WHERE id = ? AND patient_id = ?",
                      (session_id, patient_id)).fetchone()
        if s is None:
            return None
        mesures = c.execute(
            "SELECT id, horodatage, bpm, rmssd, sdnn, pnn50, stress, niveau, nb_battements, mouvement "
            "FROM mesures WHERE session_id = ? ORDER BY id", (session_id,)).fetchall()
    return {"session": dict(s), "mesures": [dict(m) for m in mesures]}


def ecg_mesure(mesure_id, patient_id):
    with closing(_c()) as c:
        r = c.execute("""SELECT m.ecg FROM mesures m JOIN sessions s ON s.id = m.session_id
                         WHERE m.id = ? AND s.patient_id = ?""", (mesure_id, patient_id)).fetchone()
    return json.loads(r["ecg"]) if r and r["ecg"] else None


def historique(limite=100):
    """Ancienne page locale : les dernières mesures, de la plus ancienne à la plus récente."""
    with closing(_c()) as c:
        lignes = c.execute("SELECT id, horodatage, bpm, rmssd, sdnn, pnn50, stress, niveau, nb_battements "
                           "FROM mesures ORDER BY id DESC LIMIT ?", (limite,)).fetchall()
    return [dict(l) for l in reversed(lignes)]


def effacer():
    with closing(_c()) as c:
        c.execute("DELETE FROM mesures")
        c.execute("DELETE FROM sessions")
        c.commit()



              
