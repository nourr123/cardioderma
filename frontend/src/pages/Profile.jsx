import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { getUser } from "../utils/getUser";
import { userApi } from "../services/userApi";

// Route de ton espace patient (celle qui affiche "Bonjour ..."), à vérifier dans App.jsx
const SPACES_PATH = "/patient";

const inputClass =
  "mt-2 w-full rounded-2xl border border-brand-900/10 bg-white px-4 py-3 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20";

// Carte : colonne flex pleine hauteur, pour que les deux cartes aient la même taille
const cardClass = "flex h-full flex-col gap-5 rounded-[2rem] bg-sand-dark p-8";

export default function Profile() {
  const navigate = useNavigate();
  const stored = getUser();

  /* ----------------------------- Informations ----------------------------- */
  const [form, setForm] = useState({
    firstName: stored.firstName || "",
    lastName: stored.lastName || "",
    email: stored.email || "",
    phone: stored.phone || "",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Recharge les données à jour depuis le backend à l'ouverture de la page
  useEffect(() => {
    userApi
      .getMe()
      .then((u) =>
        setForm({
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          email: u.email || "",
          phone: u.phone || "",
        })
      )
      .catch(() => {}); // si ça échoue, on garde les valeurs locales
  }, []);

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(SPACES_PATH);
    }
  };

  const onChange = (e) => {
    setSaved(false);
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await userApi.updateMe(form);
      const current = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...current, ...updated }));
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || "Impossible d'enregistrer. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, type = "text") => (
    <label className="block">
      <span className="text-sm font-semibold text-brand-900">{label}</span>
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={onChange}
        className={inputClass}
      />
    </label>
  );

  /* ---------------------------- Mot de passe ------------------------------ */
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const onPwdChange = (e) => {
    setPwdSaved(false);
    setPwdError("");
    setPwd({ ...pwd, [e.target.name]: e.target.value });
  };

  const onPwdSubmit = async (e) => {
    e.preventDefault();
    setPwdError("");
    setPwdSaved(false);

    if (pwd.next.length < 8) {
      return setPwdError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    }
    if (pwd.next !== pwd.confirm) {
      return setPwdError("La confirmation ne correspond pas au nouveau mot de passe.");
    }
    if (pwd.next === pwd.current) {
      return setPwdError("Le nouveau mot de passe doit être différent de l'ancien.");
    }

    setPwdSaving(true);
    try {
      await userApi.changePassword(pwd.current, pwd.next);
      setPwd({ current: "", next: "", confirm: "" });
      setPwdSaved(true);
    } catch (err) {
      setPwdError(
        err.response?.data?.message || "Impossible de modifier le mot de passe. Réessayez."
      );
    } finally {
      setPwdSaving(false);
    }
  };

  const pwdField = (name, label, autoComplete) => (
    <label className="block">
      <span className="text-sm font-semibold text-brand-900">{label}</span>
      <input
        name={name}
        type={showPwd ? "text" : "password"}
        value={pwd[name]}
        onChange={onPwdChange}
        autoComplete={autoComplete}
        required
        className={inputClass}
      />
    </label>
  );

  return (
    <div>
      <Navbar />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-800"
        >
          <ArrowLeft size={16} /> Retour à mes espaces
        </button>

        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Modifier mon profil</h1>
        <p className="mt-3 text-brand-900/60">
          Mettez à jour vos informations personnelles et votre mot de passe.
        </p>

        {/* Deux cartes de même hauteur : côte à côte sur grand écran, empilées sur mobile */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Informations personnelles */}
          <form onSubmit={onSubmit} className={cardClass}>
            <h2 className="text-xl font-bold">Informations personnelles</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              {field("firstName", "Prénom")}
              {field("lastName", "Nom")}
            </div>
            {field("email", "Adresse e-mail", "email")}
            {field("phone", "Téléphone", "tel")}

            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700">
                <AlertTriangle size={16} className="shrink-0" /> {error}
              </div>
            )}

            {/* mt-auto : le bouton reste toujours en bas de la carte */}
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <CheckCircle2 size={18} /> Profil mis à jour
                </span>
              )}
            </div>
          </form>

          {/* Mot de passe */}
          <form onSubmit={onPwdSubmit} className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Mot de passe</h2>
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-800"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPwd ? "Masquer" : "Afficher"}
              </button>
            </div>

            {pwdField("current", "Mot de passe actuel", "current-password")}
            {pwdField("next", "Nouveau mot de passe", "new-password")}
            {pwdField("confirm", "Confirmer le nouveau mot de passe", "new-password")}
            <p className="text-xs text-brand-900/60">Au moins 8 caractères.</p>

            {pwdError && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700">
                <AlertTriangle size={16} className="shrink-0" /> {pwdError}
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={pwdSaving}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {pwdSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <KeyRound size={18} />
                )}
                {pwdSaving ? "Modification..." : "Changer le mot de passe"}
              </button>
              {pwdSaved && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <CheckCircle2 size={18} /> Mot de passe modifié
                </span>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}