import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/AdminDashboard";
import PatientRoute from "./components/PatientRoute";
import PatientSpace from "./pages/PatientSpace";
import SkinAnalysis from "./pages/SkinAnalysis";
import Profile from "./pages/Profile";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

      <Route path="/espace" element={<PatientRoute><PatientSpace /></PatientRoute>} />
      <Route path="/dermatologie" element={<PatientRoute><SkinAnalysis /></PatientRoute>} />
      <Route path="/profil" element={<Profile />} />
    </Routes>
  );
}