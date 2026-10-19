import { request } from "./apiClient";

export const authApi = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),

  registerPatient: (data) =>
    request("/auth/register/patient", { method: "POST", body: data }),

  // formData : champs + fichier(s) "justificatifs"
  registerMedecin: (formData) =>
    request("/auth/register/medecin", { method: "POST", body: formData }),

  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: { email } }),

  // Le nom exact du champ attendu n'est pas visible dans le code reçu :
  // on envoie les variantes courantes, les champs en trop sont ignorés.
  resetPassword: (token, password) =>
    request(`/auth/reset-password/${token}`, {
      method: "POST",
      body: { password, newPassword: password, confirmPassword: password },
    }),
};