import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, ScanFace, Stethoscope } from "lucide-react";
import Navbar from "../components/Navbar";
import { VERDICTS, cleanLabel, fmtDate } from "../components/chat/format";
import { analysisApi } from "../services/analysisApi";

function Card({ a }) {
  const needsDoctor = a.recommendation === "consultation";
  const c = a.consultation;
  const op = c?.lastOpinion;
  const verdict = op && (VERDICTS[op.verdict] ?? VERDICTS.nuance);
  const VIcon = verdict?.icon;

  return (
    <li className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-bold">{cleanLabel(a.prediction)}</p>
          <p className="text-xs text-brand-900/50">
            {fmtDate(a.createdAt)} · confiance {Math.round((a.confidence ?? 0) * 100)} %
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            needsDoctor ? "bg-coral-soft text-coral" : "bg-brand-100 text-brand-800"
          }`}
        >
          {needsDoctor ? "Avis médical recommandé" : "Conseils généraux"}
        </span>
      </div>

      {a.reason && <p className="mt-2 text-sm text-brand-900/65">{a.reason}</p>}

      {c ? (
        <div className="mt-4 rounded-xl bg-brand-50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            <Stethoscope size={14} /> Consultation avec Dr {c.medecin?.prenom} {c.medecin?.nom}
          </p>
          {op ? (
            <div className="mt-2 text-sm">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${verdict.tone}`}>
                <VIcon size={13} /> {verdict.label}
              </span>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-brand-900/80">{op.commentaire}</p>
              {op.recommandations && (
                <p className="mt-1 line-clamp-2 text-xs text-brand-900/55">Recommandations : {op.recommandations}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-brand-900/55">Pas encore d'avis médical.</p>
          )}
          <Link
            to={`/messages/${c.conversationId}`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
          >
            <MessageSquare size={14} /> Ouvrir la conversation
          </Link>
        </div>
      ) : null}
    </li>
  );
}

export default function AnalysisHistory() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    analysisApi
      .history()
      .then(setAnalyses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/espace" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Retour à mes espaces
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Mes analyses</h1>
        <p className="mt-1 text-sm text-brand-900/60">
          Historique de vos analyses de peau et des avis médicaux reçus. Aide à l'orientation, pas un diagnostic.
        </p>

        {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        {loading ? (
          <div className="mt-6 h-32 animate-pulse rounded-2xl bg-white" />
        ) : analyses.length === 0 && !error ? (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-100 bg-white px-6 py-14 text-center">
            <ScanFace className="mx-auto text-brand-500" size={28} />
            <p className="mt-3 font-bold">Aucune analyse pour l'instant</p>
            <Link to="/dermatologie" className="btn-primary mt-5 inline-flex">
              Analyser ma peau
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {analyses.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
