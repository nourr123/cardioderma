import { Link } from "react-router-dom";
import { Activity, ArrowRight, ScanFace } from "lucide-react";
import Navbar from "../components/Navbar";
import { getUser } from "../utils/getUser";

export default function PatientSpace() {
  const user = getUser();

  return (
    <div>
      <Navbar />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          Bonjour {user.fullName} 
        </h1>
        <p className="mt-3 text-brand-900/60">
          Choisissez l'espace que vous souhaitez ouvrir.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="rounded-[2rem] bg-brand-900 p-8 text-white">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral">
              <Activity size={24} />
            </span>
            <h2 className="mt-8 text-2xl font-bold">Cardio-Santé</h2>
            <p className="mt-2 text-white/60">Suivez votre rythme cardiaque.</p>
            <span className="mt-6 inline-block rounded-full bg-white/10 px-4 py-2 text-sm text-white/70">
              Bientôt disponible
            </span>
          </article>

          <Link
            to="/dermatologie"
            className="group rounded-[2rem] bg-sand-dark p-8 transition hover:shadow-lg"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white">
              <ScanFace size={24} />
            </span>
            <h2 className="mt-8 text-2xl font-bold">Dermatologie intelligente</h2>
            <p className="mt-2 text-brand-900/60">Analysez une photo de votre peau.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-800">
              Ouvrir{" "}
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}