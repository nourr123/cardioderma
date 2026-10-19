import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import InputField from "../components/InputField";
import { authApi } from "../services/authApi";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
    setServerError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = {};
    if (form.password.length < 8) err.password = "8 caractères minimum";
    else if (!/[A-Z]/.test(form.password)) err.password = "Au moins une majuscule";
    if (form.confirmPassword !== form.password)
      err.confirmPassword = "Les mots de passe ne correspondent pas";
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setLoading(true);
    setServerError("");
    try {
      await authApi.resetPassword(token, form.password);
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (e) {
      setServerError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Mot de passe modifié" subtitle="Tout est en ordre">
        <div className="flex flex-col items-center rounded-2xl bg-brand-50 p-8 text-center">
          <CheckCircle2 size={44} className="text-brand-600" />
          <p className="mt-4 text-sm text-brand-900/75">
            Votre mot de passe a été réinitialisé. Vous allez être redirigé vers la connexion.
          </p>
        </div>
        <Link to="/login" className="btn-primary mt-6 w-full">
          Se connecter
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un mot de passe sécurisé">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <InputField
          label="Nouveau mot de passe"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="8 car. min. + 1 majuscule"
          autoComplete="new-password"
        />
        <InputField
          label="Confirmer le mot de passe"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          placeholder="Répéter le mot de passe"
          autoComplete="new-password"
        />

        {serverError && (
          <div className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">
            {serverError}
            <Link to="/forgot-password" className="mt-1 block font-semibold underline">
              Demander un nouveau lien
            </Link>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Enregistrement…" : "Réinitialiser le mot de passe"}
        </button>
      </form>
    </AuthLayout>
  );
}