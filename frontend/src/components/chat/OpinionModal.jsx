import { useEffect, useState } from "react";
import { Loader2, Stethoscope, X } from "lucide-react";
import { VERDICTS } from "./format";

// Fenêtre où le médecin donne son avis sur le résultat de l'IA
export default function OpinionModal({ onClose, onSubmit }) {
  const [verdict, setVerdict] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [recommandations, setRecommandations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!verdict) return setError("Indiquez si vous confirmez, nuancez ou ne confirmez pas l'analyse de l'IA.");
    if (!commentaire.trim()) return setError("Rédigez votre avis médical.");

    setBusy(true);
    setError("");
    try {
      await onSubmit({ verdict, commentaire, recommandations });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-900/50 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Stethoscope size={22} />
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="rounded-full p-2 text-brand-900/50 transition hover:bg-brand-50"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="mt-4 font-heading text-xl font-extrabold">Donner mon avis médical</h2>
        <p className="mt-1 text-sm text-brand-900/60">
          Complétez ou nuancez le résultat de l'IA. Votre avis sera visible par le patient et conservé dans la
          conversation.
        </p>

        <fieldset className="mt-5 space-y-2">
          <legend className="mb-1 text-sm font-semibold">Votre position sur l'analyse de l'IA</legend>
          {Object.entries(VERDICTS).map(([key, v]) => (
            <label
              key={key}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition ${
                verdict === key ? "border-brand-600 bg-brand-50" : "border-brand-100 hover:border-brand-500/50"
              }`}
            >
              <input
                type="radio"
                name="verdict"
                value={key}
                checked={verdict === key}
                onChange={() => {
                  setVerdict(key);
                  setError("");
                }}
                className="mt-1 accent-brand-700"
              />
              <span>
                <span className="block text-sm font-bold">{v.label}</span>
                <span className="block text-xs text-brand-900/55">{v.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="mt-5 block">
          <span className="text-sm font-semibold">
            Votre avis <span className="text-coral">*</span>
          </span>
          <textarea
            value={commentaire}
            onChange={(e) => {
              setCommentaire(e.target.value);
              setError("");
            }}
            rows={4}
            maxLength={2000}
            placeholder="Votre appréciation du cas, de la photo et du résultat de l'IA…"
            className="input mt-1.5 resize-none"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold">
            Recommandations <span className="font-normal text-brand-900/45">(optionnel)</span>
          </span>
          <textarea
            value={recommandations}
            onChange={(e) => setRecommandations(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Conduite à tenir, examens, délai de surveillance…"
            className="input mt-1.5 resize-none"
          />
        </label>

        {error && <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Envoyer mon avis"}
          </button>
        </div>
      </form>
    </div>
  );
}
