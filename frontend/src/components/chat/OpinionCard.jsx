import { Stethoscope } from "lucide-react";
import { VERDICTS, fmtTime } from "./format";

// Avis médical du médecin sur le résultat de l'IA (carte structurée dans la discussion)
export default function OpinionCard({ message, doctorName }) {
  const { opinion } = message;
  const verdict = VERDICTS[opinion?.verdict] ?? VERDICTS.nuance;
  const Icon = verdict.icon;

  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white">
          <Stethoscope size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Avis médical</p>
          <p className="truncate text-xs text-brand-900/55">{doctorName}</p>
        </div>
        <span className="text-[11px] text-brand-900/40">{fmtTime(message.createdAt)}</span>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${verdict.tone}`}
        >
          <Icon size={14} /> {verdict.label}
        </span>

        <p className="whitespace-pre-wrap break-words text-brand-900">{opinion?.commentaire}</p>

        {opinion?.recommandations && (
          <div className="rounded-xl bg-brand-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-900/45">
              Recommandations
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-brand-900/80">{opinion.recommandations}</p>
          </div>
        )}
      </div>
    </div>
  );
}
