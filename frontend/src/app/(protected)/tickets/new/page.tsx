'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewTicketPage() {
  const router = useRouter()
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const [subject,  setSubject]  = useState('')
  const [desc,     setDesc]     = useState('')
  const [priority, setPriority] = useState('MEDIUM')

  const mutation = useMutation({
    mutationFn: () => api.createTicket(orgId!, { subject, description: desc, priority }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tickets', orgId] })
      toast.success('Ticket created')
      router.push(`/tickets/${data.ticketId}`)
    },
    onError: () => toast.error('Failed to create ticket'),
  })

  const f = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tickets" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Ticket</h1>
          <p className="text-sm text-muted-foreground">Describe your issue and we'll get back to you</p>
        </div>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); if (subject && desc) mutation.mutate() }}
        className="rounded-lg border bg-card p-5 space-y-4"
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
          <input className={f} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary of your issue" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
          <textarea className={f} rows={5} value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Describe your issue in detail. Include steps to reproduce, expected vs actual behavior, etc." required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <div className="flex gap-2">
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  priority === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/tickets" className="flex-1 rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !subject || !desc}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}
