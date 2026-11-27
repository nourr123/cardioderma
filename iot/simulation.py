# simulation.py : faux capteur ECG pour tester le programme SANS électrodes.
# Active-le avec SIMULATION = True dans config.py.
import math
import random
import time


class SpiSimule:
    """Se comporte comme spidev, mais fabrique un ECG artificiel d'environ 72 battements/min."""

    max_speed_hz = 0

    def open(self, bus, ce):
        self.t0 = time.time()
        self.battements = []
        self.prochain = 0.5

    def _ecg(self, t):
        while self.prochain < t + 2:
            self.battements.append(self.prochain)
            # rythme avec une petite variabilité, comme un vrai coeur
            self.prochain += 0.83 + 0.05 * math.sin(self.prochain * 0.7) + random.uniform(-0.02, 0.02)
        v = 0.0
        for b in self.battements[-6:]:
            d = t - b
            v += (45 * math.exp(-(d / 0.012) ** 2)            # pic R
                  - 8 * math.exp(-((d - 0.03) / 0.015) ** 2)  # creux S
                  + 10 * math.exp(-((d - 0.25) / 0.05) ** 2)) # onde T
        return v

    def xfer2(self, trame):
        t = time.time() - self.t0
        val = (465 + self._ecg(t) + 25 * math.sin(2 * math.pi * 0.2 * t)   # dérive lente
               + 4 * math.sin(2 * math.pi * 50 * t) + random.gauss(0, 1.2)) # bruit du secteur
        val = int(max(0, min(1023, val)))
        return [0, (val >> 8) & 3, val & 255]
