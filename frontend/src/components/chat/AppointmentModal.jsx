import { useEffect, useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { toLocalInput } from "./format";

const DURATIONS = [15, 30, 45, 60];
const MIN_LEAD_MIN = 15; // le serveur exige au moins 10 minutes

// Le médecin PROPOSE un créneau ; le patient en DEMANDE un. L'autre personne répond.
export default function AppointmentModal({ role, onClose, onSubmit }) {
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doctor = role === "medecin";
  const min = toLocalInput(new Date(Date.now() + MIN_LEAD_MIN * 60 * 1000));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!startsAt) return setError("Choisissez une date et une heure.");

    setBusy(true);
    setError("");
    try {
      // datetime-local = heure locale du navigateur -> ISO (UTC) pour le serveur
      await onSubmit({ startsAt: new Date(startsAt).toISOString(), durationMin, note });
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
        className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <CalendarPlus size={22} />
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

        <h2 className="mt-4 font-heading text-xl font-extrabold">
          {doctor ? "Proposer un rendez-vous" : "Demander un rendez-vous"}
        </h2>
        <p className="mt-1 text-sm text-brand-900/60">
          Consultation en ligne.{" "}
          {doctor
            ? "Le patient pourra accepter ou refuser ce créneau."
            : "Le médecin pourra accepter ou refuser ce créneau."}
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-semibold">Date et heure</span>
          <input
            type="datetime-local"
            value={startsAt}
            min={min}
            onChange={(e) => {
              setStartsAt(e.target.value);
              setError("");
            }}
            className="input mt-1.5"
          />
        </label>

        <div className="mt-4">
          <span className="text-sm font-semibold">Durée</span>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMin(d)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold transition ${
                  durationMin === d
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-brand-100 text-brand-900/70 hover:border-brand-500/50"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold">
            Message <span className="font-normal text-brand-900/45">(optionnel)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ex. : plutôt en fin de journée"
            className="input mt-1.5 resize-none"
          />
        </label>

        {error && <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" /> : doctor ? "Proposer" : "Envoyer la demande"}
          </button>
        </div>
      </form>
    </div>
  );
}
