'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { User, Building2, Users, Mail, CreditCard, Trash2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

type Tab = 'profile' | 'organization' | 'members' | 'invitations' | 'billing'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean }[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'organization',  label: 'Organization',  icon: Building2, ownerOnly: true },
  { id: 'members',       label: 'Members',       icon: Users },
  { id: 'invitations',   label: 'Invitations',   icon: Mail, ownerOnly: true },
  { id: 'billing',       label: 'Billing',       icon: CreditCard, ownerOnly: true },
]

export default function SettingsPage() {
  const { activeOrg } = useOrg()
  const [tab, setTab] = useState<Tab>('profile')
  const isOwner = activeOrg?.role === 'owner'
  const isManager = activeOrg?.role === 'manager' || isOwner

  const visibleTabs = TABS.filter(t => !t.ownerOnly || isOwner)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and organization</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b gap-0 overflow-x-auto">
        {visibleTabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="max-w-2xl">
        {tab === 'profile'      && <ProfileSection />}
        {tab === 'organization' && isOwner  && <OrgSection />}
        {tab === 'members'      && <MembersSection isOwner={isOwner} />}
        {tab === 'invitations'  && isOwner  && <InvitationsSection />}
        {tab === 'billing'      && isOwner  && <BillingSection />}
      </div>
    </div>
  )
}

// ── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection() {
  const api = useApiClient()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getUserProfile(),
  })

  const mutation = useMutation({
    mutationFn: () => api.updateUserProfile({ name }),
    onSuccess: () => { setEditing(false); toast.success('Profile updated') },
    onError: () => toast.error('Failed to update profile'),
  })

  const f = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  if (isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" />

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="font-medium">Your Profile</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Name</p>
          {editing ? (
            <input className={f} value={name} onChange={e => setName(e.target.value)} placeholder={profile?.name ?? ''} />
          ) : (
            <p className="font-medium">{profile?.name ?? '—'}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Email</p>
          <p className="font-medium">{profile?.email}</p>
        </div>
      </div>
      {editing ? (
        <div className="flex gap-2">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
        </div>
      ) : (
        <button onClick={() => { setName(profile?.name ?? ''); setEditing(true) }}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Edit Profile
        </button>
      )}
    </div>
  )
}

// ── Organization ─────────────────────────────────────────────────────────────

function OrgSection() {
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg, refresh } = useOrg()
  const orgId = activeOrg?.orgId
  const [name, setName] = useState(activeOrg?.name ?? '')
  const [editing, setEditing] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.updateOrganization(orgId!, { name }),
    onSuccess: () => { setEditing(false); refresh(); toast.success('Organization updated') },
    onError: () => toast.error('Failed to update'),
  })

  const f = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="font-medium">Organization Settings</h2>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Organization Name</p>
        {editing ? (
          <input className={f} value={name} onChange={e => setName(e.target.value)} />
        ) : (
          <p className="font-medium">{activeOrg?.name}</p>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Plan</p>
        <p className="font-medium capitalize">{activeOrg?.plan ?? 'free'}</p>
      </div>
      {editing ? (
        <div className="flex gap-2">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Edit
        </button>
      )}
    </div>
  )
}

// ── Members ──────────────────────────────────────────────────────────────────

function MembersSection({ isOwner }: { isOwner: boolean }) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const { data, isLoading } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => api.listMembers(orgId!),
    enabled: !!orgId,
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.removeMember(orgId!, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', orgId] }); toast.success('Member removed') },
    onError: () => toast.error('Failed to remove member'),
  })

  const roleMap: Record<string, string> = {
    manager: 'bg-amber-100 text-amber-700',
    staff:   'bg-muted text-muted-foreground',
    owner:   'bg-primary/10 text-primary',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Joined</th>
                {isOwner && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {(data?.members ?? []).map(m => (
                <tr key={m.userId} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{m.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleMap[m.role] ?? ''}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {format(parseISO(m.joinedAt), 'MMM d, yyyy')}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      {m.role !== 'owner' && (
                        <button
                          onClick={() => removeMutation.mutate(m.userId)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Invitations ───────────────────────────────────────────────────────────────

function InvitationsSection() {
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState('staff')
  const [joinCode, setCode] = useState('')

  const { data } = useQuery({
    queryKey: ['invitations', orgId],
    queryFn: () => api.listInvitations(orgId!),
    enabled: !!orgId,
  })

  const inviteMutation = useMutation({
    mutationFn: () => api.createInvitation(orgId!, { email, role }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ['invitations', orgId] })
      setCode(inv.joinCode)
      setEmail('')
      toast.success('Invitation sent')
    },
    onError: () => toast.error('Failed to send invitation'),
  })

  const f = 'rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="font-medium">Invite a Member</h2>
        <div className="flex gap-3 flex-wrap">
          <input className={`${f} flex-1 min-w-40`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
          <select className={f} value={role} onChange={e => setRole(e.target.value)}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
          <button
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending || !email}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {joinCode && (
          <div className="rounded-md bg-muted p-3 text-sm">
            Join code: <span className="font-mono font-bold tracking-widest">{joinCode}</span>
            <span className="text-muted-foreground ml-2">(share this with the invitee)</span>
          </div>
        )}
      </div>

      {/* Pending list */}
      <div className="rounded-lg border overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Invitations</div>
        {(data?.invitations ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No pending invitations</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Code</th>
              </tr>
            </thead>
            <tbody>
              {(data?.invitations ?? []).map(inv => (
                <tr key={inv.inviteId} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{inv.email}</td>
                  <td className="px-4 py-2.5 capitalize">{inv.role}</td>
                  <td className="px-4 py-2.5 font-mono text-xs tracking-widest">{inv.joinCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────

const PLANS = [
  { id: 'free',         label: 'Free',         price: '$0/mo',  features: '1 user · 50 products · 1 location' },
  { id: 'starter',      label: 'Starter',      price: '$29/mo', features: '5 users · 500 products · 3 locations' },
  { id: 'professional', label: 'Professional', price: '$79/mo', features: '25 users · 5,000 products · unlimited locations' },
]

function BillingSection() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const { data: billing } = useQuery({
    queryKey: ['billing', orgId],
    queryFn: () => api.getSubscription(orgId!),
    enabled: !!orgId,
  })

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => api.createCheckoutSession(orgId!, plan),
    onSuccess: (data) => { window.location.href = data.url },
    onError: () => toast.error('Failed to open checkout'),
  })

  const portalMutation = useMutation({
    mutationFn: () => api.createBillingPortal(orgId!),
    onSuccess: (data) => { window.location.href = data.url },
    onError: () => toast.error('Failed to open billing portal'),
  })

  const currentPlan = billing?.plan ?? activeOrg?.plan ?? 'free'

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h2 className="font-medium">Current Plan</h2>
        <p className="text-2xl font-semibold capitalize">{currentPlan}</p>
        {currentPlan !== 'free' && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {portalMutation.isPending ? 'Opening…' : 'Manage Subscription'}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map(plan => (
          <div key={plan.id} className={`rounded-lg border p-4 space-y-3 ${currentPlan === plan.id ? 'border-primary bg-primary/5' : ''}`}>
            <div>
              <p className="font-semibold">{plan.label}</p>
              <p className="text-lg font-bold">{plan.price}</p>
              <p className="text-xs text-muted-foreground mt-1">{plan.features}</p>
            </div>
            {plan.id !== 'free' && currentPlan !== plan.id && (
              <button
                onClick={() => checkoutMutation.mutate(plan.id)}
                disabled={checkoutMutation.isPending}
                className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {checkoutMutation.isPending ? 'Loading…' : 'Upgrade'}
              </button>
            )}
            {currentPlan === plan.id && (
              <p className="text-xs font-medium text-primary">Current plan</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
