'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/useApiClient'
import { LifeBuoy, Building2, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

type Tab = 'tickets' | 'organizations' | 'analytics'

const STATUS_STYLES: Record<string, string> = {
  OPEN:            'bg-green-100 text-green-700',
  IN_PROGRESS:     'bg-blue-100 text-blue-700',
  WAITING_ON_USER: 'bg-amber-100 text-amber-700',
  RESOLVED:        'bg-muted text-muted-foreground',
  CLOSED:          'bg-muted text-muted-foreground',
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('tickets')

  const tabs = [
    { id: 'tickets' as Tab,       label: 'Tickets',       icon: LifeBuoy },
    { id: 'organizations' as Tab, label: 'Organizations',  icon: Building2 },
    { id: 'analytics' as Tab,     label: 'Analytics',      icon: BarChart2 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Platform-wide management</p>
      </div>

      <div className="flex border-b gap-0">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'tickets'       && <AdminTickets />}
        {tab === 'organizations' && <AdminOrgs />}
        {tab === 'analytics'     && <AdminAnalytics />}
      </div>
    </div>
  )
}

function AdminTickets() {
  const api = useApiClient()
  const qc = useQueryClient()
  const [status, setStatus] = useState('OPEN')

  const { data, isLoading } = useQuery({
    queryKey: ['adminTickets', status],
    queryFn: () => api.adminListTickets({ status }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api.updateTicket(id, { status: s }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminTickets'] }); toast.success('Updated') },
    onError: () => toast.error('Failed to update'),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
        ) : (data?.tickets ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No tickets with this status</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tickets ?? []).map(t => (
                <tr key={t.ticketId} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.ticketId}`} className="font-medium hover:text-primary transition-colors">{t.subject}</Link>
                    <p className="text-xs text-muted-foreground">{t.createdByName}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{t.orgName}</td>
                  <td className="px-4 py-3 text-xs font-medium">{t.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {format(parseISO(t.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    {t.status === 'OPEN' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: t.ticketId, s: 'IN_PROGRESS' })}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Claim
                      </button>
                    )}
                    {(t.status === 'IN_PROGRESS' || t.status === 'WAITING_ON_USER') && (
                      <button
                        onClick={() => updateMutation.mutate({ id: t.ticketId, s: 'RESOLVED' })}
                        className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Resolve
                      </button>
                    )}
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

function AdminOrgs() {
  const api = useApiClient()

  const { data, isLoading } = useQuery({
    queryKey: ['adminOrgs'],
    queryFn: () => api.adminListOrganizations(),
  })

  const PLAN_STYLES: Record<string, string> = {
    free:         'bg-muted text-muted-foreground',
    starter:      'bg-blue-100 text-blue-700',
    professional: 'bg-primary/10 text-primary',
    enterprise:   'bg-amber-100 text-amber-700',
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      {isLoading ? (
        <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.organizations ?? []).map(o => (
              <tr key={o.orgId} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{o.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PLAN_STYLES[o.plan] ?? ''}`}>
                    {o.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {format(parseISO(o.createdAt), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AdminAnalytics() {
  const api = useApiClient()

  const { data, isLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: () => api.adminGetAnalytics(),
  })

  const stats = [
    { label: 'Total Organizations', value: data?.totalOrganizations },
    { label: 'Total Users',          value: data?.totalUsers },
    { label: 'Total Tickets',        value: data?.totalTickets },
    { label: 'Open Tickets',         value: data?.openTickets },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">{s.label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {isLoading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : (s.value ?? '—')}
          </p>
        </div>
      ))}
    </div>
  )
}
