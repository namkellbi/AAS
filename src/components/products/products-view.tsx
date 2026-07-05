'use client';

import { Pause, Pencil, Play, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { AssetLibraryItem, Product } from '@/lib/types';
import { cn } from '@/lib/utils';

const emptyProduct = (): Product => ({
  id: '',
  name: '',
  affiliateLink: '',
  price: 0,
  commissionPercent: 0,
  category: '',
  marketplace: 'tiktok_shop',
  status: 'active',
  demoAssetId: undefined,
  notes: '',
  createdAt: '',
  updatedAt: ''
});

export function ProductsView({
  assets,
  copy,
  products,
  onDelete,
  onSave
}: {
  assets: AssetLibraryItem[];
  copy: TranslationCopy;
  products: Product[];
  onDelete: (id: string) => Promise<void>;
  onSave: (product: Product) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const [editing, setEditing] = useState(false);
  const demoClips = assets.filter((asset) => asset.type === 'product');

  async function saveDraft() {
    if (!draft.name.trim()) return;
    await onSave({ ...draft, id: draft.id || crypto.randomUUID() });
    setDraft(emptyProduct());
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">{copy.products}</h2>
        <p className="mt-1 text-sm text-muted">{copy.productsHelp}</p>
      </div>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">{editing ? copy.editProduct : copy.addProduct}</h3>
          {editing ? (
            <Button
              className="px-2"
              icon={<X className="size-4" />}
              onClick={() => {
                setDraft(emptyProduct());
                setEditing(false);
              }}
            />
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input placeholder={copy.productNameLabel} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <Input placeholder={copy.affiliateLink} value={draft.affiliateLink} onChange={(event) => setDraft({ ...draft, affiliateLink: event.target.value })} />
          <Input placeholder={copy.categoryLabel} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
          <label className="grid gap-1.5 text-[11px] font-medium text-muted">
            {copy.priceLabel}
            <Input type="number" min="0" value={String(draft.price)} onChange={(event) => setDraft({ ...draft, price: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="grid gap-1.5 text-[11px] font-medium text-muted">
            {copy.commissionPercent}
            <Input type="number" min="0" max="100" step="0.5" value={String(draft.commissionPercent)} onChange={(event) => setDraft({ ...draft, commissionPercent: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="grid gap-1.5 text-[11px] font-medium text-muted">
            {copy.marketplaceLabel}
            <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.marketplace} onChange={(event) => setDraft({ ...draft, marketplace: event.target.value === 'shopee' ? 'shopee' : event.target.value === 'other' ? 'other' : 'tiktok_shop' })}>
              <option value="tiktok_shop">TikTok Shop</option>
              <option value="shopee">Shopee</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[11px] font-medium text-muted">
            {copy.demoClip}
            <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.demoAssetId ?? ''} onChange={(event) => setDraft({ ...draft, demoAssetId: event.target.value || undefined })}>
              <option value="">—</option>
              {demoClips.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.label}</option>
              ))}
            </select>
          </label>
          <Input placeholder={copy.productNotes} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </div>
        <Button className="mt-3" variant="primary" icon={<Plus className="size-4" />} disabled={!draft.name.trim()} onClick={saveDraft}>
          {editing ? copy.saveChanges : copy.addProduct}
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className={cn('rounded-lg border bg-panel p-4', product.status === 'paused' ? 'border-border opacity-60' : 'border-border')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text">{product.name}</span>
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', product.status === 'active' ? 'bg-success/15 text-emerald-200' : 'bg-panelSoft text-muted')}>
                    {product.status === 'active' ? copy.productStatusActive : copy.productStatusPaused}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {product.category || '—'} · {product.marketplace === 'tiktok_shop' ? 'TikTok Shop' : product.marketplace === 'shopee' ? 'Shopee' : 'Other'} · {currency(product.price)} · {product.commissionPercent}%
                </div>
                {product.affiliateLink ? <div className="mt-1 truncate text-xs text-sky-200">{product.affiliateLink}</div> : null}
                {product.notes ? <div className="mt-2 line-clamp-2 text-xs text-slate-300">{product.notes}</div> : null}
              </div>
              <ShoppingBag className="size-4 shrink-0 text-muted" />
            </div>
            <div className="mt-3 flex justify-end gap-1.5">
              <Button
                className="h-8 px-2"
                title={product.status === 'active' ? copy.productStatusPaused : copy.productStatusActive}
                icon={product.status === 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                onClick={() => void onSave({ ...product, status: product.status === 'active' ? 'paused' : 'active' })}
              />
              <Button
                className="h-8 px-2"
                title={copy.editProduct}
                icon={<Pencil className="size-3.5" />}
                onClick={() => {
                  setDraft(product);
                  setEditing(true);
                }}
              />
              <Button className="h-8 px-2" title={copy.deleteKeyword} icon={<Trash2 className="size-3.5" />} onClick={() => void onDelete(product.id)} />
            </div>
          </article>
        ))}
      </section>
      {!products.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">{copy.noProducts}</div> : null}
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}
