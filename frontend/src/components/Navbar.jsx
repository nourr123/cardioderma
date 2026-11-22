import { Link, NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, LayoutGrid, LogOut, MessageSquare, UserCog } from "lucide-react";
import Logo from "./Logo";
import { disconnectSocket } from "../services/socket";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

// Bouton de navigation : surligné quand on est sur la page correspondante
function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 rounded-full whitespace-nowrap px-3.5 py-2 text-sm font-semibold transition lg:px-4 ${
          isActive ? "bg-brand-100 text-brand-800" : "text-brand-900 hover:bg-brand-900/5"
        }`
      }
    >
      <Icon size={16} />
      <span className="hidden lg:inline">{children}</span>
    </NavLink>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const user = readUser();
  const isLoggedIn = Boolean(localStorage.getItem("token") || user);
  const isDoctor = user?.role === "medecin";

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-brand-900/10 bg-white/80 py-2.5 pl-5 pr-2.5 shadow-sm backdrop-blur-md">
        <Logo />

        {isLoggedIn ? (
          <nav className="flex items-center gap-1.5">
            {/* Le patient a un espace (Cardio / Dermatologie) ; le médecin arrive directement sur sa messagerie */}
            {!isDoctor && (
              <NavItem to="/espace" icon={LayoutGrid}>
                Mon espace
              </NavItem>
            )}
            <NavItem to="/messages" icon={MessageSquare}>
              Messages
            </NavItem>
            <NavItem to="/rendez-vous" icon={CalendarDays}>
              Rendez-vous
            </NavItem>
            <NavItem to="/profil" icon={UserCog}>
              Modifier mon profil
            </NavItem>

            <span className="mx-1 h-6 w-px bg-brand-900/10" aria-hidden="true" />

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 lg:px-5"
              aria-label="Déconnexion"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline">Déconnexion</span>
            </button>
          </nav>
        ) : (
          <>
            <nav className="hidden items-center gap-8 text-sm font-medium text-brand-900/75 md:flex">
              <a href="/#espaces" className="transition hover:text-brand-700">Espaces</a>
              <a href="/#etapes" className="transition hover:text-brand-700">Comment ça marche</a>
              <a href="/#fonctionnalites" className="transition hover:text-brand-700">Fonctionnalités</a>
            </nav>

            <div className="flex items-center gap-1">
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-brand-900/5"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
