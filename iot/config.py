# config.py : tous les réglages au même endroit.
# Tu peux modifier ces valeurs sans toucher au reste du code.

# --- Acquisition (lecture du capteur) ---
SIMULATION = True      # True = faux signal ECG pour tester sans capteur ni électrodes
FS = 250                # mesures par seconde visées (Hz)
CANAL_ECG = 0           # canal du MCP3008 relié à OUTPUT de l'AD8232 (CH0)
SPI_BUS = 0
SPI_CE = 0              # CE0 = pin 24 du Pi
SPI_VITESSE = 1350000

# Détection d'électrode décollée avec les broches LO+ et LO-
# Mets True seulement si LO+ -> pin 11 (GPIO17) et LO- -> pin 13 (GPIO27) sont câblés.
UTILISER_LO = False
PIN_LO_PLUS = 17
PIN_LO_MOINS = 27

# --- Traitement du signal ---
SECTEUR_HZ = 50         # 50 Hz en France (filtre anti-bruit du courant)
INVERSER_SIGNAL = False # mets True si les pics R pointent vers le BAS sur la courbe
SEUIL_MOUVEMENT = 400   # amplitude brute (0-1023) sur 2 s au-delà de laquelle on dit "bouge pas"

# --- Fenêtres de temps (en secondes) ---
FENETRE_AFFICHAGE = 8   # durée de courbe affichée
FENETRE_ANALYSE = 60    # durée utilisée pour le BPM et le stress
DUREE_MIN_STRESS = 30   # minimum de signal propre avant d'estimer le stress

# --- Historique ---
BASE = "ecg.db"
INTERVALLE_SAUVEGARDE = 30   # une mesure enregistrée toutes les 30 s (si enregistrement actif)

# --- Serveur web ---
PORT = 5000
# --- Accès par le site web ---
BACKEND_URL = ""
FICHIER_APPAREIL = "appareil.json"

# --- MPU6050 (mouvements) ---
UTILISER_MPU = False
I2C_BUS = 1
MPU_ADRESSE = 0x68
SEUIL_ACC = 0.15        # écart à 1 g (en g) au-delà duquel on considère un mouvement
SEUIL_GYRO = 30.0       # vitesse de rotation (°/s) au-delà de laquelle on considère un mouvement
MOUVEMENT_FENETRE = 5   # secondes pendant lesquelles un mouvement invalide les mesures
