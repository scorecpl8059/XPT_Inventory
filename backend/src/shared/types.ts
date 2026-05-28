/** DynamoDB item shape interfaces for all entities */

// ── Users Table ──────────────────────────────────────────────────────────────

export interface UserProfile {
  PK: string        // USER#<sub>
  SK: 'PROFILE'
  name: string
  email: string
  avatarUrl?: string
  isAdmin?: boolean
  createdAt: string
  updatedAt?: string
  // GSI1
  gsi1pk?: string   // EMAIL#<email>
  gsi1sk?: string   // PROFILE
}

export interface UserMembership {
  PK: string        // USER#<sub>
  SK: string        // MEMBERSHIP#<orgId>
  orgId: string
  orgName: string
  role: 'owner' | 'manager' | 'staff'
  joinedAt: string
}

// ── Orgs Table ───────────────────────────────────────────────────────────────

export interface OrgMeta {
  PK: string        // ORG#<orgId>
  SK: 'META'
  orgId: string
  name: string
  timezone: string
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  stripeCustomerId?: string
  stripeSubId?: string
  createdAt: string
  updatedAt?: string
}

export interface OrgMember {
  PK: string        // ORG#<orgId>
  SK: string        // MEMBER#<sub>
  userId: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  joinedAt: string
}

export interface OrgInvite {
  PK: string        // ORG#<orgId>
  SK: string        // INVITE#<ulid>
  inviteId: string
  email: string
  role: 'manager' | 'staff'
  joinCode: string
  expiresAt: string
  createdAt: string
  // GSI1
  gsi1pk: string    // INVITE_EMAIL#<email>
  gsi1sk: string    // INVITE#<ulid>
}

// ── Products Table ───────────────────────────────────────────────────────────

export interface Product {
  PK: string        // ORG#<orgId>
  SK: string        // PROD#<ulid>
  productId: string
  name: string
  sku: string
  description?: string
  category?: string
  status: 'DRAFT' | 'ACTIVE' | 'DISCONTINUED'
  images?: string[]
  unitPrice?: number
  cost?: number
  createdBy: string
  createdAt: string
  updatedAt?: string
  // GSI1
  gsi1pk?: string   // ORG#<orgId>#SKU
  gsi1sk?: string   // <sku>
}

export interface ProductVariant {
  PK: string        // ORG#<orgId>
  SK: string        // VARIANT#<prodId>#<ulid>
  variantId: string
  productId: string
  variantName: string
  attributes: Record<string, string>
  price?: number
  cost?: number
  weight?: number
  sku?: string
}

// ── Proposals Table ──────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PRODUCT_CREATED'

export interface Proposal {
  PK: string        // ORG#<orgId>
  SK: string        // PROP#<ulid>
  proposalId: string
  title: string
  description?: string
  productData: {
    name: string
    sku: string
    description?: string
    category?: string
    unitPrice?: number
    cost?: number
    variants?: Array<{
      variantName: string
      attributes: Record<string, string>
      price?: number
      cost?: number
    }>
  }
  status: ProposalStatus
  createdBy: string
  createdByName: string
  reviewedBy?: string
  approvedBy?: string
  rejectionReason?: string
  createdAt: string
  updatedAt?: string
}

export interface ProposalComment {
  PK: string        // ORG#<orgId>
  SK: string        // PROP_COMMENT#<propId>#<ulid>
  commentId: string
  proposalId: string
  body: string
  authorId: string
  authorName: string
  authorRole: string
  createdAt: string
}

// ── Inventory Table ──────────────────────────────────────────────────────────

export interface Location {
  PK: string        // ORG#<orgId>
  SK: string        // LOC#<ulid>
  locationId: string
  name: string
  address?: string
  isDefault: boolean
  createdAt: string
}

export interface StockLevel {
  PK: string        // ORG#<orgId>
  SK: string        // STOCK#<prodId>#<locId>
  productId: string
  locationId: string
  quantity: number
  reorderPoint: number
  reorderQty: number
  lastUpdated: string
}

export type MovementType = 'RECEIPT' | 'SHIPMENT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN'

export interface StockMovement {
  PK: string        // ORG#<orgId>
  SK: string        // MOVEMENT#<YYYY-MM-DD>#<ulid>
  movementId: string
  productId: string
  productName: string
  fromLocId?: string
  toLocId?: string
  quantity: number
  type: MovementType
  reason?: string
  createdBy: string
  createdByName: string
  createdAt: string
}

// ── Tickets Table ────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_USER' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Ticket {
  PK: string        // TICKET#<ulid>
  SK: 'META'
  ticketId: string
  orgId: string
  orgName: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt?: string
  // GSI1
  gsi1pk: string    // ORG#<orgId>
  gsi1sk: string    // TICKET#<ulid>
  // GSI2
  gsi2pk: string    // STATUS#<status>
  gsi2sk: string    // TICKET#<ulid>
}

export interface TicketMessage {
  PK: string        // TICKET#<ulid>
  SK: string        // MSG#<ulid>
  messageId: string
  body: string
  authorId: string
  authorName: string
  authorRole: 'staff' | 'manager' | 'owner' | 'admin'
  createdAt: string
}
