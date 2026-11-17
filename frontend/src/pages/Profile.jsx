import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import Navbar from "../components/Navbar";

// Route de ton espace patient (celle qui affiche "Bonjour ..."), à vérifier dans App.jsx
const SPACES_PATH = "/patient";

export default function Profile() {
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem("user") || "{}");

  const [form, setForm] = useState({
    firstName: stored.firstName || "",
    lastName: stored.lastName || "",
    email: stored.email || "",
    phone: stored.phone || "",
  });
  const [saved, setSaved] = useState(false);

  const goBack = () => {
    // idx > 0 : il existe une page précédente dans l'historique
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(SPACES_PATH);
    }
  };

  const onChange = (e) => {
    setSaved(false);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO : appeler ton backend ici (ex. PUT /api/users/me) avant la mise à jour locale
    localStorage.setItem("user", JSON.stringify({ ...stored, ...form }));
    setSaved(true);
  };

  const field = (name, label, type = "text") => (
    <label className="block">
      <span className="text-sm font-semibold text-brand-900">{label}</span>
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={onChange}
        className="mt-2 w-full rounded-2xl border border-brand-900/10 bg-white px-4 py-3 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20"
      />
    </label>
  );

  return (
    <div>
      <Navbar />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-800"
        >
          <ArrowLeft size={16} /> Retour à mes espaces
        </button>

        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Modifier mon profil</h1>
        <p className="mt-3 text-brand-900/60">
          Mettez à jour vos informations personnelles.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5 rounded-[2rem] bg-sand-dark p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {field("firstName", "Prénom")}
            {field("lastName", "Nom")}
          </div>
          {field("email", "Adresse e-mail", "email")}
          {field("phone", "Téléphone", "tel")}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800"
            >
              <Save size={18} /> Enregistrer
            </button>
            {saved && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                <CheckCircle2 size={18} /> Profil mis à jour
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}