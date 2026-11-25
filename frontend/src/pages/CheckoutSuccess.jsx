import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";import { orderApi } from "../services/marketplaceApi";
import { useCart } from "../context/CartContext";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { clear } = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("Session de paiement introuvable");
      setLoading(false);
      return;
    }
    let active = true;
    orderApi
      .confirm(sessionId)
      .then((o) => {
        if (!active) return;
        setOrder(o);
        if (o.status === "paid") clear(); // on vide le panier seulement si le paiement est confirmé
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sessionId, clear]);

  const paid = order?.status === "paid";

  return (
    <div className="min-h-screen bg-brand-50/60">
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-brand-100 bg-white p-8 text-center">
          {loading ? (
            <p className="text-sm text-brand-900/60">Vérification du paiement…</p>
          ) : error ? (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral-soft text-coral">
                <AlertTriangle size={26} />
              </span>
              <h1 className="mt-4 font-heading text-xl font-extrabold">Une erreur est survenue</h1>
              <p className="mt-1 text-sm text-brand-900/60">{error}</p>
            </>
          ) : (
            <>
              <span
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                  paid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                }`}
              >
                {paid ? <Check size={28} strokeWidth={3} /> : <AlertTriangle size={26} />}
              </span>
              <h1 className="mt-4 font-heading text-xl font-extrabold">
                {paid ? "Paiement confirmé" : "Paiement en attente"}
              </h1>
              <p className="mt-1 text-sm text-brand-900/60">
                {paid
                  ? "Merci pour votre commande !"
                  : "Votre paiement n'est pas encore confirmé. Rechargez cette page dans quelques instants."}
              </p>

              {order && (
                <ul className="mt-6 space-y-2 border-t border-brand-100 pt-4 text-left text-sm">
                  {order.items.map((i) => (
                    <li key={i.product} className="flex justify-between gap-3">
                      <span className="truncate">
                        {i.name} × {i.quantity}
                      </span>
                      <span className="shrink-0 font-semibold">{formatPrice(i.price * i.quantity)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-brand-100 pt-3 font-heading text-base font-extrabold">
                    <span>Total</span>
                    <span>{formatPrice(order.total)}</span>
                  </li>
                </ul>
              )}
            </>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link to="/marketplace" className="btn-primary">
              Retour à la marketplace
            </Link>
            <Link to="/espace" className="btn-ghost">
              Mon espace
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}