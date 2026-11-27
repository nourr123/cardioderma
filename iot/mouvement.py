# mouvement.py : lit le MPU6050 (I2C) et détecte les mouvements qui perturbent l'ECG.
import math
import threading
import time

import config


class Mouvement(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.actif = True
        self.dispo = False
        self.bus = None
        self.acc = (0.0, 0.0, 0.0)      # en g
        self.gyro = (0.0, 0.0, 0.0)     # en °/s
        self.niveau = 0.0               # 1.0 = seuil de mouvement atteint
        self.dernier_mouvement = 0.0
        if not config.UTILISER_MPU:
            return
        try:
            from smbus2 import SMBus
            self.bus = SMBus(config.I2C_BUS)
            self.bus.write_byte_data(config.MPU_ADRESSE, 0x6B, 0)   # sort le capteur du mode veille
            self.dispo = True
        except Exception as e:
            print("MPU6050 indisponible :", e)

    @staticmethod
    def _s16(h, l):
        v = (h << 8) | l
        return v - 65536 if v & 0x8000 else v

    def _lire(self):
        d = self.bus.read_i2c_block_data(config.MPU_ADRESSE, 0x3B, 14)
        s = self._s16
        acc = (s(d[0], d[1]) / 16384.0, s(d[2], d[3]) / 16384.0, s(d[4], d[5]) / 16384.0)
        gyro = (s(d[8], d[9]) / 131.0, s(d[10], d[11]) / 131.0, s(d[12], d[13]) / 131.0)
        return acc, gyro

    def run(self):
        if self.bus is None:
            return
        while self.actif:
            try:
                self.acc, self.gyro = self._lire()
                self.dispo = True
                ecart = abs(math.sqrt(sum(a * a for a in self.acc)) - 1.0)
                vitesse = math.sqrt(sum(g * g for g in self.gyro))
                self.niveau = round(max(ecart / config.SEUIL_ACC, vitesse / config.SEUIL_GYRO), 2)
                if self.niveau >= 1.0:
                    self.dernier_mouvement = time.time()
                time.sleep(0.02)
            except Exception:
                self.dispo = False
                time.sleep(0.5)

    def bouge_depuis(self, secondes):
        return self.dispo and (time.time() - self.dernier_mouvement) < secondes

    def mesure(self):
        return {"dispo": self.dispo, "niveau": self.niveau,
                "acc": [round(a, 2) for a in self.acc], "gyro": [round(g, 1) for g in self.gyro]}
