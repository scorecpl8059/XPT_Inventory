'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import type { ProposalStatus } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  DRAFT:           'bg-muted text-muted-foreground',
  SUBMITTED:       'bg-amber-100 text-amber-700',
  IN_REVIEW:       'bg-blue-100 text-blue-700',
  APPROVED:        'bg-green-100 text-green-700',
  REJECTED:        'bg-red-100 text-red-600',
  PRODUCT_CREATED: 'bg-primary/10 text-primary',
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const role = activeOrg?.role

  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposal', orgId, id],
    queryFn: () => api.getProposal(orgId!, id),
    enabled: !!orgId && !!id,
  })

  const { data: commentsData } = useQuery({
    queryKey: ['proposalComments', orgId, id],
    queryFn: () => api.listProposalComments(orgId!, id),
    enabled: !!orgId && !!id,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['proposal', orgId, id] })
    qc.invalidateQueries({ queryKey: ['proposals', orgId] })
  }

  const submitMutation = useMutation({
    mutationFn: () => api.submitProposal(orgId!, id),
    onSuccess: () => { invalidate(); toast.success('Proposal submitted') },
    onError: () => toast.error('Failed to submit'),
  })

  const reviewMutation = useMutation({
    mutationFn: () => api.reviewProposal(orgId!, id),
    onSuccess: () => { invalidate(); toast.success('Proposal moved to In Review') },
    onError: () => toast.error('Failed to update'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.approveProposal(orgId!, id),
    onSuccess: () => { invalidate(); toast.success('Proposal approved') },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectProposal(orgId!, id, rejectReason),
    onSuccess: () => { invalidate(); setShowRejectForm(false); toast.success('Proposal rejected') },
    onError: () => toast.error('Failed to reject'),
  })

  const createProductMutation = useMutation({
    mutationFn: () => api.createProductFromProposal(orgId!, id),
    onSuccess: (data) => { invalidate(); toast.success('Product created'); router.push(`/products/${data.productId}`) },
    onError: () => toast.error('Failed to create product'),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.addProposalComment(orgId!, id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposalComments', orgId, id] })
      setComment('')
      toast.success('Comment added')
    },
    onError: () => toast.error('Failed to add comment'),
  })

  const isManager = role === 'manager' || role === 'owner'
  const status = proposal?.status as ProposalStatus | undefined

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
      </div>
    )
  }

  if (!proposal) {
    return <p className="text-center text-muted-foreground py-16">Proposal not found.</p>
  }

  const pd = proposal.productData

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/proposals" className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status ?? ''] ?? ''}`}>
              {status?.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            by {proposal.createdByName} · {format(parseISO(proposal.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Action bar */}
      {(status === 'DRAFT') && (
        <div className="flex gap-2">
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Submit for Review
          </button>
        </div>
      )}
      {isManager && (status === 'SUBMITTED') && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Start Review
          </button>
          <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            Approve
          </button>
          <button onClick={() => setShowRejectForm(true)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-destructive border-destructive/30 hover:bg-destructive/10">
            Reject
          </button>
        </div>
      )}
      {isManager && (status === 'IN_REVIEW') && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            Approve
          </button>
          <button onClick={() => setShowRejectForm(true)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-destructive border-destructive/30 hover:bg-destructive/10">
            Reject
          </button>
        </div>
      )}
      {isManager && (status === 'APPROVED') && (
        <div className="flex gap-2">
          <button onClick={() => createProductMutation.mutate()} disabled={createProductMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createProductMutation.isPending ? 'Creating…' : 'Create Product from Proposal'}
          </button>
        </div>
      )}

      {/* Reject form */}
      {showRejectForm && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-destructive">Rejection Reason</p>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Explain why this proposal is being rejected..."
          />
          <div className="flex gap-2">
            <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectReason}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              Confirm Rejection
            </button>
            <button onClick={() => setShowRejectForm(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
          </div>
        </div>
      )}

      {/* Proposal details */}
      {proposal.description && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Proposal Description</h2>
          <p className="text-sm whitespace-pre-wrap">{proposal.description}</p>
        </div>
      )}

      {proposal.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-1">Rejection Reason</p>
          <p className="text-sm">{proposal.rejectionReason}</p>
        </div>
      )}

      {/* Product data */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{pd.name}</p></div>
          <div><p className="text-xs text-muted-foreground">SKU</p><p className="font-mono font-medium">{pd.sku}</p></div>
          {pd.category && <div><p className="text-xs text-muted-foreground">Category</p><p>{pd.category}</p></div>}
          {pd.unitPrice && <div><p className="text-xs text-muted-foreground">Unit Price</p><p>${pd.unitPrice.toFixed(2)}</p></div>}
          {pd.cost && <div><p className="text-xs text-muted-foreground">Cost</p><p>${pd.cost.toFixed(2)}</p></div>}
        </div>
        {pd.description && <div><p className="text-xs text-muted-foreground mb-1">Product Description</p><p className="text-sm">{pd.description}</p></div>}
      </div>

      {/* Comments */}
      <div className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Comments</h2>
        <div className="divide-y">
          {(commentsData?.comments ?? []).map(c => (
            <div key={c.commentId} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="text-xs text-muted-foreground capitalize">{c.authorRole}</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(parseISO(c.createdAt), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="border-t p-4 flex gap-3">
          <textarea
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={2}
            placeholder="Add a comment..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button
            onClick={() => commentMutation.mutate()}
            disabled={commentMutation.isPending || !comment.trim()}
            className="self-end rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
