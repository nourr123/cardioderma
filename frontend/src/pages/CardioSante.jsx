import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, HeartPulse, Play, Square, Trash2, WifiOff, Waves, Zap } from "lucide-react";
import Navbar from "../components/Navbar";
import useCardioLive from "../hooks/useCardioLive";
import * as api from "../services/cardioApi";
import {
  Bouton, Carte, Courbes, EcgCanvas, Jauge, Tuile,
  dateTxt, dureeTxt, fmt, niveauStress, serie,
} from "../components/cardio/cardioUi";

const CONSEILS = {
  Faible: "Votre rythme cardiaque et sa variabilité évoquent un état plutôt détendu.",
  Modéré:
    "Votre variabilité cardiaque suggère une tension modérée. Une pause, quelques respirations lentes ou une courte marche peuvent aider.",
  Élevé:
    "Votre variabilité cardiaque est basse et/ou votre pouls élevé, ce qui peut accompagner un stress marqué. Reposez-vous et, si cela persiste ou si vous vous sentez mal, parlez-en à un professionnel de santé.",
};

export default function CardioSante() {
  const navigate = useNavigate();
  const live = useCardioLive();
  const [now, setNow] = useState(Date.now());
  const [device, setDevice] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [active, setActive] = useState(null);
  const [activeMeasures, setActiveMeasures] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshDevice = useCallback(async () => {
    try {
      setDevice(await api.getDevice());
    } catch (e) {
      setErreur(e?.message || "Erreur");
    }
  }, []);
  const refreshActive = useCallback(async () => {
    try {
      const d = await api.getActiveSession();
      setActive(d.session);
      setActiveMeasures(d.measures || []);
    } catch {
      /* ignoré */
    }
  }, []);
  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await api.getSessions());
    } catch {
      /* ignoré */
    }
  }, []);

  useEffect(() => {
    refreshDevice();
    refreshActive();
    refreshSessions();
  }, [refreshDevice, refreshActive, refreshSessions]);

  useEffect(() => {
    refreshDevice();
  }, [live.deviceOnline, refreshDevice]);

  useEffect(() => {
    if (live.sessionEvt) {
      refreshActive();
      refreshSessions();
    }
  }, [live.sessionEvt, refreshActive, refreshSessions]);

  useEffect(() => {
    const m = live.lastMeasure;
    if (m && active && String(m.session) === String(active._id)) {
      setActiveMeasures((l) => [...l, m]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.lastMeasure]);

  useEffect(() => {
    if (!pairing || device?.paired) return;
    const id = setInterval(refreshDevice, 3000);
    return () => clearInterval(id);
  }, [pairing, device?.paired, refreshDevice]);

  useEffect(() => {
    if (device?.paired) setPairing(null);
  }, [device?.paired]);

  const agir = async (fn) => {
    setErreur("");
    setOccupe(true);
    try {
      await fn();
    } catch (e) {
      setErreur(e?.message || "Erreur");
    } finally {
      setOccupe(false);
    }
  };

  const supprimer = (id) => {
    if (!window.confirm("Supprimer définitivement cette session et ses mesures ?")) return;
    agir(async () => {
      await api.deleteSession(id);
      refreshSessions();
    });
  };

  /* ----- statut du dispositif ----- */
  const signalFrais = now - live.signalAt < 3000;
  let statut = { txt: "Aucun dispositif connecté", couleur: "bg-slate-400", ping: false };
  if (device?.paired) {
    if (!live.socketUp) statut = { txt: "Connexion au serveur perdue, reconnexion…", couleur: "bg-red-500", ping: false };
    else if (!live.deviceOnline) statut = { txt: "Dispositif déconnecté", couleur: "bg-red-500", ping: false };
    else if (!live.state?.signal_recu || !signalFrais)
      statut = { txt: "Connecté, aucune donnée reçue du capteur", couleur: "bg-amber-500", ping: false };
    else statut = { txt: "Connecté, données reçues", couleur: "bg-emerald-500", ping: true };
  }

  const m = live.metrics;
  const restant = pairing ? Math.max(0, Math.round((new Date(pairing.expiresAt) - now) / 1000)) : 0;
  const peutMesurer = live.deviceOnline && live.state?.signal_recu && signalFrais;
  const niveau = niveauStress(m?.stress);
  const bpm = m?.bpm ? Math.round(m.bpm) : null;
  const progression = Math.min(100, Math.round(((m?.duree || 0) / 30) * 100));

  return (
    <div className="flex min-h-screen flex-col bg-brand-50/60">
      <style>{`
        @keyframes csBeat { 0%,100% { transform: scale(1); } 12% { transform: scale(1.22); } 24% { transform: scale(1); } 36% { transform: scale(1.12); } 48% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .cs-coeur { animation: none !important; } }
      `}</style>
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 text-brand-900">
        {/* En-tête */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Cardio-Santé</h1>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-brand-100">
              <span className="relative flex h-2.5 w-2.5">
                {statut.ping && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statut.couleur}`} />
              </span>
              {statut.txt}
            </p>
          </div>

          {device?.paired && (
            <div className="text-right">
              {!active ? (
                <Bouton
                  disabled={occupe || !peutMesurer}
                  onClick={() => agir(async () => { await api.startSession(); refreshActive(); })}
                >
                  <Play size={16} /> Démarrer une session
                </Bouton>
              ) : (
                <Bouton
                  variante="danger"
                  disabled={occupe}
                  onClick={() => agir(async () => { await api.stopSession(); refreshActive(); refreshSessions(); })}
                >
                  <Square size={16} /> Arrêter la session
                </Bouton>
              )}
              <p className="mt-2 text-xs text-brand-900/60">
                {active
                  ? `En cours depuis ${dureeTxt(active.startedAt)} · ${activeMeasures.length} mesure(s) enregistrée(s)`
                  : !peutMesurer && live.deviceOnline
                  ? "Disponible dès que le capteur envoie des données"
                  : ""}
              </p>
            </div>
          )}
        </div>

        {erreur && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {erreur}
          </p>
        )}

        {/* Appairage : dispositif pas encore ajouté */}
        {device && !device.paired && (
          <Carte className="mt-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-[#E5484D] text-white shadow-lg shadow-coral/30">
                <HeartPulse size={24} />
              </span>
              <div className="flex-1">
                <h2 className="font-heading text-xl font-bold">Connectez votre capteur ECG</h2>
                <p className="mt-1 text-sm text-brand-900/70">Une seule fois : votre appareil se reconnectera ensuite tout seul.</p>

                {!pairing ? (
                  <Bouton className="mt-4" disabled={occupe} onClick={() => agir(async () => setPairing(await api.createPairing()))}>
                    Ajouter mon dispositif
                  </Bouton>
                ) : (
                  <ol className="mt-4 space-y-4 text-sm">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">1</span>
                      <div>
                        Votre code d'appairage
                        <div className="mt-1 text-3xl font-extrabold tracking-widest">{pairing.code}</div>
                        <div className="text-xs text-brand-900/60">
                          {restant > 0
                            ? `Valable encore ${Math.floor(restant / 60)} min ${String(restant % 60).padStart(2, "0")} s`
                            : "Code expiré"}
                        </div>
                        {restant === 0 && (
                          <Bouton variante="clair" className="mt-2" onClick={() => agir(async () => setPairing(await api.createPairing()))}>
                            Générer un nouveau code
                          </Bouton>
                        )}
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">2</span>
                      <div className="min-w-0">
                        Sur le Raspberry Pi, exécutez
                        <code className="mt-1 block overflow-x-auto rounded-xl bg-[#0a1f1a] px-3 py-2 text-xs text-emerald-200">
                          python pont.py coupler {pairing.code}
                        </code>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">3</span>
                      <div>Cette page détecte l'appareil automatiquement, sans rien recharger.</div>
                    </li>
                  </ol>
                )}
              </div>
            </div>
          </Carte>
        )}

        {/* Dispositif appairé mais hors ligne */}
        {device?.paired && !live.deviceOnline && (
          <Carte className="mt-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <WifiOff size={24} />
              </span>
              <div>
                <h2 className="font-heading text-lg font-bold">Votre appareil ne répond pas</h2>
                <p className="mt-1 text-sm text-brand-900/70">
                  Vérifiez que le Raspberry Pi est allumé et connecté au même réseau, puis lancez <code>python app.py</code>.
                  La page se remet à jour dès qu'il est de retour.
                </p>
              </div>
            </div>
          </Carte>
        )}

        {/* Moniteur ECG */}
        {device?.paired && live.deviceOnline && (
          <>
            <section className="mt-6 overflow-hidden rounded-3xl bg-[#071a15] shadow-xl shadow-brand-900/20 ring-1 ring-black/5">
              <div className="flex items-center justify-between px-5 pt-4 text-xs font-semibold text-emerald-100/70">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> En direct
                </span>
                <span>{signalFrais ? `${live.signal?.fs} mesures par seconde` : "Aucun signal"}</span>
              </div>

              <div className="relative mt-2">
                <EcgCanvas y={live.signal?.y} pics={live.signal?.pics} haut={0.34} className="h-80" />
                <div className="pointer-events-none absolute left-5 top-3 flex items-center gap-3">
                  <HeartPulse
                    size={34}
                    className="cs-coeur text-[#ff6b5b]"
                    style={bpm ? { animation: `csBeat ${(60 / bpm).toFixed(2)}s ease-in-out infinite` } : undefined}
                  />
                  <div className="flex items-baseline gap-2 leading-none">
                    <span className="text-6xl font-extrabold tabular-nums text-white">{fmt(bpm)}</span>
                    <span className="text-sm text-emerald-100/70">battements/min</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/5 px-5 py-3 text-sm">
                <span className={`font-semibold ${m?.bpm_ok ? "text-emerald-300" : "text-amber-300"}`}>{m?.message || "…"}</span>
                <span className="text-xs text-emerald-100/50">Points rouges : battements détectés</span>
              </div>
            </section>

            {live.state && !live.state.electrodes_ok && (
              <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                Électrode décollée : recollez les trois électrodes.
              </p>
            )}

            {/* Stress + indicateurs */}
            <div className="mt-5 grid gap-5 lg:grid-cols-5">
              <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
                <h2 className="font-heading text-lg font-bold">Niveau de stress estimé</h2>
                <div className="mt-3">
                  <Jauge valeur={m?.stress ?? null} />
                </div>

                {niveau ? (
                  <>
                    <div className="-mt-1 text-center">
                      <span className="text-5xl font-extrabold tabular-nums">{m.stress}</span>
                      <span className="text-base text-brand-900/60"> / 100</span>
                      <div>
                        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ring-1 ${niveau.chip}`}>
                          Stress {niveau.label.toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <p className={`mt-4 rounded-2xl p-3 text-sm leading-relaxed ${niveau.bloc}`}>{CONSEILS[niveau.label]}</p>
                  </>
                ) : (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-brand-900/70">
                      {m?.bpm_ok
                        ? "Analyse en cours : restez immobile pendant environ 30 secondes."
                        : m?.message || "En attente du signal…"}
                    </p>
                    {m?.bpm_ok && (
                      <div className="mx-auto mt-3 h-2 max-w-[14rem] overflow-hidden rounded-full bg-brand-100">
                        <div className="h-full rounded-full bg-brand-700 transition-all duration-700" style={{ width: `${progression}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
                <h2 className="font-heading text-lg font-bold">Variabilité de votre rythme</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Tuile icone={Activity} label="RMSSD" value={fmt(m?.rmssd, " ms")} hint="Variation d'un battement à l'autre. Plus elle est élevée, plus le corps est au repos." />
                  <Tuile icone={Waves} label="SDNN" value={fmt(m?.sdnn, " ms")} hint="Variation globale de votre rythme sur la mesure." />
                  <Tuile icone={Zap} label="pNN50" value={fmt(m?.pnn50, " %")} hint="Part des battements dont l'intervalle varie de plus de 50 ms." />
                  <Tuile icone={HeartPulse} label="Battements analysés" value={fmt(m?.nb_battements)} hint="Nombre de battements utilisés pour le calcul." />
                </div>

                {active && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-sm font-bold">Évolution pendant la session</h3>
                    <Courbes
                      legende
                      series={serie(activeMeasures)}
                      vide="Le premier point apparaît après environ 30 secondes de signal propre."
                    />
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* Historique */}
        <Carte titre="Historique de mes mesures" className="mt-6">
          {!sessions.length ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Clock size={26} />
              </span>
              <p className="mt-3 font-semibold">Aucune session pour le moment</p>
              <p className="mt-1 max-w-sm text-sm text-brand-900/60">
                Démarrez une session d'au moins 2 minutes, en restant immobile : vos résultats apparaîtront ici.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-brand-100">
              {sessions.map((s) => {
                const nv = niveauStress(s.stressAvg);
                return (
                  <li key={s._id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-[11rem] flex-1">
                      <div className="font-semibold">{dateTxt(s.startedAt)}</div>
                      <div className="text-sm text-brand-900/60">
                        {dureeTxt(s.startedAt, s.endedAt)}
                        {s.status === "active" && " (en cours)"}
                        {" · "}
                        {s.count} mesure{s.count > 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-semibold">
                        <HeartPulse size={14} className="text-[#ff6b5b]" /> {fmt(s.bpmAvg)} /min
                      </span>
                      {nv ? (
                        <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${nv.chip}`}>
                          Stress {s.stressAvg} · {nv.label.toLowerCase()}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">Pas de mesure</span>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <Bouton variante="clair" onClick={() => navigate(`/cardio/session/${s._id}`)}>
                        Voir l'ECG
                      </Bouton>
                      {s.status !== "active" && (
                        <button
                          type="button"
                          onClick={() => supprimer(s._id)}
                          aria-label="Supprimer cette session"
                          className="rounded-full p-2 text-brand-900/40 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>

        {/* Gestion du dispositif */}
        {device?.paired && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 px-5 py-3 text-sm ring-1 ring-brand-100">
            <span className="text-brand-900/70">Un dispositif est associé à votre compte.</span>
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                if (!window.confirm("Retirer ce dispositif de votre compte ?")) return;
                agir(async () => {
                  await api.removeDevice();
                  setPairing(null);
                  setActive(null);
                  refreshDevice();
                  refreshSessions();
                });
              }}
              className="font-semibold text-red-600 hover:underline disabled:opacity-50"
            >
              Retirer le dispositif
            </button>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-brand-900/60">
          Ces mesures sont indicatives et ne constituent pas un diagnostic médical. L'indice de stress est une
          estimation calculée à partir de la variabilité de votre rythme cardiaque. En cas de malaise ou
          d'inquiétude, consultez un professionnel de santé.
        </p>
      </main>
    </div>
  );
}