'use client'

import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { Plus, LifeBuoy } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  OPEN:            'bg-green-100 text-green-700',
  IN_PROGRESS:     'bg-blue-100 text-blue-700',
  WAITING_ON_USER: 'bg-amber-100 text-amber-700',
  RESOLVED:        'bg-muted text-muted-foreground',
  CLOSED:          'bg-muted text-muted-foreground',
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW:    'text-muted-foreground',
  MEDIUM: 'text-amber-600',
  HIGH:   'text-red-600',
  URGENT: 'text-red-700 font-bold',
}

export default function TicketsPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', orgId],
    queryFn: () => api.listTickets(orgId!),
    enabled: !!orgId,
  })

  const tickets = data?.tickets ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Get help from our support team</p>
        </div>
        <Link
          href="/tickets/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Ticket
        </Link>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LifeBuoy className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No tickets yet</p>
            <Link href="/tickets/new" className="mt-3 text-sm text-primary hover:underline">Create a support ticket</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Created By</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.ticketId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.ticketId}`} className="font-medium hover:text-primary transition-colors">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? ''}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs hidden sm:table-cell ${PRIORITY_STYLES[t.priority] ?? ''}`}>{t.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.createdByName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {format(parseISO(t.createdAt), 'MMM d, yyyy')}
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
