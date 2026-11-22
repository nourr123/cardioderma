import { io } from "socket.io-client";

// "http://localhost:5000/api" -> "http://localhost:5000"
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL.replace(/\/api\/?$/, "");

let socket = null;

// Une seule connexion partagée par toute l'application
export function getSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token }, autoConnect: true });
  }
  return socket;
}

// À appeler à la déconnexion
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}