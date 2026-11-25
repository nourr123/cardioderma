import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Minus, Package, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import Navbar from "../components/Navbar";
import { fmtDate } from "../components/chat/format";
import { doctorApi } from "../services/doctorApi";
import { imageUrl, marketplaceApi } from "../services/marketplaceApi";
import { prescriptionApi } from "../services/prescriptionApi";
import { formatPrice } from "../utils/formatPrice";
import { DOCTOR_HOME } from "../utils/homePath";

const fullName = (p) => `${p?.prenom ?? ""} ${p?.nom ?? ""}`.trim();

export default function DoctorPrescription() {
  const [params] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [products, setProducts] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);

  const [conversationId, setConversationId] = useState(params.get("conversation") || "");
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([doctorApi.dashboard(), marketplaceApi.getAll(), prescriptionApi.sent()]).then(
      ([d, p, s]) => {
        if (!active) return;
        if (d.status === "fulfilled") setPatients(d.value.patients ?? []);
        else setError(d.reason.message);
        if (p.status === "fulfilled") setProducts(p.value);
        else setError(p.reason.message);
        if (s.status === "fulfilled") setSent(s.value);
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const selected = patients.find((p) => p.conversationId === conversationId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const addLine = (p) => {
    setSuccess("");
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(l.quantity + 1, 99) } : l));
      }
      return [...prev, { productId: p.id, name: p.name, image: p.image, price: p.price, quantity: 1, instructions: "" }];
    });
  };

  const patchLine = (id, patch) =>
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.productId !== id));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!conversationId) return setError("Choisissez un patient");
    if (lines.length === 0) return setError("Ajoutez au moins un produit");

    setSending(true);
    try {
      await prescriptionApi.create({
        conversationId,
        note,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, instructions: l.instructions })),
      });
      setSuccess(`Ordonnance envoyée à ${fullName(selected?.patient) || "votre patient"}.`);
      setLines([]);
      setNote("");
      prescriptionApi.sent().then(setSent).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/60">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-brand-900">Nouvelle ordonnance</h1>
            <p className="mt-1 text-sm text-brand-900/60">
              Sélectionnez des produits de la marketplace et envoyez-les à l'un de vos patients.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/marketplace" className="btn-ghost">
              <ShoppingBag size={16} /> Marketplace
            </Link>
            <Link to={DOCTOR_HOME} className="btn-ghost">
              <ArrowLeft size={16} /> Retour
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 h-64 animate-pulse rounded-3xl bg-white" />
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-5">
            {/* ---------- Catalogue ---------- */}
            <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 lg:col-span-3">
              <h2 className="font-heading text-lg font-extrabold">Produits</h2>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-900/40" />
                <input
                  className="input !pl-11"
                  placeholder="Rechercher un produit ou une catégorie"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-2xl bg-brand-50 px-4 py-6 text-center text-sm text-brand-900/55">
                  Aucun produit trouvé.
                </p>
              ) : (
                <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {filtered.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-brand-100 p-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50">
                        {p.image ? (
                          <img src={imageUrl(p.image)} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package size={22} className="text-brand-600/40" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="truncate text-xs text-brand-900/60">
                          {p.category || "Autre"} · {formatPrice(p.price)}
                        </p>
                      </div>
                      <button type="button" onClick={() => addLine(p)} className="btn-ghost !px-3.5 !py-2 !text-xs">
                        <Plus size={14} /> Ajouter
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ---------- Ordonnance ---------- */}
            <section className="h-fit space-y-4 rounded-3xl border border-brand-100 bg-white p-5 lg:col-span-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold">
                <FileText size={18} className="text-brand-700" /> Ordonnance
              </h2>

              <select
                className="input"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                aria-label="Patient"
              >
                <option value="">Choisir un patient…</option>
                {patients.map((p) => (
                  <option key={p.conversationId} value={p.conversationId}>
                    {fullName(p.patient)}
                  </option>
                ))}
              </select>

              {lines.length === 0 ? (
                <p className="rounded-2xl bg-brand-50 px-4 py-6 text-center text-sm text-brand-900/55">
                  Aucun produit ajouté pour l'instant.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lines.map((l) => (
                    <li key={l.productId} className="space-y-2 rounded-2xl border border-brand-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold">{l.name}</p>
                        <button
                          type="button"
                          onClick={() => removeLine(l.productId)}
                          aria-label="Retirer"
                          className="rounded-lg p-1.5 text-brand-900/40 transition hover:bg-coral-soft hover:text-coral"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50/60 p-1 w-fit">
                        <button
                          type="button"
                          onClick={() => patchLine(l.productId, { quantity: Math.max(1, l.quantity - 1) })}
                          disabled={l.quantity <= 1}
                          aria-label="Diminuer"
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white disabled:opacity-40"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold">{l.quantity}</span>
                        <button
                          type="button"
                          onClick={() => patchLine(l.productId, { quantity: Math.min(99, l.quantity + 1) })}
                          aria-label="Augmenter"
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <input
                        className="input !py-2 text-sm"
                        placeholder="Posologie (ex : 1 application matin et soir)"
                        value={l.instructions}
                        onChange={(e) => patchLine(l.productId, { instructions: e.target.value })}
                        maxLength={300}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <textarea
                className="input min-h-[80px]"
                placeholder="Note pour le patient (facultatif)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />

              {error && <p className="text-sm font-medium text-coral">{error}</p>}
              {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

              <button type="submit" disabled={sending} className="btn-primary w-full disabled:opacity-60">
                {sending ? "Envoi…" : "Envoyer l'ordonnance"}
              </button>
            </section>
          </form>
        )}

        {/* ---------- Historique ---------- */}
        {!loading && sent.length > 0 && (
          <section className="mt-6 rounded-3xl border border-brand-100 bg-white p-5">
            <h2 className="font-heading text-lg font-extrabold">Ordonnances envoyées</h2>
            <ul className="mt-4 divide-y divide-brand-100">
              {sent.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-semibold">{fullName(s.patient) || "Patient"}</span>
                  <span className="text-xs text-brand-900/60">
                    {s.items.length} produit{s.items.length > 1 ? "s" : ""} · {fmtDate(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}