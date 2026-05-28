'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewProposalPage() {
  const router = useRouter()
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [name, setName]         = useState('')
  const [sku, setSku]           = useState('')
  const [pdDesc, setPdDesc]     = useState('')
  const [category, setCategory] = useState('')
  const [unitPrice, setPrice]   = useState('')
  const [cost, setCost]         = useState('')

  const mutation = useMutation({
    mutationFn: () => api.createProposal(orgId!, {
      title,
      description: description || undefined,
      productData: {
        name, sku,
        description: pdDesc || undefined,
        category: category || undefined,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
      },
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['proposals', orgId] })
      toast.success('Proposal created')
      router.push(`/proposals/${data.proposalId}`)
    },
    onError: () => toast.error('Failed to create proposal'),
  })

  const f = 'w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !name || !sku) return
    mutation.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/proposals" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Proposal</h1>
          <p className="text-sm text-muted-foreground">Propose a new product for review</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Proposal info */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposal Details</h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
            <input className={f} value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title for this proposal" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea className={f} rows={3} value={description} onChange={e => setDesc(e.target.value)} placeholder="Why should this product be added?" />
          </div>
        </div>

        {/* Product data */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product Name <span className="text-destructive">*</span></label>
              <input className={f} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Wireless Headphones" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SKU <span className="text-destructive">*</span></label>
              <input className={f} value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. WH-001" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <input className={f} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Electronics" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unit Price ($)</label>
              <input className={f} type="number" step="0.01" min="0" value={unitPrice} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cost ($)</label>
              <input className={f} type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Product Description</label>
            <textarea className={f} rows={2} value={pdDesc} onChange={e => setPdDesc(e.target.value)} placeholder="Product details, specifications..." />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/proposals" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !title || !name || !sku}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Creating…' : 'Create Proposal'}
          </button>
        </div>
      </form>
    </div>
  )
}
