import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Check, Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { appointmentApi } from "../services/appointmentApi";
import { getSocket } from "../services/socket";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Caméra + micro ; à défaut caméra seule ou micro seul ; sinon null (on pourra seulement regarder).
async function getMedia() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Votre navigateur ne permet pas l'accès à la caméra (HTTPS requis hors localhost).");
  }
  const attempts = [{ video: true, audio: true }, { audio: true }, { video: true }];
  let busy = false;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        throw new Error("Autorisez l'accès à la caméra et au micro dans votre navigateur, puis réessayez.");
      }
      if (e.name === "NotReadableError" || e.name === "AbortError") busy = true;
    }
  }
  if (busy) {
    throw new Error("Votre caméra ou votre micro est utilisé par une autre application ou un autre navigateur. Fermez-la puis réessayez.");
  }
  return null; // aucun périphérique : on rejoint en mode « spectateur »
}

// Consultation vidéo en WebRTC : la vidéo passe directement entre les deux navigateurs.
// Le serveur Socket.IO ne sert qu'à les mettre en relation (signalisation).
export default function Call() {
  const { appointmentId } = useParams();
  const user = readUser();

  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const cleanupRef = useRef(() => {});

  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState("init"); // init | waiting | connecting | connected | ended | error
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [info, setInfo] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasCam, setHasCam] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let pc = null;
    let stream = null;
    let iceServers = [];
    let pending = [];
    let joined = false;

    const socket = getSocket();
    const fail = (msg) => {
      if (cancelled) return;
      setError(msg);
      setPhase("error");
    };
    if (!socket) {
      fail("Vous n'êtes plus connecté. Reconnectez-vous.");
      return;
    }

    const send = (data) => socket.emit("call:signal", { appointmentId, data });

    const closePeer = () => {
      if (pc) {
        pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
      }
      if (remoteRef.current) remoteRef.current.srcObject = null;
    };

    const createPc = () => {
      closePeer();
      pc = new RTCPeerConnection({ iceServers });
      stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Sans micro ou sans caméra locale, on reste capable de RECEVOIR l'autre personne
      if (!stream?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
      if (!stream?.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });

      pc.onicecandidate = (e) => e.candidate && send({ candidate: e.candidate });
      pc.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
      };
      pc.onconnectionstatechange = () => {
        if (!pc || cancelled) return;
        const s = pc.connectionState;
        if (s === "connected") {
          setPhase("connected");
          setWarning("");
        } else if (s === "disconnected") {
          setWarning("Connexion instable…");
        } else if (s === "failed") {
          setWarning(
            "La connexion directe a échoué. Votre réseau bloque peut-être la vidéo : essayez un autre réseau, ou demandez l'ajout d'un serveur TURN."
          );
        }
      };
      return pc;
    };

    // Celui qui était déjà dans la salle lance l'appel quand l'autre arrive
    const makeOffer = async () => {
      pending = [];
      const p = createPc();
      setPhase("connecting");
      await p.setLocalDescription(await p.createOffer());
      send({ sdp: p.localDescription });
    };

    const flushPending = async () => {
      const list = pending;
      pending = [];
      for (const c of list) await pc?.addIceCandidate(c).catch(() => {});
    };

    const onSignal = async ({ data }) => {
      try {
        if (data?.sdp?.type === "offer") {
          const p = createPc();
          setPhase("connecting");
          await p.setRemoteDescription(data.sdp);
          await flushPending();
          await p.setLocalDescription(await p.createAnswer());
          send({ sdp: p.localDescription });
        } else if (data?.sdp?.type === "answer") {
          if (pc?.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(data.sdp);
            await flushPending();
          }
        } else if (data?.candidate !== undefined) {
          if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else pending.push(data.candidate);
        }
      } catch {
        setWarning("Erreur de connexion vidéo. Raccrochez puis rejoignez à nouveau.");
      }
    };

    const onPeerJoined = () => makeOffer().catch(() => setWarning("Impossible de démarrer l'appel."));
    const onPeerLeft = () => {
      closePeer();
      pending = [];
      setWarning("");
      setPhase("waiting");
    };
    const onReplaced = () => {
      cleanup();
      fail("La consultation a été ouverte dans un autre onglet ou sur un autre appareil.");
    };

    const join = () =>
      new Promise((resolve) => {
        socket.emit("call:join", { appointmentId }, (res) => {
          if (cancelled) return resolve();
          if (!res?.ok) {
            fail(res?.error || "Impossible de rejoindre la consultation.");
            return resolve();
          }
          joined = true;
          iceServers = res.iceServers || [];
          setInfo({ peer: res.peer, role: res.role, appointment: res.appointment });
          // L'autre est déjà là : il va m'envoyer une offre. Sinon j'attends son arrivée.
          setPhase(res.peerPresent ? "connecting" : "waiting");
          resolve();
        });
      });

    // Reconnexion du socket (coupure réseau) : on rejoint la salle
    const onConnect = () => {
      if (joined) join();
    };

    function cleanup() {
      cancelled = true;
      socket.off("call:signal", onSignal);
      socket.off("call:peer-joined", onPeerJoined);
      socket.off("call:peer-left", onPeerLeft);
      socket.off("call:replaced", onReplaced);
      socket.off("connect", onConnect);
      if (joined) socket.emit("call:leave");
      closePeer();
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cleanupRef.current = () => {};
    }
    cleanupRef.current = cleanup;

    (async () => {
      try {
        stream = await getMedia();
      } catch (e) {
        return fail(e.message);
      }
      if (cancelled) return stream?.getTracks().forEach((t) => t.stop());

      streamRef.current = stream;
      setHasCam(Boolean(stream?.getVideoTracks().length));
      setHasMic(Boolean(stream?.getAudioTracks().length));
      if (localRef.current) localRef.current.srcObject = stream;

      socket.on("call:signal", onSignal);
      socket.on("call:peer-joined", onPeerJoined);
      socket.on("call:peer-left", onPeerLeft);
      socket.on("call:replaced", onReplaced);
      socket.on("connect", onConnect);
      await join();
    })();

    return cleanup;
  }, [appointmentId, attempt]);

  // Chronomètre de la consultation
  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const toggle = (kind) => {
    const tracks = kind === "audio" ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    if (!tracks?.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    kind === "audio" ? setMicOn(next) : setCamOn(next);
  };

  const hangUp = useCallback(() => {
    cleanupRef.current();
    setPhase("ended");
  }, []);

  const rejoin = () => {
    setError("");
    setWarning("");
    setSeconds(0);
    setMicOn(true);
    setCamOn(true);
    setPhase("init");
    setAttempt((a) => a + 1);
  };

  const peerName = info?.peer
    ? `${info.role === "patient" ? "Dr " : ""}${info.peer.prenom ?? ""} ${info.peer.nom ?? ""}`.trim()
    : "";

  if (phase === "ended") {
    return <Ended role={user?.role} appointmentId={appointmentId} info={info} onRejoin={rejoin} seconds={seconds} />;
  }
  if (phase === "error") {
    return (
      <Screen>
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="font-heading text-xl font-extrabold">Consultation indisponible</h1>
          <p className="mt-3 text-sm text-brand-900/70">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/rendez-vous" className="btn-ghost">
              Mes rendez-vous
            </Link>
            <button type="button" onClick={rejoin} className="btn-primary">
              Réessayer
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  const waiting = phase === "init" || phase === "waiting" || phase === "connecting";

  return (
    <div className="flex h-screen flex-col bg-brand-900 text-white">
      <header className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold">
            Consultation{peerName ? ` avec ${peerName}` : ""}
          </p>
          <p className="text-xs text-white/55">
            {phase === "connected" ? `En ligne · ${mmss(seconds)}` : "Consultation en ligne"}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          Connexion directe chiffrée
        </span>
      </header>

      {!hasCam && !hasMic && phase !== "init" && (
        <p className="mx-4 mb-2 rounded-xl bg-white/10 px-4 py-2 text-center text-xs text-white/70">
          Aucune caméra ni micro détecté : vous voyez et entendez l'autre personne, mais elle ne vous voit pas.
        </p>
      )}

      <main className="relative mx-4 mb-2 flex-1 overflow-hidden rounded-3xl bg-black/40">
        <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />

        {waiting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="animate-spin text-white/70" size={30} />
            <p className="font-semibold">
              {phase === "waiting"
                ? `En attente de ${peerName || "l'autre participant"}…`
                : phase === "connecting"
                  ? "Connexion en cours…"
                  : "Préparation de la caméra…"}
            </p>
            {phase === "waiting" && (
              <p className="max-w-xs text-xs text-white/55">
                Gardez cette page ouverte : la vidéo démarre dès que l'autre personne rejoint.
              </p>
            )}
          </div>
        )}

        {warning && (
          <p className="absolute left-1/2 top-4 max-w-md -translate-x-1/2 rounded-xl bg-amber-500/90 px-4 py-2 text-center text-xs font-semibold text-brand-900">
            {warning}
          </p>
        )}

        <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-2xl bg-brand-800 shadow-lg ring-2 ring-white/20 sm:h-40 sm:w-56">
          <video ref={localRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {(!hasCam || !camOn) && (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-800 text-xs text-white/60">
              Caméra coupée
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-center gap-3 px-4 py-4">
        <RoundButton onClick={() => toggle("audio")} off={!micOn || !hasMic} disabled={!hasMic} label={micOn ? "Couper le micro" : "Activer le micro"}>
          {micOn && hasMic ? <Mic size={20} /> : <MicOff size={20} />}
        </RoundButton>
        <RoundButton
          onClick={() => toggle("video")}
          off={!camOn || !hasCam}
          disabled={!hasCam}
          label={camOn ? "Couper la caméra" : "Activer la caméra"}
        >
          {camOn && hasCam ? <Video size={20} /> : <VideoOff size={20} />}
        </RoundButton>
        <button
          type="button"
          onClick={hangUp}
          aria-label="Raccrocher"
          title="Raccrocher"
          className="flex h-14 w-20 items-center justify-center rounded-full bg-coral text-white transition hover:brightness-110"
        >
          <PhoneOff size={22} />
        </button>
      </footer>
    </div>
  );
}

function Screen({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-brand-900 p-4">{children}</div>;
}

function RoundButton({ children, off, label, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition disabled:opacity-40 ${
        off ? "bg-white text-brand-900" : "bg-white/15 text-white hover:bg-white/25"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

// Écran de fin : le médecin peut clôturer le rendez-vous
function Ended({ role, appointmentId, info, onRejoin, seconds }) {
  const [state, setState] = useState("idle"); // idle | busy | done
  const [err, setErr] = useState("");
  const canComplete = role === "medecin" && info?.appointment && new Date(info.appointment.startsAt) <= new Date();

  const complete = async () => {
    setState("busy");
    setErr("");
    try {
      await appointmentApi.act(appointmentId, "complete");
      setState("done");
    } catch (e) {
      setErr(e.message);
      setState("idle");
    }
  };

  return (
    <Screen>
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Check size={26} />
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold">Consultation terminée</h1>
        {seconds > 0 && <p className="mt-1 text-sm text-brand-900/60">Durée : {mmss(seconds)}</p>}

        {canComplete && state !== "done" && (
          <button type="button" onClick={complete} disabled={state === "busy"} className="btn-primary mt-6 w-full">
            {state === "busy" ? <Loader2 size={16} className="animate-spin" /> : "Marquer le rendez-vous comme terminé"}
          </button>
        )}
        {state === "done" && <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Rendez-vous marqué comme terminé.</p>}
        {err && <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{err}</p>}

        <div className="mt-4 flex justify-center gap-2">
          <Link to="/rendez-vous" className="btn-ghost">
            <CalendarDays size={16} /> Mes rendez-vous
          </Link>
          {state !== "done" && (
            <button type="button" onClick={onRejoin} className="btn-ghost">
              Rejoindre à nouveau
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}