import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  ImageOff,
  MessageSquare,
  Send,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import Navbar from "../components/Navbar";
import OpinionCard from "../components/chat/OpinionCard";
import OpinionModal from "../components/chat/OpinionModal";
import AppointmentCard from "../components/chat/AppointmentCard";
import AppointmentModal from "../components/chat/AppointmentModal";
import { cleanLabel } from "../components/chat/format";
import { consultationApi } from "../services/consultationApi";
import { appointmentApi } from "../services/appointmentApi";
import { getSocket } from "../services/socket";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const time = (d) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const dayLabel = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// L'interlocuteur : le médecin pour un patient, le patient pour un médecin
const otherOf = (conv, role) => (role === "medecin" ? conv.patient : conv.medecin);
const displayName = (p, role) => `${role === "patient" ? "Dr " : ""}${p.prenom ?? ""} ${p.nom ?? ""}`.trim();

function Avatar({ person, role }) {
  const Icon = role === "medecin" ? User : Stethoscope;
  const initials = `${person.prenom?.[0] ?? ""}${person.nom?.[0] ?? ""}`.toUpperCase();
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {initials || <Icon size={18} />}
    </span>
  );
}

/* --------------------------- Photo analysée (protégée) -------------------------- */
function AnalysisPhoto({ conversationId }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    consultationApi
      .imageUrl(conversationId)
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
  }, [conversationId]);

  // Échap ferme l'agrandissement
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (failed) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-brand-900/50">
        <ImageOff size={14} /> Photo indisponible
      </p>
    );
  }
  if (!url) return <div className="mt-3 h-28 animate-pulse rounded-xl bg-white/60" />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block overflow-hidden rounded-xl ring-1 ring-brand-900/10 transition hover:ring-2 hover:ring-brand-600"
        title="Agrandir la photo"
      >
        <img src={url} alt="Photo analysée" className="h-28 w-full object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-900/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <img
            src={url}
            alt="Photo analysée"
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ------------------------------- Liste (gauche) ------------------------------ */
function ConversationList({ conversations, activeId, role, loading }) {
  return (
    <aside className="flex min-h-0 flex-col border-brand-100 bg-white md:w-80 md:shrink-0 md:border-r">
      <div className="border-b border-brand-100 px-5 py-4">
        <h1 className="font-heading text-lg font-extrabold">Messagerie</h1>
        <p className="text-xs text-brand-900/50">
          {role === "medecin" ? "Vos patients" : "Vos médecins"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && conversations.length === 0 && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MessageSquare size={22} />
            </span>
            <p className="mt-4 text-sm font-bold">Aucune conversation</p>
            <p className="mt-1 text-xs text-brand-900/55">
              {role === "medecin"
                ? "Les patients orientés vers vous apparaîtront ici."
                : "Une conversation s'ouvre quand l'analyse de votre peau recommande un avis médical."}
            </p>
          </div>
        )}

        {conversations.map((c) => {
          const other = otherOf(c, role);
          const active = c.id === activeId;
          return (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className={`flex items-center gap-3 border-b border-brand-100/70 px-5 py-4 transition ${
                active ? "bg-brand-50" : "hover:bg-brand-50/60"
              }`}
            >
              <Avatar person={other} role={role} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{displayName(other, role)}</p>
                  {c.lastMessage && (
                    <span className="shrink-0 text-[11px] text-brand-900/45">{time(c.lastMessage.createdAt)}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-brand-900/55">
                    {c.lastMessage?.text ?? cleanLabel(c.analysis?.prediction) ?? "Nouvelle conversation"}
                  </p>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

/* ------------------------------- Discussion (droite) ------------------------------ */
function Chat({
  conversation,
  role,
  me,
  messages,
  appointments,
  typing,
  onSend,
  onTyping,
  onOpinion,
  onCreateAppointment,
  onAppointmentAct,
  busyAppointment,
}) {
  const [text, setText] = useState("");
  const [showOpinion, setShowOpinion] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const other = otherOf(conversation, role);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  const submit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    setError("");
    const res = await onSend(value);
    setSending(false);

    if (res?.ok) {
      setText("");
      onTyping(false);
    } else {
      setError(res?.error || "Message non envoyé");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  };

  let lastDay = "";

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-brand-50/40">
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b border-brand-100 bg-white px-4 py-3 md:px-6">
        <Link to="/messages" className="rounded-full p-2 text-brand-900/60 hover:bg-brand-50 md:hidden" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <Avatar person={other} role={role} />
        <div className="min-w-0">
          <p className="truncate font-heading font-bold">{displayName(other, role)}</p>
          <p className="text-xs text-brand-900/50">
            {typing ? <span className="font-semibold text-brand-600">écrit…</span> : role === "medecin" ? "Patient" : "Dermatologue"}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {role === "medecin" && (
            <button
              type="button"
              onClick={() => setShowOpinion(true)}
              className="btn-primary !px-3.5 !py-2 !text-xs"
            >
              <Stethoscope size={14} /> <span className="hidden sm:inline">Donner mon avis</span>
              <span className="sm:hidden">Avis</span>
            </button>
          )}
          {role === "medecin" && (
            <button
              type="button"
              onClick={() => setShowAppointment(true)}
              className="btn-ghost !px-3.5 !py-2 !text-xs"
            >
              <CalendarPlus size={14} /> <span className="hidden sm:inline">Proposer un rendez-vous</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-5 md:px-6">
        {/* Résumé de l'analyse IA : visible par le médecin comme par le patient */}
        {conversation.analysis?.prediction && (
          <div className="mx-auto mb-4 max-w-md rounded-2xl border border-coral/20 bg-coral-soft p-4 text-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-coral">
              <AlertTriangle size={14} /> Analyse IA à l'origine de la demande
            </p>
            <p className="mt-2 font-bold">{cleanLabel(conversation.analysis.prediction)}</p>
            {typeof conversation.analysis.confidence === "number" && (
              <p className="text-xs text-brand-900/60">
                Confiance : {Math.round(conversation.analysis.confidence * 100)} %
              </p>
            )}
            <p className="mt-1 text-xs text-brand-900/70">{conversation.analysis.reason}</p>
            {conversation.hasImage && <AnalysisPhoto conversationId={conversation.id} />}
            <p className="mt-2 text-[11px] text-brand-900/45">
              Aide à l'orientation, ne constitue pas un diagnostic médical.
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-brand-900/45">
            {role === "patient"
              ? "Décrivez votre problème au médecin pour commencer."
              : "Aucun message pour l'instant."}
          </p>
        )}

        {messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;

          let body;
          if (m.type === "opinion" && m.opinion) {
            body = <OpinionCard message={m} doctorName={displayName(conversation.medecin, "patient")} />;
          } else if (m.type === "appointment") {
            body = (
              <AppointmentCard
                appointment={appointments[m.appointmentId]}
                role={role}
                onAct={onAppointmentAct}
                busy={busyAppointment?.id === m.appointmentId ? busyAppointment.action : null}
              />
            );
          } else if (m.type === "system") {
            body = (
              <p className="mx-auto w-fit max-w-[90%] rounded-full bg-brand-100/70 px-4 py-1.5 text-center text-xs font-medium text-brand-900/70">
                {m.text}
              </p>
            );
          } else {
            const mine = m.sender === me;
            body = (
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-sm bg-brand-700 text-white"
                      : "rounded-bl-sm border border-brand-100 bg-white text-brand-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/60" : "text-brand-900/40"}`}>
                    {time(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="py-0.5">
              {showDay && (
                <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-900/35">{day}</p>
              )}
              {body}
            </div>
          );
        })}

        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-brand-100 bg-white px-4 py-3">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Saisie */}
      <form onSubmit={submit} className="border-t border-brand-100 bg-white p-3 md:p-4">
        {error && <p className="mb-2 px-2 text-xs font-medium text-coral">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onBlur={() => onTyping(false)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Écrivez votre message…"
            className="input max-h-32 min-h-[46px] flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="btn-primary !px-4 !py-3"
            aria-label="Envoyer"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      {showOpinion && <OpinionModal onClose={() => setShowOpinion(false)} onSubmit={onOpinion} />}
      {showAppointment && (
        <AppointmentModal role={role} onClose={() => setShowAppointment(false)} onSubmit={onCreateAppointment} />
      )}
    </section>
  );
}

/* ----------------------------------- Page ---------------------------------- */
export default function Messages() {
  const { id: activeId } = useParams();
  const navigate = useNavigate();
  const user = readUser();
  const me = user?._id ?? user?.id;
  const role = user?.role === "medecin" ? "medecin" : "patient";

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [appointments, setAppointments] = useState({}); // id -> rendez-vous
  const [busyAppointment, setBusyAppointment] = useState(null);
  const [typingId, setTypingId] = useState(null);
  const [error, setError] = useState("");

  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const typingTimer = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await consultationApi.list());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Historique de la conversation ouverte + marquage "lu"
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages([]);
    consultationApi
      .messages(activeId)
      .then((m) => !cancelled && setMessages(m))
      .catch((e) => !cancelled && setError(e.message));

    setAppointments({});
    consultationApi
      .listAppointments(activeId)
      .then((list) => !cancelled && setAppointments(Object.fromEntries(list.map((a) => [a.id, a]))))
      .catch(() => {});

    consultationApi.markRead(activeId).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Temps réel
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = ({ message, conversation }) => {
      const isActive = activeRef.current === message.conversation;

      if (isActive) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        if (message.type === "appointment") {
          consultationApi
            .listAppointments(message.conversation)
            .then((list) => {
              if (activeRef.current === message.conversation)
                setAppointments(Object.fromEntries(list.map((a) => [a.id, a])));
            })
            .catch(() => {});
        }
        if (message.sender !== me) {
          socket.emit("conversation:read", { conversationId: message.conversation });
          conversation = { ...conversation, unread: 0 };
        }
      }

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversation.id);
        const next = exists ? prev.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...prev];
        return [...next].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    const onConversationNew = ({ conversation }) =>
      setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));

    const onTypingEvent = ({ conversationId, typing }) => {
      setTypingId(typing ? conversationId : null);
      clearTimeout(typingTimer.current);
      if (typing) typingTimer.current = setTimeout(() => setTypingId(null), 4000);
    };

    const onAppointment = ({ appointment }) => {
      if (appointment.conversation !== activeRef.current) return;
      setAppointments((prev) => ({ ...prev, [appointment.id]: appointment }));
    };

    socket.on("appointment:update", onAppointment);
    socket.on("message:new", onNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("typing", onTypingEvent);
    socket.on("connect", loadConversations); // resynchronise après une coupure

    return () => {
      socket.off("appointment:update", onAppointment);
      socket.off("message:new", onNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("typing", onTypingEvent);
      socket.off("connect", loadConversations);
      clearTimeout(typingTimer.current);
    };
  }, [me, loadConversations]);

  const send = (text) =>
    new Promise((resolve) => {
      const socket = getSocket();
      if (!socket?.connected) return resolve({ ok: false, error: "Connexion perdue, réessayez dans un instant" });
      socket.timeout(8000).emit("message:send", { conversationId: activeId, text }, (err, res) => {
        resolve(err ? { ok: false, error: "Le serveur ne répond pas" } : res);
      });
    });

  // Ajoute localement un message renvoyé par l'API (le socket le diffuse aussi : dédoublonnage par id)
  const appendMessage = (message) =>
    message && setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));

  const giveOpinion = async (body) => appendMessage(await consultationApi.postOpinion(activeId, body));

  const createAppointment = async (body) => {
    const { appointment, message } = await consultationApi.createAppointment(activeId, body);
    setAppointments((prev) => ({ ...prev, [appointment.id]: appointment }));
    appendMessage(message);
  };

  const actOnAppointment = async (appointmentId, action) => {
    setBusyAppointment({ id: appointmentId, action });
    try {
      const { appointment, message } = await appointmentApi.act(appointmentId, action);
      setAppointments((prev) => ({ ...prev, [appointment.id]: appointment }));
      appendMessage(message);
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusyAppointment(null);
    }
  };

  const sendTyping = (typing) => getSocket()?.emit("typing", { conversationId: activeId, typing });

  const active = conversations.find((c) => c.id === activeId);
  // Conversation demandée mais introuvable (lien invalide) : retour à la liste
  useEffect(() => {
    if (!loading && !error && activeId && !active) navigate("/messages", { replace: true });
  }, [loading, error, activeId, active, navigate]);

  return (
    <div className="flex h-screen flex-col bg-brand-50/60">
      <Navbar />

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 px-3 pb-4 pt-3 md:px-6">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
          {/* Mobile : liste OU discussion. Bureau : les deux */}
          <div className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-auto`}>
            <ConversationList conversations={conversations} activeId={activeId} role={role} loading={loading} />
          </div>

          <div className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>
            {active ? (
              <Chat
                key={active.id}
                conversation={active}
                role={role}
                me={me}
                messages={messages}
                appointments={appointments}
                typing={typingId === active.id}
                onSend={send}
                onTyping={sendTyping}
                onOpinion={giveOpinion}
                onCreateAppointment={createAppointment}
                onAppointmentAct={actOnAppointment}
                busyAppointment={busyAppointment}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-brand-50/40 px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                  <MessageSquare size={26} />
                </span>
                <p className="mt-4 font-heading font-bold">Sélectionnez une conversation</p>
                {error && <p className="mt-3 text-sm font-medium text-coral">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
