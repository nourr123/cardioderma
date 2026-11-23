import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  History,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanFace,
  Stethoscope,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { dermaApi } from "../services/dermaApi";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// "Acne and Rosacea Photos" -> "Acne and Rosacea" (adaptez selon vos noms de dossiers)
const cleanLabel = (s) =>
  s.replace(/_/g, " ").replace(/\s*photos?\s*$/i, "").trim();

export default function SkinAnalysis() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [consultError, setConsultError] = useState("");

  // libère l'URL de prévisualisation
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const selectFile = (f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setError("Format non supporté (JPG, PNG ou WEBP).");
    if (f.size > MAX_SIZE) return setError("L'image dépasse 5 Mo.");
    setError("");
    setConsultError("");
    setResult(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setConsultError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyze = async () => {
    setLoading(true);
    setError("");
    setConsultError("");
    try {
      setResult(await dermaApi.analyze(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const needsDoctor = result?.recommendation === "consultation";

  // Le jeton d'orientation est délivré par le serveur : il prouve que l'IA a recommandé un avis médical
  const consultDoctor = () => {
    if (!result?.referralToken) {
      setConsultError(
        "Autorisation de consultation indisponible. Relancez l'analyse ; si le problème continue, redémarrez le serveur."
      );
      return;
    }
    navigate("/consultation/medecin", {
      state: { referralToken: result.referralToken, analysis: result },
    });
  };

  return (
    <div>
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/espace" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft size={16} /> Retour à mes espaces
          </Link>
          <Link
            to="/dermatologie/historique"
            className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-200"
          >
            <History size={16} /> Mes analyses
          </Link>
        </div>

        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Analyse de la peau</h1>
        <p className="mt-2 max-w-xl text-brand-900/60">
          Envoyez une photo nette de la zone concernée, bien éclairée et de près. L'IA vous
          propose une première orientation.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {/* ZONE D'UPLOAD */}
          <div>
            {!preview ? (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}
                className={`flex h-80 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition ${
                  dragging ? "border-brand-600 bg-brand-100" : "border-brand-900/20 bg-white hover:border-brand-600"
                }`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                  <ImagePlus size={28} />
                </span>
                <p className="mt-4 font-bold">Glissez votre image ici</p>
                <p className="mt-1 text-sm text-brand-900/60">ou cliquez pour parcourir</p>
                <p className="mt-3 text-xs text-brand-900/40">JPG, PNG, WEBP · 5 Mo max</p>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
                <img src={preview} alt="Aperçu" className="h-80 w-full object-cover" />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-900/60 text-white">
                    <ScanFace size={40} className="animate-pulse" />
                    <p className="mt-3 text-sm font-medium">Analyse en cours…</p>
                  </div>
                )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => selectFile(e.target.files[0])}
            />

            {error && (
              <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button onClick={analyze} disabled={!file || loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Analyse…</>) : "Analyser l'image"}
              </button>
              {file && (
                <button onClick={reset} disabled={loading} className="btn-ghost" title="Changer d'image">
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>

          {/* RÉSULTAT */}
          <div>
            {!result ? (
              <div className="flex h-80 items-center justify-center rounded-3xl bg-sand-dark p-8 text-center text-sm text-brand-900/50">
                Le résultat de l'analyse apparaîtra ici.
              </div>
            ) : (
              <div className="rounded-3xl border border-brand-900/10 bg-white p-6">
                <div className={`flex items-start gap-3 rounded-2xl p-4 ${needsDoctor ? "bg-coral-soft" : "bg-brand-100"}`}>
                  {needsDoctor
                    ? <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={22} />
                    : <CheckCircle2 className="mt-0.5 shrink-0 text-brand-700" size={22} />}
                  <div>
                    <p className="font-bold">
                      {needsDoctor ? "Un avis médical est recommandé" : "Cas simple : conseils généraux"}
                    </p>
                    <p className="mt-0.5 text-sm text-brand-900/70">{result.reason}</p>
                  </div>
                </div>

                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-900/50">
                  Hypothèse principale
                </p>
                <p className="mt-1 text-xl font-extrabold">{cleanLabel(result.prediction)}</p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className={`h-full rounded-full ${needsDoctor ? "bg-coral" : "bg-brand-600"}`}
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-brand-900/60">
                  Confiance : {Math.round(result.confidence * 100)} %
                </p>

                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-900/50">
                  Autres possibilités
                </p>
                <ul className="mt-2 space-y-2">
                  {result.top3.map((t) => (
                    <li key={t.class} className="flex items-center justify-between text-sm">
                      <span className="pr-3">{cleanLabel(t.class)}</span>
                      <span className="font-semibold text-brand-900/70">{Math.round(t.prob * 100)} %</span>
                    </li>
                  ))}
                </ul>

                {/* Toujours affiché quand l'IA recommande un avis médical */}
                {needsDoctor && (
                  <>
                    <button onClick={consultDoctor} className="btn-primary mt-6 w-full">
                      <Stethoscope size={16} /> Consulter un médecin
                    </button>
                    {consultError && (
                      <p className="mt-3 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">
                        {consultError}
                      </p>
                    )}
                  </>
                )}

                <p className="mt-5 text-xs leading-relaxed text-brand-900/50">
                  {result.disclaimer}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
