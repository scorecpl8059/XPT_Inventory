'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED']

const STATUS_STYLES: Record<string, string> = {
  OPEN:            'bg-green-100 text-green-700',
  IN_PROGRESS:     'bg-blue-100 text-blue-700',
  WAITING_ON_USER: 'bg-amber-100 text-amber-700',
  RESOLVED:        'bg-muted text-muted-foreground',
  CLOSED:          'bg-muted text-muted-foreground',
}

const ROLE_BADGE: Record<string, string> = {
  owner:   'text-primary',
  manager: 'text-amber-600',
  staff:   'text-muted-foreground',
  admin:   'text-blue-600',
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const api = useApiClient()
  const qc = useQueryClient()
  const [message, setMessage] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicket(id),
    enabled: !!id,
  })

  const { data: messagesData } = useQuery({
    queryKey: ['ticketMessages', id],
    queryFn: () => api.listTicketMessages(id),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (status: string) => api.updateTicket(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      toast.success('Ticket updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const messageMutation = useMutation({
    mutationFn: () => api.addTicketMessage(id, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticketMessages', id] })
      setMessage('')
    },
    onError: () => toast.error('Failed to send message'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
      </div>
    )
  }

  if (!ticket) return <p className="text-center text-muted-foreground py-16">Ticket not found.</p>

  const messages = messagesData?.messages ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/tickets" className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? ''}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ticket.createdByName} · {format(parseISO(ticket.createdAt), 'MMM d, yyyy')} · Priority: {ticket.priority}
          </p>
        </div>
      </div>

      {/* Status update */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Change status:</span>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => updateMutation.mutate(s)}
            disabled={ticket.status === s || updateMutation.isPending}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border ${
              ticket.status === s
                ? `${STATUS_STYLES[s]} border-current`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</h2>
        <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
      </div>

      {/* Thread */}
      <div className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Messages</h2>
        {messages.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No messages yet. Add a reply below.</p>
        ) : (
          <div className="divide-y">
            {messages.map(m => (
              <div key={m.messageId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{m.authorName}</span>
                  <span className={`text-xs capitalize ${ROLE_BADGE[m.authorRole] ?? 'text-muted-foreground'}`}>
                    {m.authorRole}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(parseISO(m.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="border-t p-4 flex gap-3">
          <textarea
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={2}
            placeholder="Write a reply…"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button
            onClick={() => messageMutation.mutate()}
            disabled={messageMutation.isPending || !message.trim()}
            className="self-end rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
