import { request } from "./apiClient";

export const getToken = () => localStorage.getItem("token");

export const getDevice = () => request("/cardio/device");
export const createPairing = () => request("/cardio/device/pairing", { method: "POST" });
export const removeDevice = () => request("/cardio/device", { method: "DELETE" });

export const getActiveSession = () => request("/cardio/session/active");
export const startSession = () => request("/cardio/session/start", { method: "POST" });
export const stopSession = () => request("/cardio/session/stop", { method: "POST" });

export const getSessions = () => request("/cardio/sessions");
export const getSession = (id) => request(`/cardio/sessions/${id}`);
export const deleteSession = (id) => request(`/cardio/sessions/${id}`, { method: "DELETE" });
export const getMeasureEcg = (id) => request(`/cardio/measures/${id}/ecg`);