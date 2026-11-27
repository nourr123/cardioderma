# traitement.py : nettoie le signal, trouve les battements, calcule BPM, HRV et stress.
import numpy as np
from scipy.signal import butter, sosfiltfilt, iirnotch, filtfilt, find_peaks

import config


def frequence_reelle(t):
    """Fréquence d'échantillonnage réellement obtenue (peut différer un peu de 250 Hz)."""
    if len(t) < 2 or t[-1] <= t[0]:
        return float(config.FS)
    return (len(t) - 1) / (t[-1] - t[0])


def filtrer(v, fs):
    """Enlève la dérive lente (< 0,5 Hz), le bruit rapide (> 40 Hz) et le 50 Hz du secteur."""
    if len(v) < int(fs * 3):
        return np.array([])
    x = v - np.mean(v)
    sos = butter(2, [0.5, 40], btype="bandpass", fs=fs, output="sos")
    y = sosfiltfilt(sos, x)
    b, a = iirnotch(config.SECTEUR_HZ, 30, fs=fs)
    y = filtfilt(b, a, y)
    return -y if config.INVERSER_SIGNAL else y


def detecter_R(y, fs):
    """Trouve les pics R (les grands pics de chaque battement). Retourne leurs positions."""
    if len(y) == 0:
        return np.array([], dtype=int)
    pente = np.diff(y, prepend=y[0])
    energie = pente ** 2
    largeur = max(1, int(0.10 * fs))
    energie = np.convolve(energie, np.ones(largeur) / largeur, mode="same")
    seuil = 0.3 * np.percentile(energie, 99)
    candidats, _ = find_peaks(energie, height=seuil, distance=int(0.3 * fs))

    # on place chaque pic sur le vrai sommet de l'onde R
    demi = int(0.08 * fs)
    pics = []
    for p in candidats:
        a, b = max(0, p - demi), min(len(y), p + demi + 1)
        pics.append(a + int(np.argmax(y[a:b])))
    pics = np.unique(pics)

    # on écarte les petits pics (souvent l'onde T ou du bruit)
    if len(pics) >= 4:
        hauteurs = y[pics]
        pics = pics[hauteurs > 0.4 * np.median(hauteurs)]
    return pics


def intervalles_RR(t, pics):
    """Durées entre deux battements, en millisecondes, sans les valeurs aberrantes."""
    if len(pics) < 2:
        return np.array([])
    rr = np.diff(t[pics]) * 1000.0
    rr = rr[(rr > 300) & (rr < 2000)]            # entre 30 et 200 battements/min
    if len(rr) < 3:
        return rr
    mediane = np.median(rr)
    return rr[np.abs(rr - mediane) < 0.3 * mediane]


def indice_stress(bpm, rmssd):
    """Indice de 0 (détendu) à 100 (stress élevé), à partir de la HRV et du pouls."""
    s_hrv = np.clip((60.0 - rmssd) / (60.0 - 15.0), 0, 1) * 100   # HRV basse -> stress haut
    s_fc = np.clip((bpm - 60.0) / (110.0 - 60.0), 0, 1) * 100     # pouls haut -> stress haut
    return int(round(0.7 * s_hrv + 0.3 * s_fc))


def niveau_stress(score):
    if score < 33:
        return "Faible"
    if score < 66:
        return "Modéré"
    return "Élevé"


def qualite_signal(v_brut, electrodes_ok=True):
    """Vérifie que le signal est exploitable. Retourne (ok, message)."""
    if not electrodes_ok:
        return False, "Électrode décollée : recolle les trois électrodes."
    derniers = v_brut[-int(2 * config.FS):]
    if len(derniers) == 0:
        return False, "Démarrage…"
    if np.mean((derniers <= 2) | (derniers >= 1021)) > 0.05:
        return False, "Signal saturé : mauvais contact ou électrode décollée."
    if np.std(derniers) < 1.0:
        return False, "Signal plat : vérifie le câble OUTPUT et les électrodes."
    if np.ptp(derniers) > config.SEUIL_MOUVEMENT:
        return False, "Signal instable (mouvement ou contact) : reste immobile."
    return True, ""


def analyser(t, v, electrodes_ok=True):
    """Calcule toutes les mesures sur la fenêtre donnée. Retourne un dictionnaire."""
    res = {"valide": False, "bpm_ok": False, "message": "Démarrage…",
           "bpm": None, "rmssd": None, "sdnn": None, "pnn50": None,
           "stress": None, "niveau": None, "nb_battements": 0, "duree": 0}
    if len(t) < config.FS * 5:
        return res

    ok, message = qualite_signal(v, electrodes_ok)
    if not ok:
        res["message"] = message
        return res

    fs = frequence_reelle(t)
    y = filtrer(v, fs)
    pics = detecter_R(y, fs)
    rr = intervalles_RR(t, pics)
    res["duree"] = round(float(t[-1] - t[0]), 1)
    res["nb_battements"] = int(len(rr) + 1) if len(rr) else 0

    if len(rr) < 4:
        res["message"] = "Pas assez de battements détectés : reste immobile, détendue."
        return res

    bpm = 60000.0 / np.mean(rr)
    if not 35 <= bpm <= 200:
        res["message"] = "Pouls incohérent : le signal est trop bruité."
        return res

    res["bpm"] = round(float(bpm), 1)
    res["bpm_ok"] = True
    res["message"] = "Signal correct"

    # HRV : seulement si assez de signal propre
    if res["duree"] >= config.DUREE_MIN_STRESS and len(rr) >= 25:
        diffs = np.diff(rr)
        rmssd = float(np.sqrt(np.mean(diffs ** 2)))
        sdnn = float(np.std(rr))
        pnn50 = float(np.mean(np.abs(diffs) > 50) * 100)
        score = indice_stress(bpm, rmssd)
        res.update(rmssd=round(rmssd, 1), sdnn=round(sdnn, 1), pnn50=round(pnn50, 1),
                   stress=score, niveau=niveau_stress(score), valide=True)
    else:
        reste = max(0, int(config.DUREE_MIN_STRESS - res["duree"]))
        res["message"] = f"Signal correct. Stress en cours de calcul (encore environ {reste} s)."
    return res
