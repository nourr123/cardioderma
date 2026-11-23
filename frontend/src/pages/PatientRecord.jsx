import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ImageOff, MessageSquare, ScanFace, Stethoscope } from "lucide-react";
import Navbar from "../components/Navbar";
import { VERDICTS, cleanLabel, fmtDate } from "../components/chat/format";
import { consultationApi } from "../services/consultationApi";

function Photo({ conversationId, analysisId }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    consultationApi
      .patientAnalysisImageUrl(conversationId, analysisId)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          objectUrl = u;
          setUrl(u);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, analysisId]);

  if (failed)
    return (
      <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-900/40">
        <ImageOff size={18} />
      </span>
    );
  if (!url) return <span className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-brand-50" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Ouvrir la photo">
      <img src={url} alt="Photo analysée" className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-brand-900/10" />
    </a>
  );
}

function Card({ a, conversationId }) {
  const needsDoctor = a.recommendation === "consultation";
  const c = a.consultation;
  const op = c?.lastOpinion;
  const verdict = op && (VERDICTS[op.verdict] ?? VERDICTS.nuance);
  const VIcon = verdict?.icon;

  return (
    <li className="flex gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
      {a.hasImage && <Photo conversationId={conversationId} analysisId={a.id} />}
      <div className="min-w-0 flex-1">
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

        {a.top3?.length > 1 && (
          <p className="mt-2 text-xs text-brand-900/55">
            Hypothèses IA : {a.top3.map((t) => `${cleanLabel(t.label)} (${Math.round((t.prob ?? 0) * 100)} %)`).join(" · ")}
          </p>
        )}
        {a.reason && <p className="mt-1 text-sm text-brand-900/65">{a.reason}</p>}

        {c && (
          <div className="mt-3 rounded-xl bg-brand-50 p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-700">
              <Stethoscope size={14} /> Votre consultation
            </p>
            {op ? (
              <div className="mt-2 text-sm">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${verdict.tone}`}>
                  <VIcon size={13} /> {verdict.label}
                </span>
                <p className="mt-2 whitespace-pre-wrap text-brand-900/80">{op.commentaire}</p>
                {op.recommandations && (
                  <p className="mt-1 text-xs text-brand-900/55">Recommandations : {op.recommandations}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-brand-900/55">Pas encore d'avis médical de votre part.</p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// Dossier d'un patient : toutes ses analyses, vu par le médecin qui a une conversation avec lui
export default function PatientRecord() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    consultationApi
      .patientHistory(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to={`/messages/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Retour à la conversation
        </Link>

        {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        {!data && !error && <div className="mt-6 h-32 animate-pulse rounded-2xl bg-white" />}

        {data && (
          <>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-heading text-3xl font-extrabold">
                  Dossier de {data.patient.prenom} {data.patient.nom}
                </h1>
                <p className="mt-1 text-sm text-brand-900/60">
                  {data.analyses.length} analyse{data.analyses.length > 1 ? "s" : ""} de peau. Aide à l'orientation, pas un
                  diagnostic.
                </p>
              </div>
              <Link to={`/messages/${id}`} className="btn-ghost !px-4 !py-2 !text-xs">
                <MessageSquare size={14} /> Conversation
              </Link>
            </div>

            {data.analyses.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-brand-100 bg-white px-6 py-14 text-center">
                <ScanFace className="mx-auto text-brand-500" size={28} />
                <p className="mt-3 font-bold">Aucune analyse enregistrée</p>
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {data.analyses.map((a) => (
                  <Card key={a.id} a={a} conversationId={id} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
