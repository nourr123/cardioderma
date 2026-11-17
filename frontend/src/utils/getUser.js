const FIRST = ["firstName", "firstname", "first_name", "prenom", "prénom", "given_name"];
const LAST = ["lastName", "lastname", "last_name", "nom", "family_name", "surname"];
const FULL = ["fullName", "fullname", "full_name", "name", "username"];

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj && typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();
  }
  return "";
};

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const decodeJwt = (token) => {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return null;
  }
};

export function getUser() {
  // 1. objet utilisateur sous plusieurs clés possibles
  let raw =
    readJson("user") || readJson("patient") || readJson("currentUser") || readJson("profile");
  if (raw && raw.user && typeof raw.user === "object") raw = raw.user; // { user: {...} }
  if (raw && raw.patient && typeof raw.patient === "object") raw = raw.patient;

  // 2. à défaut, les infos contenues dans le token JWT
  if (!raw) {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    raw = token ? decodeJwt(token) : null;
  }

  raw = raw || {};
  const firstName = pick(raw, FIRST);
  const lastName = pick(raw, LAST);
  const full = pick(raw, FULL);

  return {
    ...raw,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || full,
  };
}