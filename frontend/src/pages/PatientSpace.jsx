import { Link } from "react-router-dom";
import { ArrowRight, Check, HeartPulse, ScanFace, ShoppingBag } from "lucide-react";
import Navbar from "../components/Navbar";
import { getUser } from "../utils/getUser";

const ECG_PATH =
  "M0 40 L50 40 L62 40 L70 22 L80 58 L90 8 L102 72 L112 40 L170 40 L182 40 L190 26 L200 52 L210 14 L222 66 L232 40 L300 40";

const SPACES = [
  {
    key: "dermatologie",
    title: "Dermatologie",
    icon: ScanFace,
    available: true,
    to: "/dermatologie",
    bar: "from-brand-500 to-brand-700",
    tint: "from-brand-50 to-white",
    iconBox: "from-brand-500 to-brand-700 shadow-brand-700/30",
    check: "bg-brand-100 text-brand-700",
    description:
      "Analyse préliminaire d'une photo de votre peau par intelligence artificielle, avec orientation vers un médecin si nécessaire.",
    features: [
      "Analyse d'image en quelques secondes",
      "Hypothèses classées par probabilité",
      "Recommandation : conseils ou avis médical",
    ],
  },
  {
    key: "cardio",
    title: "Cardio-Santé",
    icon: HeartPulse,
    available: true ,
    to: "/cardio",
    bar: "from-coral to-[#E5484D]",
    tint: "from-coral-soft to-white",
    iconBox: "from-coral to-[#E5484D] shadow-coral/30",
    check: "bg-coral-soft text-coral",
    description: "Suivi de votre rythme cardiaque à partir de votre capteur ECG connecté.",
    features: ["Courbe ECG et fréquence cardiaque", "Niveau de stress estimé", "Historique de vos mesures"],
  },
  {
    key: "marketplace",
    title: "Marketplace",
    icon: ShoppingBag,
    available: true,
    to: "/marketplace",
    bar: "from-amber-400 to-orange-500",
    tint: "from-amber-50 to-white",
    iconBox: "from-amber-400 to-orange-500 shadow-orange-500/30",
    check: "bg-amber-100 text-amber-700",
    description: "Retrouvez les produits de santé sélectionnés pour vous et ajoutez-les à votre panier.",
    features: [
      "Produits de santé sélectionnés",
      "Recherche et filtres par catégorie",
      "Panier enregistré sur votre appareil",
    ],
  },
];

function SpaceCard({ space, delay }) {
  const { title, icon: Icon, available, to, bar, tint, iconBox, check, description, features } = space;
  const isDerma = space.key === "dermatologie";
  const isCardio = space.key === "cardio";

  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={`ps-fade group relative flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white transition duration-300 ${
        available ? "hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-900/10" : ""
      }`}
    >
      {/* Bandeau coloré */}
      <div className={`h-1.5 bg-gradient-to-r ${bar}`} />

      {/* En-tête teinté */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${tint} p-5`}>
        {isCardio ? (
          <svg
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-14 w-full opacity-40"
            fill="none"
            aria-hidden="true"
          >
            <path
              className="ecg-line"
              d={ECG_PATH}
              stroke="#FF6B5B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <span
            className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl transition duration-500 group-hover:scale-125 ${
              isDerma ? "bg-brand-500/15" : "bg-amber-400/20"
            }`}
          />
        )}

        <div className="relative flex items-start justify-between">
          <span
            className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg ${iconBox}`}
          >
            <Icon size={26} className={isCardio ? "beat" : ""} />
            {isDerma && <span className="scan absolute left-0 right-0 h-0.5 bg-white/80" />}
          </span>

          {available ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Disponible
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Bientôt disponible
            </span>
          )}
        </div>

        <h2 className="relative mt-4 font-heading text-xl font-bold">{title}</h2>
        <p className="relative mt-2 text-sm leading-relaxed text-brand-900/65">{description}</p>
      </div>

      {/* Corps */}
      <div className="flex flex-1 flex-col p-5">
        <ul className="space-y-2.5 text-sm text-brand-900/80">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${check}`}>
                <Check size={12} strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          {available ? (
            <Link to={to} className="btn-primary w-full">
              Accéder à l'espace
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
          ) : (
            <button type="button" disabled className="btn-ghost w-full cursor-not-allowed opacity-60">
              Indisponible pour le moment
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PatientSpace() {
  const user = getUser() || {};
  // L'API renvoie "prenom" ; firstName / fullName restent pris en charge (mode mock)
  const firstName = user.prenom || user.firstName || user.fullName || "";

  return (
    <div className="flex min-h-screen flex-col bg-brand-50/60">
      <style>{`
        @keyframes psFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .ps-fade { animation: psFadeUp .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .ps-fade { animation: none; } }
      `}</style>

      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-8 pt-6">
        <div className="ps-fade">
          <h1 className="font-heading text-2xl font-extrabold text-brand-900 sm:text-3xl">
            Bonjour {firstName}
          </h1>
          <p className="mt-1 text-sm text-brand-900/60">Choisissez l'espace que vous souhaitez ouvrir.</p>
        </div>

        <section className="mt-5 grid flex-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SPACES.map((s, i) => (
            <SpaceCard key={s.key} space={s} delay={100 + i * 120} />
          ))}
        </section>
      </main>
    </div>
  );
}