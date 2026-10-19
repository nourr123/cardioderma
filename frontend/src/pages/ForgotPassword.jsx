import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import InputField from "../components/InputField";
import { authApi } from "../services/authApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Email invalide");
      return;
    }

    setLoading(true);
    setServerError("");
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Vérifiez votre boîte mail" subtitle="Demande envoyée">
        <div className="flex flex-col items-center rounded-2xl bg-brand-50 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Mail size={26} />
          </span>
          <p className="mt-4 text-sm text-brand-900/75">
            Si un compte existe avec l'adresse <b>{email}</b>, vous allez recevoir un email avec un lien pour
            choisir un nouveau mot de passe. Ce lien est valable 1 heure.
          </p>
          <p className="mt-3 text-xs text-brand-900/50">Pensez à vérifier vos courriers indésirables.</p>
        </div>
        <Link to="/login" className="btn-primary mt-6 w-full">
          Retour à la connexion
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Mot de passe oublié ?"
      subtitle="Entrez votre email, nous vous envoyons un lien de réinitialisation"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <InputField
          label="Adresse email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
            setServerError("");
          }}
          error={error}
          placeholder="exemple@email.com"
          autoComplete="email"
        />

        {serverError && (
          <p className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{serverError}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Envoi…" : "Envoyer le lien"}
        </button>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft size={16} /> Retour à la connexion
        </Link>
      </form>
    </AuthLayout>
  );
}