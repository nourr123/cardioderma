import { Navigate } from "react-router-dom";

// Accessible à tout utilisateur connecté (patient ou médecin)
export default function AuthRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}