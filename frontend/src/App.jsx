
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
import ChooseDoctor from "./pages/ChooseDoctor";
import Messages from "./pages/Messages";
import Appointments from "./pages/Appointments";
import AnalysisHistory from "./pages/AnalysisHistory";
import AuthRoute from "./components/AuthRoute";
import PatientRecord from "./pages/PatientRecord";
import Call from "./pages/Call";
import DoctorSpace from "./pages/DoctorSpace";
import Marketplace from "./pages/Marketplace";
import Cart from "./pages/Cart";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import DoctorPrescription from "./pages/DoctorPrescription";
import Prescriptions from "./pages/Prescriptions";
import CardioSante from "./pages/CardioSante";
import CardioSession from "./pages/CardioSession";
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
      <Route path="/cardio" element={<PatientRoute><CardioSante /></PatientRoute>} /><Route path="/cardio/session/:id" element={<PatientRoute><CardioSession /></PatientRoute>} />
      <Route path="/profil" element={<Profile />} />
      <Route path="/consultation/medecin" element={<PatientRoute><ChooseDoctor /></PatientRoute>} />
      <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
      <Route path="/messages/:id" element={<AuthRoute><Messages /></AuthRoute>} />
      <Route path="/rendez-vous" element={<AuthRoute><Appointments /></AuthRoute>} />
      <Route path="/patients/:id/dossier" element={<PatientRecord />} />
      <Route path="/dermatologie/historique" element={<PatientRoute><AnalysisHistory /></PatientRoute>} />
      

      <Route path="/marketplace" element={<AuthRoute><Marketplace /></AuthRoute>} />
      <Route path="/panier" element={<AuthRoute><Cart /></AuthRoute>} />
      <Route path="/commande/succes" element={<AuthRoute><CheckoutSuccess /></AuthRoute>} />

      <Route path="/ordonnance/nouvelle" element={<AuthRoute><DoctorPrescription /></AuthRoute>} />
      <Route path="/ordonnances" element={<PatientRoute><Prescriptions /></PatientRoute>} />

      <Route path="/visio/:appointmentId" element={<Call />} />
      <Route path="/medecin" element={<DoctorSpace />} />

      {/* Marketplace et panier : réservés aux patients */}
      <Route path="/marketplace" element={<PatientRoute><Marketplace /></PatientRoute>} />
      <Route path="/panier" element={<PatientRoute><Cart /></PatientRoute>} />
      <Route path="/commande/succes" element={<PatientRoute><CheckoutSuccess /></PatientRoute>} />
    </Routes>
  );
}
