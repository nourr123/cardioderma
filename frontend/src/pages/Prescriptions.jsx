import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Package, ShoppingCart } from "lucide-react";
import { fmtDate } from "../components/chat/format";
import { useCart } from "../context/CartContext";
import { imageUrl } from "../services/marketplaceApi";
import { prescriptionApi } from "../services/prescriptionApi";
import { formatPrice } from "../utils/formatPrice";

export default function Prescriptions() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null); // { id, text }

  useEffect(() => {
    prescriptionApi
      .mine()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addAll = (prescription) => {
    let added = 0;
    let skipped = 0;
    prescription.items.forEach((it) => {
      if (it.product && addItem(it.product, it.quantity)) added++;
      else skipped++;
    });
    const text =
      added > 0
        ? `${added} produit${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} au panier` +
          (skipped > 0 ? ` · ${skipped} indisponible${skipped > 1 ? "s" : ""}` : "")
        : "Aucun produit disponible pour le moment";
    setFeedback({ id: prescription.id, text, ok: added > 0 });
  };

  return (
    <div className="min-h-screen bg-brand-50/60">
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-10 lg:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-brand-900 lg:text-3xl">Mes ordonnances</h1>
            <p className="mt-1 text-sm text-brand-900/60">Les produits recommandés par vos médecins.</p>
          </div>
          <button onClick={() => navigate("/marketplace")} className="btn-ghost shrink-0">
            <ArrowLeft size={16} /> Marketplace
          </button>
        </div>

        {error && <p className="text-sm font-medium text-coral">{error}</p>}

        {!loading && !error && list.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-brand-500/30 bg-white px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <FileText size={26} />
            </span>
            <p className="mt-4 font-heading text-base font-bold">Aucune ordonnance pour le moment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((p) => {
              const total = p.items.reduce((s, it) => s + (it.product ? it.product.price * it.quantity : 0), 0);
              return (
                <article key={p.id} className="rounded-3xl border border-brand-100 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-base font-bold">
                        Dr {p.doctor?.prenom} {p.doctor?.nom}
                      </p>
                      <p className="text-xs text-brand-900/55">{fmtDate(p.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                      {p.items.length} produit{p.items.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {p.note && (
                    <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900/75">{p.note}</p>
                  )}

                  <ul className="mt-4 space-y-3">
                    {p.items.map((it, idx) => (
                      <li key={`${p.id}-${idx}`} className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50">
                          {it.product?.image ? (
                            <img src={imageUrl(it.product.image)} alt={it.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package size={22} className="text-brand-600/40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {it.name} <span className="font-semibold text-brand-900/55">× {it.quantity}</span>
                          </p>
                          {it.instructions && <p className="text-xs text-brand-900/65">{it.instructions}</p>}
                          {!it.product ? (
                            <p className="text-xs font-medium text-coral">Produit indisponible</p>
                          ) : it.product.stock <= 0 ? (
                            <p className="text-xs font-medium text-coral">Rupture de stock</p>
                          ) : null}
                        </div>
                        {it.product && (
                          <p className="shrink-0 text-sm font-semibold">{formatPrice(it.product.price * it.quantity)}</p>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-4">
                    <p className="font-heading text-lg font-extrabold">{formatPrice(total)}</p>
                    <button onClick={() => addAll(p)} className="btn-primary">
                      <ShoppingCart size={16} /> Ajouter au panier
                    </button>
                  </div>

                  {feedback?.id === p.id && (
                    <p className={`mt-3 text-sm font-medium ${feedback.ok ? "text-emerald-600" : "text-coral"}`}>
                      {feedback.text}
                      {feedback.ok && (
                        <>
                          {" · "}
                          <Link to="/panier" className="underline">
                            Voir le panier
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}