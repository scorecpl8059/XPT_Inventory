/** Frontend type definitions for XPT-Inventory */

export interface Organization {
  orgId: string
  name: string
  timezone: string
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  role: 'owner' | 'manager' | 'staff'
  createdAt: string
}

export interface UserProfile {
  name: string
  email: string
  avatarUrl?: string
  isAdmin?: boolean
}

export interface OrgMember {
  userId: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  joinedAt: string
}

export interface Invitation {
  inviteId: string
  email: string
  role: 'manager' | 'staff'
  joinCode: string
  expiresAt: string
  createdAt: string
}

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PRODUCT_CREATED'

export interface Proposal {
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
  commentId: string
  proposalId: string
  body: string
  authorId: string
  authorName: string
  authorRole: string
  createdAt: string
}

export interface Product {
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
}

export interface ProductVariant {
  variantId: string
  productId: string
  variantName: string
  attributes: Record<string, string>
  price?: number
  cost?: number
  weight?: number
  sku?: string
}

export interface InventoryLocation {
  locationId: string
  name: string
  address?: string
  isDefault: boolean
  createdAt: string
}

export interface StockLevel {
  productId: string
  locationId: string
  quantity: number
  reorderPoint: number
  reorderQty: number
  lastUpdated: string
}

export type MovementType = 'RECEIPT' | 'SHIPMENT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN'

export interface StockMovement {
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

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_USER' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Ticket {
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
}

export interface TicketMessage {
  messageId: string
  body: string
  authorId: string
  authorName: string
  authorRole: 'staff' | 'manager' | 'owner' | 'admin'
  createdAt: string
}
