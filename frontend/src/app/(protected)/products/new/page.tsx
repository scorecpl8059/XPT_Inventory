'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const CATEGORIES = ['Electronics', 'Clothing', 'Food & Beverage', 'Health & Beauty', 'Home & Garden', 'Sports & Outdoors', 'Toys & Games', 'Books & Media', 'Tools & Hardware', 'Other']

export default function NewProductPage() {
  const router = useRouter()
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    unitPrice: '',
    cost: '',
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE' | 'DISCONTINUED',
  })

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const mutation = useMutation({
    mutationFn: () => api.createProduct(orgId!, {
      name: form.name,
      sku: form.sku,
      description: form.description || undefined,
      category: form.category || undefined,
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
      cost: form.cost ? parseFloat(form.cost) : undefined,
      status: form.status,
    }),
    onSuccess: (product) => {
      toast.success('Product created')
      router.push(`/products/${product.productId}`)
    },
    onError: () => toast.error('Failed to create product'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error('Name and SKU are required')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/products" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Product</h1>
          <p className="text-sm text-muted-foreground">Add a product to your catalog</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Product Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Wireless Headphones"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                SKU <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={e => set('sku', e.target.value.toUpperCase())}
                placeholder="e.g. WH-1000XM5"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Optional product description..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pricing</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Selling Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={e => set('unitPrice', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={e => set('cost', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h2>
          <div className="flex gap-2 flex-wrap">
            {(['DRAFT', 'ACTIVE', 'DISCONTINUED'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set('status', s)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  form.status === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {form.status === 'DRAFT' && 'Product is not yet visible in standard inventory views.'}
            {form.status === 'ACTIVE' && 'Product is live and available for stock movements.'}
            {form.status === 'DISCONTINUED' && 'Product is no longer sold but history is preserved.'}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/products"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
