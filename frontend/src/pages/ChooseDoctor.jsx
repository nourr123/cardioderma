import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Stethoscope } from "lucide-react";
import Navbar from "../components/Navbar";
import { consultationApi } from "../services/consultationApi";

const cleanLabel = (s = "") =>
  s.replace(/_/g, " ").replace(/\s*photos?\s*$/i, "").trim();

export default function ChooseDoctor() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [doctors, setDoctors] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    consultationApi
      .listMedecins()
      .then(setDoctors)
      .catch((e) => {
        setError(e.message);
        setDoctors([]);
      });
  }, []);

  // Accès direct sans passer par une analyse : on renvoie vers l'analyse
  if (!state?.referralToken) return <Navigate to="/dermatologie" replace />;

  const { referralToken, analysis } = state;

  const choose = async (doctor) => {
    setBusyId(doctor.id);
    setError("");
    try {
      const conv = await consultationApi.create(doctor.id, referralToken);
      navigate(`/messages/${conv.id}`);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <Link
          to="/dermatologie"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft size={16} /> Retour à l'analyse
        </Link>

        <h1 className="mt-4 font-heading text-3xl font-extrabold">Choisissez un médecin</h1>
        <p className="mt-2 text-brand-900/60">
          Votre analyse recommande un avis médical. Choisissez un dermatologue pour échanger avec lui par messagerie.
        </p>

        {analysis && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-coral-soft p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-coral" />
            <div className="text-sm">
              <p className="font-bold">
                {cleanLabel(analysis.prediction)}
                {typeof analysis.confidence === "number" && (
                  <span className="font-medium text-brand-900/60"> · confiance {Math.round(analysis.confidence * 100)} %</span>
                )}
              </p>
              <p className="mt-0.5 text-brand-900/70">{analysis.reason}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>
        )}

        <div className="mt-8 space-y-3">
          {doctors === null && (
            <p className="flex items-center gap-2 text-sm text-brand-900/60">
              <Loader2 size={16} className="animate-spin" /> Chargement des médecins…
            </p>
          )}

          {doctors?.length === 0 && !error && (
            <div className="rounded-3xl border border-dashed border-brand-500/30 bg-white px-6 py-12 text-center">
              <p className="font-bold">Aucun dermatologue disponible pour le moment</p>
              <p className="mt-1 text-sm text-brand-900/55">Réessayez plus tard.</p>
            </div>
          )}

          {doctors?.map((d) => (
            <article
              key={d.id}
              className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-500/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Stethoscope size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading font-bold">
                  Dr {d.prenom} {d.nom}
                </p>
                <p className="text-sm capitalize text-brand-900/55">{d.specialite}</p>
              </div>
              <button onClick={() => choose(d)} disabled={busyId !== null} className="btn-primary !px-5 !py-2.5">
                {busyId === d.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Écrire <ArrowRight size={16} />
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}