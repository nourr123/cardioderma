import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CreditCard, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import { imageUrl, orderApi } from "../services/marketplaceApi";
import { useCart } from "../context/CartContext";

export default function Cart() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { items, total, count, setQty, removeItem, clear } = useCart();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const cancelled = params.get("cancelled") === "1";

  // Réactive le bouton si on revient depuis Stripe avec le bouton "retour" du navigateur
  useEffect(() => {
    const reset = (e) => {
      if (e.persisted) setPaying(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const pay = async () => {
    setError("");
    setPaying(true);
    try {
      const { url } = await orderApi.checkout(items.map((i) => ({ id: i.id, qty: i.qty })));
      if (!url) throw new Error("Lien de paiement non reçu");
      window.location.assign(url); // redirection vers la page de paiement Stripe
    } catch (e) {
      setError(e.message);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/60">
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-10 lg:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-brand-900 lg:text-3xl">Mon panier</h1>
            <p className="mt-1 text-sm text-brand-900/60">
              {count} article{count > 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => navigate("/marketplace")} className="btn-ghost shrink-0">
            <ArrowLeft size={16} /> Marketplace
          </button>
        </div>

        {cancelled && (
          <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            <AlertTriangle size={16} /> Paiement annulé. Votre panier est conservé.
          </p>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-brand-500/30 bg-white px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ShoppingCart size={26} />
            </span>
            <p className="mt-4 font-heading text-base font-bold">Votre panier est vide</p>
            <button onClick={() => navigate("/marketplace")} className="btn-primary mt-5">
              Découvrir les produits
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <ul className="space-y-3 lg:col-span-2">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 rounded-3xl border border-brand-100 bg-white p-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50">
                    {i.image ? (
                      <img src={imageUrl(i.image)} alt={i.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={28} className="text-brand-600/40" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-base font-bold text-brand-900">{i.name}</p>
                        <p className="text-xs text-brand-900/55">{i.category}</p>
                      </div>
                      <button
                        onClick={() => removeItem(i.id)}
                        disabled={paying}
                        aria-label="Retirer du panier"
                        title="Retirer"
                        className="rounded-xl p-2 text-brand-900/40 transition hover:bg-coral-soft hover:text-coral"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50/60 p-1">
                        <button
                          onClick={() => setQty(i.id, i.qty - 1)}
                          disabled={i.qty <= 1 || paying}
                          aria-label="Diminuer la quantité"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-brand-900 transition hover:bg-white disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{i.qty}</span>
                        <button
                          onClick={() => setQty(i.id, i.qty + 1)}
                          disabled={i.qty >= i.stock || paying}
                          aria-label="Augmenter la quantité"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-brand-900 transition hover:bg-white disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="font-heading text-lg font-extrabold text-brand-900">
                        {formatPrice(i.price * i.qty)}
                      </p>
                    </div>
                    {i.qty >= i.stock && (
                      <p className="mt-1 text-xs font-medium text-coral">Stock maximum atteint ({i.stock})</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit space-y-4 rounded-3xl border border-brand-100 bg-white p-5">
              <h2 className="font-heading text-lg font-bold">Récapitulatif</h2>
              <div className="flex items-center justify-between text-sm text-brand-900/70">
                <span>Articles</span>
                <span>{count}</span>
              </div>
              <div className="flex items-center justify-between border-t border-brand-100 pt-4">
                <span className="font-semibold">Total</span>
                <span className="font-heading text-xl font-extrabold text-brand-900">{formatPrice(total)}</span>
              </div>

              {error && <p className="text-sm font-medium text-coral">{error}</p>}

              <button onClick={pay} disabled={paying} className="btn-primary w-full disabled:opacity-60">
                <CreditCard size={16} />
                {paying ? "Redirection…" : "Payer par carte"}
              </button>
              <button onClick={clear} disabled={paying} className="btn-ghost w-full">
                Vider le panier
              </button>
              <p className="text-center text-xs text-brand-900/45">Paiement sécurisé par Stripe</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}