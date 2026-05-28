'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { Plus, FileText } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { ProposalStatus } from '@/types'

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PRODUCT_CREATED', label: 'Product Created' },
]

const STATUS_STYLES: Record<string, string> = {
  DRAFT:           'bg-muted text-muted-foreground',
  SUBMITTED:       'bg-amber-100 text-amber-700',
  IN_REVIEW:       'bg-blue-100 text-blue-700',
  APPROVED:        'bg-green-100 text-green-700',
  REJECTED:        'bg-red-100 text-red-600',
  PRODUCT_CREATED: 'bg-primary/10 text-primary',
}

export default function ProposalsPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['proposals', orgId, statusFilter],
    queryFn: () => api.listProposals(orgId!, statusFilter ? { status: statusFilter } : undefined),
    enabled: !!orgId,
  })

  const proposals = data?.proposals ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
          <p className="text-sm text-muted-foreground">Product proposals for review and approval</p>
        </div>
        <Link
          href="/proposals/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Proposal
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : isError ? (
          <p className="p-6 text-center text-sm text-destructive">Failed to load proposals.</p>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No proposals found</p>
            <Link href="/proposals/new" className="mt-3 text-sm text-primary hover:underline">Create your first proposal</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Created By</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.proposalId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/proposals/${p.proposalId}`} className="font-medium hover:text-primary transition-colors">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.createdByName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {format(parseISO(p.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
