import { CalendarDays, Check, Clock, Loader2, X } from "lucide-react";
import { APPOINTMENT_STATUS, fmtDateTime, personName } from "./format";

// Boutons disponibles selon le statut et le rôle de la personne connectée.
// Réutilisé dans la messagerie ET dans la page "Rendez-vous".
export function appointmentActions(appointment, role) {
  const { status, proposedBy, startsAt } = appointment;
  const actions = [];

  if (status === "propose") {
    if (proposedBy !== role) {
      actions.push({ action: "accept", label: "Accepter", icon: Check, primary: true });
      actions.push({ action: "decline", label: "Refuser", icon: X });
    } else {
      actions.push({ action: "cancel", label: "Annuler la proposition", icon: X });
    }
  } else if (status === "confirme") {
    if (role === "medecin" && new Date(startsAt) <= new Date()) {
      actions.push({ action: "complete", label: "Marquer comme terminée", icon: Check, primary: true });
    }
    actions.push({ action: "cancel", label: "Annuler le rendez-vous", icon: X });
  }
  return actions;
}

export function AppointmentStatusBadge({ status }) {
  const [label, tone, dot] = APPOINTMENT_STATUS[status] ?? [status, "bg-gray-100 text-gray-600", "bg-gray-400"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function AppointmentActions({ appointment, role, onAct, busy }) {
  const actions = appointmentActions(appointment, role);
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ action, label, icon: Icon, primary }) => (
        <button
          key={action}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onAct(appointment.id, action)}
          className={`${primary ? "btn-primary" : "btn-ghost"} !px-4 !py-2 !text-xs`}
        >
          {busy === action ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
          {label}
        </button>
      ))}
    </div>
  );
}

// Carte de rendez-vous dans la discussion (se met à jour en direct)
export default function AppointmentCard({ appointment, role, onAct, busy }) {
  if (!appointment) {
    return <div className="mx-auto h-24 w-full max-w-lg animate-pulse rounded-2xl bg-white/70" />;
  }

  const proposer =
    appointment.proposedBy === role
      ? "Proposé par vous"
      : `Proposé par ${personName(appointment.proposedBy === "medecin" ? appointment.medecin : appointment.patient, appointment.proposedBy)}`;

  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <CalendarDays size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Rendez-vous · consultation en ligne</p>
          <p className="mt-0.5 font-heading text-base font-bold capitalize">{fmtDateTime(appointment.startsAt)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-900/55">
            <Clock size={12} /> {appointment.durationMin} min · {proposer}
          </p>
          {appointment.note && (
            <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900/70">{appointment.note}</p>
          )}
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      {appointmentActions(appointment, role).length > 0 && (
        <div className="border-t border-brand-100 bg-brand-50/40 px-4 py-3">
          <AppointmentActions appointment={appointment} role={role} onAct={onAct} busy={busy} />
        </div>
      )}
    </div>
  );
}
