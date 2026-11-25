import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FileText, Search, ShoppingBag, ShoppingCart } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { marketplaceApi } from "../services/marketplaceApi";
import { useCart } from "../context/CartContext";
import { homePath, isDoctor } from "../utils/homePath";

export default function Marketplace() {
  const navigate = useNavigate();
  const { addItem, count } = useCart();
  const doctor = isDoctor();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [justAdded, setJustAdded] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    marketplaceApi
      .getAll()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => clearTimeout(timer.current);
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category || "Autre"))],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || (p.category || "Autre") === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
    );
  }, [products, search, category]);

  const handleAdd = (p) => {
    if (!addItem(p)) return;
    setJustAdded(p.id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(null), 1500);
  };

  return (
    <div className="min-h-screen bg-brand-50/60">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-10 lg:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-brand-900 lg:text-3xl">Marketplace</h1>
            <p className="mt-1 text-sm text-brand-900/60">Les produits de santé sélectionnés pour vous.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {doctor ? (
              <button onClick={() => navigate("/ordonnance/nouvelle")} className="btn-ghost">
                <FileText size={16} /> Nouvelle ordonnance
              </button>
            ) : (
              <button onClick={() => navigate("/ordonnances")} className="btn-ghost">
                <FileText size={16} /> Mes ordonnances
              </button>
            )}
            <button onClick={() => navigate("/panier")} className="btn-primary relative" aria-label="Voir le panier">
              <ShoppingCart size={16} /> Panier
              {count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </button>
            <button onClick={() => navigate(homePath())} className="btn-ghost">
              <ArrowLeft size={16} /> Retour
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-900/40" />
          <input
            className="input !pl-11"
            placeholder="Rechercher un produit"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {["all", ...categories].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === c ? "bg-brand-900 text-white" : "bg-white text-brand-900/70 hover:text-brand-900"
                }`}
              >
                {c === "all" ? "Tous" : c}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm font-medium text-coral">{error}</p>}

        {!loading && !error && filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-brand-500/30 bg-white px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ShoppingBag size={26} />
            </span>
            <p className="mt-4 font-heading text-base font-bold">Aucun produit disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const outOfStock = Number(p.stock ?? 0) <= 0;
              const added = justAdded === p.id;
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  actions={
                    <button
                      onClick={() => handleAdd(p)}
                      disabled={outOfStock}
                      className="btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {added ? (
                        <>
                          <Check size={16} /> Ajouté
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={16} /> Ajouter
                        </>
                      )}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}