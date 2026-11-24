import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImagePlus, Pencil, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import ProductCard from "./ProductCard";
import { imageUrl, marketplaceApi } from "../services/marketplaceApi";

const EMPTY = { name: "", description: "", price: "", category: "", stock: "", image: "", file: null };
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

export default function AdminMarketplace({ notify }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null); // null = fermé | objet = ajout ou édition (id présent)
  const [preview, setPreview] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await marketplaceApi.getAll());
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!form && !toDelete) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) {
        setForm(null);
        setToDelete(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, toDelete, busy]);

  // Aperçu local de l'image choisie
  const selectedFile = form?.file || null;
  useEffect(() => {
    if (!selectedFile) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  // En ajout : image obligatoire. En modification : optionnelle.
  const valid =
    form &&
    form.name.trim() &&
    form.price !== "" &&
    Number(form.price) >= 0 &&
    (form.id || form.file);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permet de re-choisir le même fichier
    if (!f) return;
    if (!f.type.startsWith("image/")) return notify("Le fichier doit être une image", "error");
    if (f.size > MAX_SIZE) return notify("Image trop lourde (5 Mo maximum)", "error");
    setForm((prev) => ({ ...prev, file: f }));
  };

  const save = async () => {
    const { id, file } = form;

    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("description", form.description);
    data.append("category", form.category.trim() || "Autre");
    data.append("price", String(Number(form.price)));
    data.append("stock", String(Number(form.stock || 0)));
    if (file) data.append("image", file); // même nom que .single("image") côté backend

    setBusy(true);
    try {
      if (id) await marketplaceApi.update(id, data);
      else await marketplaceApi.create(data);
      notify(id ? "Produit modifié" : "Produit ajouté");
      setForm(null);
      await load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await marketplaceApi.remove(toDelete.id);
      notify("Produit supprimé");
      setToDelete(null);
      await load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const shownImage = preview || imageUrl(form?.image);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-900/40" />
          <input
            className="input !pl-11"
            placeholder="Rechercher un produit ou une catégorie"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setForm({ ...EMPTY })} className="btn-primary">
          <Plus size={16} /> Ajouter un produit
        </button>
      </div>

      <p className="text-sm text-brand-900/55">
        {filtered.length} produit{filtered.length > 1 ? "s" : ""}
      </p>

      {!loading && filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-brand-500/30 bg-white px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <ShoppingBag size={26} />
          </span>
          <p className="mt-4 font-heading text-base font-bold">Aucun produit</p>
          <p className="mt-1 max-w-xs text-sm text-brand-900/55">
            Ajoutez votre premier produit, il sera visible par les patients.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        description: p.description || "",
                        price: p.price,
                        category: p.category || "",
                        stock: p.stock ?? 0,
                        image: p.image || "",
                        file: null,
                      })
                    }
                    title="Modifier"
                    aria-label="Modifier"
                    className="rounded-xl p-2 text-brand-900/50 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    title="Supprimer"
                    aria-label="Supprimer"
                    className="rounded-xl p-2 text-brand-900/40 transition hover:bg-coral-soft hover:text-coral"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* ---------- Formulaire ajout / modification ---------- */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/50 p-4 backdrop-blur-sm"
          onClick={() => !busy && setForm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-xl font-extrabold">
              {form.id ? "Modifier le produit" : "Ajouter un produit"}
            </h2>

            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Nom du produit (obligatoire)" value={form.name} onChange={set("name")} autoFocus />
              <textarea className="input min-h-[80px]" placeholder="Description" value={form.description} onChange={set("description")} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" type="number" min="0" step="0.01" placeholder="Prix en DT (obligatoire)" value={form.price} onChange={set("price")} />
                <input className="input" type="number" min="0" placeholder="Stock" value={form.stock} onChange={set("stock")} />
              </div>
              <input className="input" placeholder="Catégorie (ex : Tensiomètre, Crème…)" value={form.category} onChange={set("category")} />

              {/* Upload d'image */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-500/40 p-4 text-center text-sm text-brand-900/60 transition hover:bg-brand-50">
                {shownImage ? (
                  <>
                    <img
                      src={shownImage}
                      alt="Aperçu"
                      className="h-32 w-full rounded-xl object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    <span className="text-xs font-semibold text-brand-700">Cliquer pour changer l'image</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={28} />
                    <span>
                      Choisir une image{!form.id && " (obligatoire)"} — JPG, PNG, WEBP, 5 Mo max
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setForm(null)} disabled={busy} className="btn-ghost">
                Annuler
              </button>
              <button onClick={save} disabled={busy || !valid} className="btn-primary disabled:opacity-60">
                {busy ? "En cours…" : form.id ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Confirmation suppression ---------- */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/50 p-4 backdrop-blur-sm"
          onClick={() => !busy && setToDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-soft text-coral">
              <Trash2 size={22} />
            </span>
            <h2 className="mt-4 font-heading text-xl font-extrabold">Supprimer ce produit ?</h2>
            <p className="mt-1 text-sm text-brand-900/65">« {toDelete.name} » ne sera plus visible par les patients.</p>
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-coral">
              <AlertTriangle size={16} /> Cette action est irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} disabled={busy} className="btn-ghost">
                Annuler
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "En cours…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}