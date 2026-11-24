import { useState } from "react";
import { Package } from "lucide-react";
import { imageUrl } from "../services/marketplaceApi";
import { formatPrice } from "../utils/formatPrice";

export default function ProductCard({ product: p, actions }) {
  const [imgError, setImgError] = useState(false);
  const src = imageUrl(p.image);
  const stock = Number(p.stock ?? 0);

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white transition hover:border-brand-500/40 hover:shadow-sm">
      <div className="flex aspect-[4/3] items-center justify-center bg-brand-50">
        {src && !imgError ? (
          <img
            src={src}
            alt={p.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <Package size={40} className="text-brand-600/40" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
          {p.category || "Autre"}
        </span>
        <h3 className="mt-2 font-heading text-base font-bold text-brand-900">{p.name}</h3>
        {p.description && (
          <p className="mt-1 line-clamp-2 text-sm text-brand-900/60">{p.description}</p>
        )}

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="font-heading text-lg font-extrabold text-brand-900">{formatPrice(p.price)}</p>
            <p className={`text-xs font-semibold ${stock > 0 ? "text-emerald-600" : "text-coral"}`}>
              {stock > 0 ? `${stock} en stock` : "Rupture de stock"}
            </p>
          </div>
          {actions}
        </div>
      </div>
    </article>
  );
}