import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import * as api from "../services/cardioApi";
import { Carte, Courbes, EcgCanvas, Mesure, dateTxt, dureeTxt, fmt, serie } from "../components/cardio/cardioUi";

const heure = (d) => new Date(d).toLocaleTimeString("fr-FR");

export default function CardioSession() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [ecg, setEcg] = useState(undefined); // undefined = chargement, null = indisponible
  const [erreur, setErreur] = useState("");

  const voirEcg = useCallback(async (mid) => {
    setSel(mid);
    setEcg(undefined);
    try {
      const d = await api.getMeasureEcg(mid);
      setEcg(d.ecg);
    } catch {
      setEcg(null);
    }
  }, []);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const d = await api.getSession(id);
        if (!vivant) return;
        setData(d);
        const derniere = d.measures[d.measures.length - 1];
        if (derniere) voirEcg(derniere._id);
      } catch (e) {
        if (vivant) setErreur(e?.message || "Session introuvable.");
      }
    })();
    return () => {
      vivant = false;
    };
  }, [id, voirEcg]);

  const mesures = data?.measures || [];
  const courante = mesures.find((x) => x._id === sel);

  const moyennes = useMemo(() => {
    if (!mesures.length) return { bpm: null, stress: null };
    const moy = (cle) => Math.round(mesures.reduce((a, x) => a + (x[cle] || 0), 0) / mesures.length);
    return { bpm: moy("bpm"), stress: moy("stress") };
  }, [mesures]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-50/60">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 text-brand-900">
        <Link to="/cardio" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Retour à Cardio-Santé
        </Link>

        <h1 className="mt-3 font-heading text-2xl font-extrabold sm:text-3xl">ECG enregistré</h1>

        {erreur && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {erreur}
          </p>
        )}

        {data && (
          <>
            <p className="mt-1 text-sm text-brand-900/60">
              Session du {dateTxt(data.session.startedAt)} · durée {dureeTxt(data.session.startedAt, data.session.endedAt)}
              {data.session.status === "active" && " (en cours)"}
            </p>

            <Carte>
              <div className="grid grid-cols-3 gap-4">
                <Mesure label="Mesures" value={mesures.length} />
                <Mesure label="Pouls moyen" value={fmt(moyennes.bpm, " /min")} />
                <Mesure label="Stress moyen" value={fmt(moyennes.stress, " / 100")} />
              </div>
            </Carte>

            {!mesures.length ? (
              <Carte>
                <p className="text-brand-900/70">
                  Aucune mesure n'a été enregistrée dans cette session. Une mesure est sauvegardée toutes les 30 secondes,
                  seulement quand le signal est propre, sans mouvement, et après au moins 30 secondes de signal stable.
                  Lancez une session d'au moins 2 minutes en restant immobile.
                </p>
              </Carte>
            ) : (
              <>
                <Carte titre="Courbe ECG">
                  <EcgCanvas
                    y={ecg || null}
                    pics={null}
                    vide={ecg === undefined ? "Chargement de l'ECG…" : "ECG indisponible pour cette mesure."}
                  />
                  {courante && (
                    <p className="mt-2 text-xs text-brand-900/60">
                      Extrait d'environ 8 secondes enregistré à {heure(courante.at)}.
                    </p>
                  )}

                  <h3 className="mb-2 mt-4 text-sm font-semibold">Choisir un moment de la session</h3>
                  <div className="flex flex-wrap gap-2">
                    {mesures.map((x) => (
                      <button
                        key={x._id}
                        type="button"
                        onClick={() => voirEcg(x._id)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          x._id === sel ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                        }`}
                      >
                        {heure(x.at)}
                      </button>
                    ))}
                  </div>
                </Carte>

                {courante && (
                  <Carte titre={`Indicateurs à ${heure(courante.at)}`}>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Mesure label="Fréquence cardiaque" value={fmt(courante.bpm ? Math.round(courante.bpm) : null, " /min")} />
                      <Mesure label="Stress" value={`${fmt(courante.stress)} (${courante.level || "–"})`} />
                      <Mesure label="RMSSD" value={fmt(courante.rmssd, " ms")} />
                      <Mesure label="SDNN" value={fmt(courante.sdnn, " ms")} />
                      <Mesure label="pNN50" value={fmt(courante.pnn50, " %")} />
                      <Mesure label="Battements analysés" value={fmt(courante.beats)} />
                    </div>
                  </Carte>
                )}

                {mesures.length > 1 && (
                  <Carte titre="Évolution pendant la session">
                    <Courbes series={serie(mesures)} vide="" />
                    <p className="mt-1 text-xs text-brand-900/60">
                      Trait noir : pouls (40–140) · Trait rouge : stress (0–100)
                    </p>
                  </Carte>
                )}
              </>
            )}
          </>
        )}

        <p className="mt-4 text-xs text-brand-900/60">
          Ces mesures sont indicatives et ne constituent pas un diagnostic médical.
        </p>
      </main>
    </div>
  );
}