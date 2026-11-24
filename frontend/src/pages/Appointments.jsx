import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, MessageSquare } from "lucide-react";
import Navbar from "../components/Navbar";
import { AppointmentActions, AppointmentStatusBadge, JoinCallButton } from "../components/chat/AppointmentCard";
import { fmtDateTime, personName } from "../components/chat/format";
import { appointmentApi } from "../services/appointmentApi";
import { getSocket } from "../services/socket";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

function Row({ a, role, onAct, busy }) {
  const other = role === "medecin" ? a.patient : a.medecin;
  return (
    <li className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <CalendarDays size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-heading font-bold capitalize">{fmtDateTime(a.startsAt)}</p>
            <p className="text-sm text-brand-900/70">
              avec {personName(other, role === "medecin" ? "patient" : "medecin")}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-900/50">
              <Clock size={12} /> {a.durationMin} min
              {a.proposedBy === role ? " · proposé par vous" : ""}
            </p>
            {a.note && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900/70">{a.note}</p>}
          </div>
        </div>
        <AppointmentStatusBadge status={a.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
        <JoinCallButton appointment={a} />
        <AppointmentActions appointment={a} role={role} onAct={onAct} busy={busy?.id === a.id ? busy.action : null} />
        <Link
          to={`/messages/${a.conversation}`}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
        >
          <MessageSquare size={14} /> Ouvrir la conversation
        </Link>
      </div>
    </li>
  );
}

export default function Appointments() {
  const user = readUser();
  const role = user?.role === "medecin" ? "medecin" : "patient";

  const [data, setData] = useState({ upcoming: [], history: [] });
  const [tab, setTab] = useState("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await appointmentApi.listMine());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mise à jour en direct quand l'autre personne répond
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("appointment:update", load);
    socket.on("connect", load);
    return () => {
      socket.off("appointment:update", load);
      socket.off("connect", load);
    };
  }, [load]);

  const act = async (id, action) => {
    setBusy({ id, action });
    try {
      await appointmentApi.act(id, action);
      await load();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const list = data[tab];

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-heading text-3xl font-extrabold">Rendez-vous</h1>
        <p className="mt-1 text-sm text-brand-900/60">
          {role === "medecin"
            ? "Proposez un créneau depuis une conversation ; le patient l'accepte ou le refuse."
            : "Le médecin vous propose un créneau dans la messagerie ; vous l'acceptez ou le refusez."}
        </p>

        <div className="mt-6 inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-brand-100">
          {[
            ["upcoming", "À venir", data.upcoming.length],
            ["history", "Historique", data.history.length],
          ].map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                tab === key ? "bg-brand-700 text-white" : "text-brand-900/70 hover:bg-brand-50"
              }`}
            >
              {label} <span className="opacity-60">({n})</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        {loading ? (
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-white" />
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-100 bg-white px-6 py-14 text-center">
            <CalendarDays className="mx-auto text-brand-500" size={28} />
            <p className="mt-3 font-bold">{tab === "upcoming" ? "Aucun rendez-vous à venir" : "Aucun rendez-vous passé"}</p>
            <p className="mt-1 text-sm text-brand-900/55">
              {role === "medecin" ? "Ouvrez une conversation pour proposer un créneau." : "Votre médecin vous proposera un créneau dans la messagerie."}
            </p>
            <Link to="/messages" className="btn-primary mt-5 inline-flex">
              Aller à la messagerie
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {list.map((a) => (
              <Row key={a.id} a={a} role={role} onAct={act} busy={busy} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
