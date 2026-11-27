import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/cardioApi";

// Adresse du backend (sans /api)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function useCardioLive() {
  const [live, setLive] = useState({
    socketUp: false,
    deviceOnline: false,
    state: null,
    metrics: null,
    signal: null,
    signalAt: 0,
    stateAt: 0,
  });
  const [lastMeasure, setLastMeasure] = useState(null);
  const [sessionEvt, setSessionEvt] = useState(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/cardio`, { auth: { token: getToken() } });
    const set = (patch) => setLive((s) => ({ ...s, ...patch }));

    socket.on("connect", () => set({ socketUp: true }));
    socket.on("disconnect", () => set({ socketUp: false, deviceOnline: false }));
    socket.on("connect_error", () => set({ socketUp: false }));

    socket.on("device:status", (d) =>
      set(
        d.online
          ? { deviceOnline: true }
          : { deviceOnline: false, signal: null, metrics: null, state: null }
      )
    );
    socket.on("device:state", (d) => set({ state: d, stateAt: Date.now() }));
    socket.on("signal", (d) => set({ signal: d, signalAt: Date.now() }));
    socket.on("metrics", (d) => set({ metrics: d }));
    socket.on("measure:saved", (m) => setLastMeasure(m));
    socket.on("session:update", (d) => setSessionEvt({ ...d, at: Date.now() }));

    return () => socket.disconnect();
  }, []);

  return { ...live, lastMeasure, sessionEvt };
}