/**
 * Typed API client for the XPT-Inventory backend.
 *
 * All organization-scoped endpoints require an orgId, passed as the first
 * argument. The orgId is stored in the OrgProvider context.
 */
import type {
  Organization, UserProfile, OrgMember, Invitation,
  Proposal, ProposalComment,
  Product, ProductVariant,
  InventoryLocation, StockLevel, StockMovement,
  Ticket, TicketMessage,
} from '@/types'

// ── Typed API error ───────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly errors?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Query param builder ───────────────────────────────────────────────────

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return filtered.length ? `?${filtered.join('&')}` : ''
}

// ── API Client ────────────────────────────────────────────────────────────

export class ApiClient {
  private baseUrl: string

  constructor(private getToken: () => Promise<string>) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getToken()

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (res.status === 204) return undefined as T

    const data = await res.json().catch(() => ({ message: 'Unknown error' }))

    if (!res.ok) {
      throw new ApiError(res.status, data.message ?? 'Request failed', data.code, data.errors)
    }

    return data as T
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────
  bootstrap = () => this.request<{ message: string; orgId?: string }>('POST', '/bootstrap')

  // ── User profile ─────────────────────────────────────────────────────────
  getUserProfile   = () => this.request<UserProfile>('GET', '/user/profile')
  updateUserProfile = (data: { name?: string }) => this.request<UserProfile>('PATCH', '/user/profile', data)

  // ── Organizations ──────────────────────────────────────────────────────
  listOrganizations = () =>
    this.request<{ organizations: Organization[] }>('GET', '/organizations')

  createOrganization = (data: { name: string; timezone?: string }) =>
    this.request<{ orgId: string }>('POST', '/organizations', data)

  getOrganization = (orgId: string) =>
    this.request<Organization>('GET', `/organizations/${orgId}`)

  updateOrganization = (orgId: string, data: { name?: string; timezone?: string }) =>
    this.request<{ message: string }>('PATCH', `/organizations/${orgId}`, data)

  // ── Members ─────────────────────────────────────────────────────────────
  listMembers = (orgId: string) =>
    this.request<{ members: OrgMember[] }>('GET', `/organizations/${orgId}/members`)

  updateMemberRole = (orgId: string, memberId: string, role: string) =>
    this.request<{ message: string }>('PATCH', `/organizations/${orgId}/members/${memberId}`, { role })

  removeMember = (orgId: string, memberId: string) =>
    this.request<void>('DELETE', `/organizations/${orgId}/members/${memberId}`)

  // ── Invitations ─────────────────────────────────────────────────────────
  createInvitation = (orgId: string, data: { email: string; role: string }) =>
    this.request<Invitation>('POST', `/organizations/${orgId}/invitations`, data)

  listInvitations = (orgId: string) =>
    this.request<{ invitations: Invitation[] }>('GET', `/organizations/${orgId}/invitations`)

  joinByCode = (joinCode: string) =>
    this.request<{ orgId: string; orgName: string }>('POST', '/invitations/join', { joinCode })

  // ── Proposals ───────────────────────────────────────────────────────────
  listProposals = (orgId: string, params?: { status?: string; cursor?: string }) =>
    this.request<{ proposals: Proposal[]; cursor?: string }>('GET', `/organizations/${orgId}/proposals${buildQuery(params)}`)

  getProposal = (orgId: string, id: string) =>
    this.request<Proposal>('GET', `/organizations/${orgId}/proposals/${id}`)

  createProposal = (orgId: string, data: { title: string; description?: string; productData: Proposal['productData'] }) =>
    this.request<Proposal>('POST', `/organizations/${orgId}/proposals`, data)

  updateProposal = (orgId: string, id: string, data: Partial<{ title: string; description: string; productData: Proposal['productData'] }>) =>
    this.request<Proposal>('PATCH', `/organizations/${orgId}/proposals/${id}`, data)

  submitProposal = (orgId: string, id: string) =>
    this.request<Proposal>('POST', `/organizations/${orgId}/proposals/${id}/submit`)

  reviewProposal = (orgId: string, id: string) =>
    this.request<Proposal>('POST', `/organizations/${orgId}/proposals/${id}/review`)

  approveProposal = (orgId: string, id: string) =>
    this.request<Proposal>('POST', `/organizations/${orgId}/proposals/${id}/approve`)

  rejectProposal = (orgId: string, id: string, reason: string) =>
    this.request<Proposal>('POST', `/organizations/${orgId}/proposals/${id}/reject`, { reason })

  listProposalComments = (orgId: string, proposalId: string) =>
    this.request<{ comments: ProposalComment[] }>('GET', `/organizations/${orgId}/proposals/${proposalId}/comments`)

  addProposalComment = (orgId: string, proposalId: string, body: string) =>
    this.request<ProposalComment>('POST', `/organizations/${orgId}/proposals/${proposalId}/comments`, { body })

  // ── Products ────────────────────────────────────────────────────────────
  listProducts = (orgId: string, params?: { status?: string; category?: string; cursor?: string }) =>
    this.request<{ products: Product[]; cursor?: string }>('GET', `/organizations/${orgId}/products${buildQuery(params)}`)

  getProduct = (orgId: string, id: string) =>
    this.request<{ product: Product; variants: ProductVariant[] }>('GET', `/organizations/${orgId}/products/${id}`)

  createProduct = (orgId: string, data: Partial<Product>) =>
    this.request<Product>('POST', `/organizations/${orgId}/products`, data)

  updateProduct = (orgId: string, id: string, data: Partial<Product>) =>
    this.request<Product>('PATCH', `/organizations/${orgId}/products/${id}`, data)

  deleteProduct = (orgId: string, id: string) =>
    this.request<void>('DELETE', `/organizations/${orgId}/products/${id}`)

  // ── Locations ───────────────────────────────────────────────────────────
  listLocations = (orgId: string) =>
    this.request<{ locations: InventoryLocation[] }>('GET', `/organizations/${orgId}/locations`)

  createLocation = (orgId: string, data: { name: string; address?: string; isDefault?: boolean }) =>
    this.request<InventoryLocation>('POST', `/organizations/${orgId}/locations`, data)

  updateLocation = (orgId: string, id: string, data: Partial<{ name: string; address: string; isDefault: boolean }>) =>
    this.request<InventoryLocation>('PATCH', `/organizations/${orgId}/locations/${id}`, data)

  deleteLocation = (orgId: string, id: string) =>
    this.request<void>('DELETE', `/organizations/${orgId}/locations/${id}`)

  // ── Stock ───────────────────────────────────────────────────────────────
  listStock = (orgId: string, params?: { productId?: string; locationId?: string }) =>
    this.request<{ stock: StockLevel[] }>('GET', `/organizations/${orgId}/stock${buildQuery(params)}`)

  getStockByProduct = (orgId: string, productId: string) =>
    this.request<{ stock: StockLevel[] }>('GET', `/organizations/${orgId}/stock/${productId}`)

  // ── Movements ──────────────────────────────────────────────────────────
  listMovements = (orgId: string, params?: { from?: string; to?: string; productId?: string; cursor?: string }) =>
    this.request<{ movements: StockMovement[]; cursor?: string }>('GET', `/organizations/${orgId}/movements${buildQuery(params)}`)

  createMovement = (orgId: string, data: {
    productId: string; type: string; quantity: number;
    fromLocId?: string; toLocId?: string; reason?: string
  }) =>
    this.request<StockMovement>('POST', `/organizations/${orgId}/movements`, data)

  // ── Tickets ─────────────────────────────────────────────────────────────
  listTickets = (orgId: string) =>
    this.request<{ tickets: Ticket[] }>('GET', `/organizations/${orgId}/tickets`)

  createTicket = (orgId: string, data: { subject: string; description: string; priority: string }) =>
    this.request<Ticket>('POST', `/organizations/${orgId}/tickets`, data)

  getTicket = (ticketId: string) =>
    this.request<Ticket>('GET', `/tickets/${ticketId}`)

  updateTicket = (ticketId: string, data: { status?: string; priority?: string }) =>
    this.request<Ticket>('PATCH', `/tickets/${ticketId}`, data)

  listTicketMessages = (ticketId: string) =>
    this.request<{ messages: TicketMessage[] }>('GET', `/tickets/${ticketId}/messages`)

  addTicketMessage = (ticketId: string, body: string) =>
    this.request<TicketMessage>('POST', `/tickets/${ticketId}/messages`, { body })

  // ── Billing ─────────────────────────────────────────────────────────────
  createCheckoutSession = (orgId: string, plan: string) =>
    this.request<{ url: string }>('POST', `/organizations/${orgId}/billing/checkout`, { plan })

  getSubscription = (orgId: string) =>
    this.request<{ plan: string; status: string; currentPeriodEnd?: string }>('GET', `/organizations/${orgId}/billing`)

  createBillingPortal = (orgId: string) =>
    this.request<{ url: string }>('POST', `/organizations/${orgId}/billing/portal`)

  // ── Admin ──────────────────────────────────────────────────────────────
  adminListTickets = (params?: { status?: string }) =>
    this.request<{ tickets: Ticket[] }>('GET', `/admin/tickets${buildQuery(params)}`)

  adminListOrganizations = () =>
    this.request<{ organizations: Organization[] }>('GET', '/admin/organizations')

  adminGetAnalytics = () =>
    this.request<{ totalOrgs: number; totalUsers: number; ticketsByStatus: Record<string, number> }>('GET', '/admin/analytics')
}
