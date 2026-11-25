import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  MessageSquare,
  Search,
  ShoppingBag,
  Stethoscope,
  Users,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { AppointmentStatusBadge, JoinCallButton } from "../components/chat/AppointmentCard";
import { cleanLabel, fmtDate, fmtDateTime } from "../components/chat/format";
import { doctorApi } from "../services/doctorApi";
import { getSocket } from "../services/socket";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const since = (d) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (min < 60) return `${min || 1} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} j`;
};

const initials = (p) => `${p?.prenom?.[0] ?? ""}${p?.nom?.[0] ?? ""}`.toUpperCase() || "?";
const fullName = (p) => `${p?.prenom ?? ""} ${p?.nom ?? ""}`.trim();
const pct = (c) => `${Math.round((Number(c) || 0) * 100)} %`;

function Avatar({ person }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {initials(person)}
    </span>
  );
}

function Stat({ icon: Icon, label, value, tone = "bg-brand-100 text-brand-700", highlight }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${highlight ? "border-coral/30" : "border-brand-100"}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 font-heading text-3xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-brand-900/55">{label}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, count, children }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold">
        <Icon size={18} className="text-brand-700" /> {title}
        {count > 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">{count}</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }) => (
  <p className="rounded-2xl bg-brand-50 px-4 py-6 text-center text-sm text-brand-900/55">{children}</p>
);

export default function DoctorSpace() {
  const user = readUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await doctorApi.dashboard());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mise à jour en direct (nouveau message, rendez-vous, nouvelle conversation), regroupée
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    const events = ["message:new", "conversation:new", "conversation:read", "appointment:update", "connect"];
    events.forEach((e) => socket.on(e, refresh));
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => socket.off(e, refresh));
    };
  }, [load]);

  const patients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.patients ?? [];
    return q ? list.filter((p) => fullName(p.patient).toLowerCase().includes(q)) : list;
  }, [data, query]);

  const hour = new Date().getHours();
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-extrabold">
              {hello} Dr {user?.prenom ?? ""} {user?.nom ?? ""}
            </h1>
            <p className="mt-1 text-sm text-brand-900/60">Votre activité du jour et les cas qui attendent votre avis.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/ordonnance/nouvelle" className="btn-primary">
              <FileText size={16} /> Nouvelle ordonnance
            </Link>
            <Link to="/marketplace" className="btn-ghost">
              <ShoppingBag size={16} /> Marketplace
            </Link>
          </div>
        </div>

        {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}

        {!data && !error && <div className="mt-6 h-64 animate-pulse rounded-3xl bg-white" />}

        {data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                icon={ClipboardList}
                label="Analyses en attente d'avis"
                value={data.stats.toTreat}
                tone="bg-coral-soft text-coral"
                highlight={data.stats.toTreat > 0}
              />
              <Stat icon={MessageSquare} label="Messages non lus" value={data.stats.unread} />
              <Stat icon={CalendarCheck} label="Rendez-vous aujourd'hui" value={data.stats.appointmentsToday} />
              <Stat icon={Users} label="Patients suivis" value={data.stats.patients} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Panel title="À traiter" icon={Stethoscope} count={data.toTreat.length}>
                {data.toTreat.length === 0 ? (
                  <Empty>Aucun cas en attente : tous les avis ont été donnés.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {data.toTreat.slice(0, 6).map((c) => (
                      <li key={c.conversationId} className="flex items-center gap-3 rounded-2xl border border-brand-100 p-3">
                        <Avatar person={c.patient} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{fullName(c.patient)}</p>
                          <p className="truncate text-xs text-brand-900/60">
                            {cleanLabel(c.lastAnalysis.prediction)} · IA {pct(c.lastAnalysis.confidence)} · en attente depuis{" "}
                            {since(c.waitingSince)}
                          </p>
                        </div>
                        <Link to={`/messages/${c.conversationId}`} className="btn-primary !px-3.5 !py-2 !text-xs">
                          Donner mon avis
                        </Link>
                      </li>
                    ))}
                    {data.toTreat.length > 6 && (
                      <p className="pt-1 text-center text-xs text-brand-900/50">
                        + {data.toTreat.length - 6} autre(s) dans la liste des patients ci-dessous
                      </p>
                    )}
                  </ul>
                )}
              </Panel>

              <Panel title="Prochains rendez-vous" icon={CalendarDays} count={data.upcoming.length}>
                {data.upcoming.length === 0 ? (
                  <Empty>Aucun rendez-vous à venir. Proposez un créneau depuis une conversation.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {data.upcoming.slice(0, 5).map((a) => (
                      <li key={a.id} className="rounded-2xl border border-brand-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold capitalize">{fmtDateTime(a.startsAt)}</p>
                            <p className="truncate text-xs text-brand-900/60">
                              {fullName(a.patient)} · {a.durationMin} min
                            </p>
                          </div>
                          <AppointmentStatusBadge status={a.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <JoinCallButton appointment={a} />
                          <Link
                            to={`/messages/${a.conversation}`}
                            className="ml-auto text-xs font-semibold text-brand-700 hover:underline"
                          >
                            Conversation
                          </Link>
                        </div>
                      </li>
                    ))}
                    <Link to="/rendez-vous" className="block pt-1 text-center text-xs font-semibold text-brand-700 hover:underline">
                      Voir tous mes rendez-vous
                    </Link>
                  </ul>
                )}
              </Panel>
            </div>

            <div className="mt-6">
              <Panel title="Mes patients" icon={Users} count={data.patients.length}>
                <label className="relative block">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-900/40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un patient…"
                    className="input !pl-11"
                  />
                </label>

                {patients.length === 0 ? (
                  <div className="mt-4">
                    <Empty>{query ? "Aucun patient ne correspond à cette recherche." : "Aucun patient pour l'instant."}</Empty>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-brand-100">
                    {patients.map((p) => (
                      <li key={p.conversationId} className="flex flex-wrap items-center gap-3 py-3">
                        <Avatar person={p.patient} />
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="flex items-center gap-2 text-sm font-bold">
                            <span className="truncate">{fullName(p.patient)}</span>
                            {p.unread > 0 && (
                              <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
                                {p.unread}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-brand-900/60">
                            {cleanLabel(p.lastAnalysis.prediction)} · IA {pct(p.lastAnalysis.confidence)} ·{" "}
                            {fmtDate(p.lastAnalysis.createdAt)}
                          </p>
                        </div>
                        {p.nextAppointment && (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            RDV {fmtDateTime(p.nextAppointment.startsAt)}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/patients/${p.conversationId}/dossier`} className="btn-ghost !px-3.5 !py-2 !text-xs">
                            <FolderOpen size={14} /> Dossier
                          </Link>
                          <Link to={`/messages/${p.conversationId}`} className="btn-ghost !px-3.5 !py-2 !text-xs">
                            <MessageSquare size={14} /> Conversation
                          </Link>
                          <Link
                            to={`/ordonnance/nouvelle?conversation=${p.conversationId}`}
                            className="btn-ghost !px-3.5 !py-2 !text-xs"
                          >
                            <FileText size={14} /> Ordonnance
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}