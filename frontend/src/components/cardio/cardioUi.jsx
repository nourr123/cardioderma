import { useEffect, useRef } from "react";

/* ---------- formats ---------- */
export const fmt = (v, u = "") => (v === null || v === undefined ? "–" : `${v}${u}`);
export const dateTxt = (d) => new Date(d).toLocaleString("fr-FR");
export const dureeTxt = (debut, fin) => {
  const s = Math.max(0, Math.round(((fin ? new Date(fin) : new Date()) - new Date(debut)) / 1000));
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};

export const niveauStress = (v) => {
  if (v === null || v === undefined) return null;
  if (v < 33)
    return { label: "Faible", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bloc: "bg-emerald-50 text-emerald-900", couleur: "#34d399" };
  if (v < 66)
    return { label: "Modéré", chip: "bg-amber-50 text-amber-700 ring-amber-200", bloc: "bg-amber-50 text-amber-900", couleur: "#fbbf24" };
  return { label: "Élevé", chip: "bg-red-50 text-red-700 ring-red-200", bloc: "bg-red-50 text-red-900", couleur: "#f87171" };
};

/* ---------- dessin canvas : uniquement les valeurs réelles du capteur ---------- */
export function useCanvas(draw, deps) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function texte(ctx, t, couleur = "#6b7a76") {
  ctx.fillStyle = couleur;
  ctx.font = "15px system-ui";
  ctx.fillText(t, 20, 32);
}

export function dessinEcg(ctx, w, h, y, pics, vide = "En attente du signal…", haut = 0.08) {
  // fond de moniteur
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0b241e");
  g.addColorStop(1, "#071a15");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // quadrillage : fin et épais, comme le papier ECG
  for (let x = 0, k = 0; x <= w; x += 12, k++) {
    ctx.strokeStyle = k % 5 === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y2 = 0, k = 0; y2 <= h; y2 += 12, k++) {
    ctx.strokeStyle = k % 5 === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();
  }

  if (!y || y.length < 2) return texte(ctx, vide, "rgba(209,250,229,0.6)");

  const n = y.length;
  const moy = y.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(y.reduce((a, b) => a + (b - moy) ** 2, 0) / n);
  let lo = Math.max(Math.min(...y), moy - 5 * sd);
  let hi = Math.min(Math.max(...y), moy + 5 * sd);
  if (hi - lo < 10) {
    const c = (hi + lo) / 2;
    lo = c - 5;
    hi = c + 5;
  }
  const bas = 0.92;
  const py = (v) => h * bas - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * h * (bas - haut);
  const px = (i) => (i / (n - 1)) * w;

  // tracé avec halo lumineux
  ctx.save();
  ctx.shadowColor = "rgba(52,211,153,0.75)";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#5eead4";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  y.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.stroke();
  ctx.restore();

  // pics R détectés
  (pics || []).forEach((i) => {
    if (i >= n) return;
    ctx.fillStyle = "rgba(255,107,91,0.25)";
    ctx.beginPath();
    ctx.arc(px(i), py(y[i]), 9, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#ff6b5b";
    ctx.beginPath();
    ctx.arc(px(i), py(y[i]), 4, 0, 6.2832);
    ctx.fill();
  });
}

function dessinCourbes(ctx, w, h, series, vide) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#e6efec";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const yy = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }
  const n = series[0] ? series[0].vals.length : 0;
  if (n < 2) return texte(ctx, vide);

  series.forEach(({ vals, lo, hi, couleur, aire }) => {
    const pts = vals.map((v, i) => [
      14 + (i / (n - 1)) * (w - 28),
      h - 16 - ((Math.min(Math.max(v ?? lo, lo), hi) - lo) / (hi - lo)) * (h - 32),
    ]);
    if (aire) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `${couleur}55`);
      g.addColorStop(1, `${couleur}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], h);
      pts.forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(pts[n - 1][0], h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    if (n <= 40) {
      pts.forEach((p) => {
        ctx.fillStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.5, 0, 6.2832);
        ctx.fill();
        ctx.stroke();
      });
    }
  });
}

export const EcgCanvas = ({ y, pics, vide, haut, className = "h-72" }) => {
  const ref = useCanvas((c, w, h) => dessinEcg(c, w, h, y, pics, vide, haut), [y, pics, vide, haut]);
  return <canvas ref={ref} className={`block w-full ${className}`} />;
};

export const Courbes = ({ series, vide, legende = false }) => {
  const ref = useCanvas((c, w, h) => dessinCourbes(c, w, h, series, vide), [series, vide]);
  return (
    <div>
      {legende && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs font-semibold text-brand-900/70">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" /> Pouls (40 à 140)
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-[#ff6b5b]" /> Stress (0 à 100)
          </span>
        </div>
      )}
      <canvas ref={ref} className="block h-48 w-full rounded-2xl ring-1 ring-brand-100" />
    </div>
  );
};

export const serie = (liste) => [
  { vals: liste.map((m) => m.bpm), lo: 40, hi: 140, couleur: "#0f766e" },
  { vals: liste.map((m) => m.stress), lo: 0, hi: 100, couleur: "#ff6b5b", aire: true },
];

/* ---------- jauge de stress ---------- */
export function Jauge({ valeur }) {
  const R = 80;
  const C = 100;
  const pt = (v) => {
    const a = ((180 - v * 1.8) * Math.PI) / 180;
    return [C + R * Math.cos(a), C - R * Math.sin(a)];
  };
  const arc = (v1, v2, couleur) => {
    const [x1, y1] = pt(v1);
    const [x2, y2] = pt(v2);
    return (
      <path
        key={couleur}
        d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`}
        stroke={couleur}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity={valeur == null ? 0.25 : 1}
      />
    );
  };
  return (
    <svg viewBox="0 0 200 112" className="mx-auto w-full max-w-[18rem]" role="img" aria-label="Jauge de stress">
      {arc(0, 31, "#34d399")}
      {arc(35, 64, "#fbbf24")}
      {arc(68, 100, "#f87171")}
      {valeur != null && (
        <g
          style={{
            transform: `rotate(${Math.min(Math.max(valeur, 0), 100) * 1.8}deg)`,
            transformOrigin: "100px 100px",
            transformBox: "view-box",
            transition: "transform .9s cubic-bezier(.34,1.4,.64,1)",
          }}
        >
          <line x1="100" y1="100" x2="40" y2="100" stroke="#0f2a24" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      <circle cx="100" cy="100" r="7" fill="#0f2a24" />
    </svg>
  );
}

/* ---------- petits composants d'interface ---------- */
export const Carte = ({ titre, children, className = "" }) => (
  <section className={`my-5 rounded-3xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    {titre && <h2 className="mb-4 font-heading text-lg font-bold text-brand-900">{titre}</h2>}
    {children}
  </section>
);

export const Bouton = ({ variante = "plein", className = "", children, ...p }) => (
  <button
    type="button"
    {...p}
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50 ${
      variante === "plein"
        ? "bg-brand-700 text-white shadow-md shadow-brand-700/25 hover:bg-brand-900"
        : variante === "danger"
        ? "bg-red-600 text-white shadow-md shadow-red-600/25 hover:bg-red-700"
        : "bg-brand-50 text-brand-700 hover:bg-brand-100"
    } ${className}`}
  >
    {children}
  </button>
);

export const Mesure = ({ label, value }) => (
  <div>
    <div className="text-sm text-brand-900/60">{label}</div>
    <div className="text-xl font-bold text-brand-900">{value}</div>
  </div>
);

export const Tuile = ({ icone: Icone, label, value, hint }) => (
  <div className="rounded-2xl bg-brand-50/70 p-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-brand-900/70">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
        <Icone size={15} />
      </span>
      {label}
    </div>
    <div className="mt-2 text-2xl font-extrabold tabular-nums text-brand-900">{value}</div>
    <p className="mt-1 text-xs leading-snug text-brand-900/60">{hint}</p>
  </div>
);