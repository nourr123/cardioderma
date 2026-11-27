# acquisition.py : lit le capteur ECG en continu (en arrière-plan).
import threading
import time
from collections import deque

import numpy as np

import config


class Acquisition(threading.Thread):
    """Lit le canal du MCP3008 à fréquence fixe et garde les dernières secondes en mémoire."""

    def __init__(self):
        super().__init__(daemon=True)
        taille = config.FS * (config.FENETRE_ANALYSE + 10)
        self.temps = deque(maxlen=taille)     # instants des mesures (secondes)
        self.valeurs = deque(maxlen=taille)   # valeurs brutes 0-1023
        self.verrou = threading.Lock()
        self.actif = True
        self.electrodes_ok = True

        if config.SIMULATION:
            from simulation import SpiSimule
            self.spi = SpiSimule()
        else:
            import spidev
            self.spi = spidev.SpiDev()
        self.spi.open(config.SPI_BUS, config.SPI_CE)
        self.spi.max_speed_hz = config.SPI_VITESSE

        self.lo_plus = None
        self.lo_moins = None
        if config.UTILISER_LO:
            from gpiozero import DigitalInputDevice
            self.lo_plus = DigitalInputDevice(config.PIN_LO_PLUS)
            self.lo_moins = DigitalInputDevice(config.PIN_LO_MOINS)

    def lire(self):
        """Une mesure du MCP3008 (valeur entre 0 et 1023)."""
        r = self.spi.xfer2([1, (8 + config.CANAL_ECG) << 4, 0])
        return ((r[1] & 3) << 8) | r[2]

    def run(self):
        periode = 1.0 / config.FS
        prochain = time.perf_counter()
        compteur = 0
        while self.actif:
            valeur = self.lire()
            instant = time.time()
            with self.verrou:
                self.temps.append(instant)
                self.valeurs.append(valeur)

            # on vérifie les électrodes environ 10 fois par seconde
            compteur += 1
            if self.lo_plus is not None and compteur % 25 == 0:
                self.electrodes_ok = not (self.lo_plus.value or self.lo_moins.value)

            # attente pour garder une cadence régulière
            prochain += periode
            attente = prochain - time.perf_counter()
            if attente > 0:
                time.sleep(attente)
            else:
                prochain = time.perf_counter()   # on a pris du retard : on se recale

    def derniers(self, secondes):
        """Retourne (temps, valeurs) des dernières secondes, sous forme de tableaux numpy."""
        with self.verrou:
            t = np.array(self.temps, dtype=float)
            v = np.array(self.valeurs, dtype=float)
        if len(t) < 2:
            return t, v
        masque = t >= t[-1] - secondes
        return t[masque], v[masque]

    def arreter(self):
        self.actif = False
