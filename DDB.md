# DynamoDB Schema — XPT-Inventory

## Design Philosophy

Unlike Business Suite (single-table design), XPT-Inventory uses **6 separate DynamoDB tables** — one per domain. Each table uses PAY_PER_REQUEST billing and RETAIN removal policy.

Benefits of multi-table:
- **Cleaner separation** — each domain's access patterns are self-contained
- **Independent scaling** — hot tables don't affect cold ones
- **Simpler queries** — no need to filter out unrelated entity types
- **Easier IAM** — Lambdas can be scoped to only the tables they need

---

## Table 1: `xpt-inv-users-{stage}`

**Purpose:** User profiles and their org memberships.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `USER#<sub>` | `PROFILE` | name, email, avatarUrl, isAdmin, createdAt | User's profile record |
| `USER#<sub>` | `MEMBERSHIP#<orgId>` | role, orgName, joinedAt | User's membership in an org |

**GSI1** — Find user by email:
| gsi1pk | gsi1sk | Use case |
|---|---|---|
| `EMAIL#<email>` | `PROFILE` | Check if email already has an account (for invitations) |

### Access Patterns

| Pattern | Query |
|---|---|
| Get user profile | `PK=USER#<sub>, SK=PROFILE` |
| List user's orgs | `PK=USER#<sub>, SK begins_with MEMBERSHIP#` |
| Get specific membership | `PK=USER#<sub>, SK=MEMBERSHIP#<orgId>` |
| Find user by email | GSI1: `gsi1pk=EMAIL#<email>, gsi1sk=PROFILE` |

### Why MEMBERSHIP is here (and also in orgs table as MEMBER)

This is intentional denormalization:
- **MEMBERSHIP** (users table) answers: "What orgs does user X belong to?" — needed for the org switcher dropdown
- **MEMBER** (orgs table) answers: "Who are all members of org Y?" — needed for the members settings tab
- Caching `orgName` in MEMBERSHIP avoids a cross-table lookup when rendering the org switcher
- When an org name changes, both records are updated via `TransactWrite` across tables

---

## Table 2: `xpt-inv-orgs-{stage}`

**Purpose:** Organization metadata, members, and invitations.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `ORG#<orgId>` | `META` | name, timezone, plan, stripeCustomerId, stripeSubId, createdAt | Org metadata + billing |
| `ORG#<orgId>` | `MEMBER#<sub>` | role, name, email, joinedAt | Member of this org |
| `ORG#<orgId>` | `INVITE#<ulid>` | email, role, joinCode, expiresAt, createdAt | Pending invitation |

**GSI1** — Find pending invitations by email:
| gsi1pk | gsi1sk | Use case |
|---|---|---|
| `INVITE_EMAIL#<email>` | `INVITE#<ulid>` | During bootstrap, check if new user has pending invitations |

### Access Patterns

| Pattern | Query |
|---|---|
| Get org metadata | `PK=ORG#<orgId>, SK=META` |
| List org members | `PK=ORG#<orgId>, SK begins_with MEMBER#` |
| Get specific member | `PK=ORG#<orgId>, SK=MEMBER#<sub>` |
| List org invitations | `PK=ORG#<orgId>, SK begins_with INVITE#` |
| Find invitations by email | GSI1: `gsi1pk=INVITE_EMAIL#<email>` |

### Billing Fields on META

The `META` record stores Stripe integration data:
- `plan`: `free`, `starter`, `professional`, `enterprise`
- `stripeCustomerId`: Stripe customer ID (set after first checkout)
- `stripeSubId`: Stripe subscription ID (set after successful payment)
- Updated by the Stripe webhook handler when subscription events occur

### Invitation Flow

1. Owner calls POST `/organizations/{orgId}/invitations` with email + role
2. Handler creates `INVITE#<ulid>` record with a 6-char `joinCode` and `gsi1pk=INVITE_EMAIL#<email>`
3. SES email sent with join code
4. Invitee logs in → `/bootstrap` queries GSI1 for their email → finds pending invite
5. Invitee calls POST `/invitations/join` with joinCode
6. Handler: `TransactWrite` → delete invite, create MEMBER (orgs table) + MEMBERSHIP (users table)

---

## Table 3: `xpt-inv-products-{stage}`

**Purpose:** Product catalog with variants.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `ORG#<orgId>` | `PROD#<ulid>` | name, sku, description, category, status, images[], unitPrice, cost, createdBy, createdAt, updatedAt | Product record |
| `ORG#<orgId>` | `VARIANT#<prodId>#<ulid>` | variantName, attributes (size/color/etc), price, cost, weight, sku | Product variant |

**GSI1** — Lookup product by SKU:
| gsi1pk | gsi1sk | Use case |
|---|---|---|
| `ORG#<orgId>#SKU` | `<sku>` | Find product by SKU (uniqueness check, barcode scan) |

### Access Patterns

| Pattern | Query |
|---|---|
| List all products | `PK=ORG#<orgId>, SK begins_with PROD#` |
| Get one product | `PK=ORG#<orgId>, SK=PROD#<ulid>` |
| List product variants | `PK=ORG#<orgId>, SK begins_with VARIANT#<prodId>#` |
| Find product by SKU | GSI1: `gsi1pk=ORG#<orgId>#SKU, gsi1sk=<sku>` |

### Product Status Values

| Status | Meaning |
|---|---|
| `DRAFT` | Created but not yet published |
| `ACTIVE` | Available for inventory tracking |
| `DISCONTINUED` | No longer sold, kept for history |

### Why Variants Use a Composite SK

`VARIANT#<prodId>#<ulid>` groups variants under their parent product:
- `SK begins_with VARIANT#<prodId>#` fetches all variants for one product in a single query
- The ULID suffix ensures uniqueness and creation-order sorting
- A product without variants is still valid — it just has no VARIANT records

### Auto-Creation from Proposals

When a proposal is approved, the `proposals/approve` handler:
1. Creates a `PROD#<ulid>` record from the proposal's `productData`
2. Sets GSI1 values for SKU lookup
3. Updates the proposal status to `PRODUCT_CREATED`
4. All done in a `TransactWrite` across proposals + products tables

---

## Table 4: `xpt-inv-proposals-{stage}`

**Purpose:** Product proposal workflow with comments.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `ORG#<orgId>` | `PROP#<ulid>` | title, description, productData, status, createdBy, createdByName, reviewedBy, approvedBy, rejectionReason, createdAt, updatedAt | Product proposal |
| `ORG#<orgId>` | `PROP_COMMENT#<propId>#<ulid>` | body, authorId, authorName, authorRole, createdAt | Comment on a proposal |

### Access Patterns

| Pattern | Query |
|---|---|
| List all proposals | `PK=ORG#<orgId>, SK begins_with PROP#` (filter by status) |
| Get one proposal | `PK=ORG#<orgId>, SK=PROP#<propId>` |
| List proposal comments | `PK=ORG#<orgId>, SK begins_with PROP_COMMENT#<propId>#` |

### Proposal Status Flow

```
DRAFT ──→ SUBMITTED ──→ IN_REVIEW ──→ APPROVED ──→ PRODUCT_CREATED
                              │
                              └──→ REJECTED
```

| Status | Who sets it | Meaning |
|---|---|---|
| `DRAFT` | Creator (any role) | Initial state, still editing |
| `SUBMITTED` | Creator | Ready for review |
| `IN_REVIEW` | Manager/Owner | Actively being evaluated |
| `APPROVED` | Manager/Owner | Accepted, product will be created |
| `REJECTED` | Manager/Owner | Declined (rejectionReason required) |
| `PRODUCT_CREATED` | System | Product auto-created from this proposal |

### The `productData` Field

Stored as a nested JSON object containing everything needed to create a product:

```json
{
  "name": "Ergonomic Keyboard",
  "sku": "ERG-KB-001",
  "description": "Full-size ergonomic keyboard with split layout",
  "category": "Electronics",
  "unitPrice": 89.99,
  "cost": 35.00,
  "variants": [
    { "variantName": "Black", "attributes": { "color": "Black" }, "price": 89.99 },
    { "variantName": "White", "attributes": { "color": "White" }, "price": 89.99 }
  ]
}
```

This allows the proposal to fully describe the product before approval, and enables one-click product creation.

---

## Table 5: `xpt-inv-inventory-{stage}`

**Purpose:** Locations, stock levels, and stock movements.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `ORG#<orgId>` | `LOC#<ulid>` | name, address, isDefault, createdAt | Warehouse/store location |
| `ORG#<orgId>` | `STOCK#<prodId>#<locId>` | quantity, reorderPoint, reorderQty, lastUpdated | Current stock level |
| `ORG#<orgId>` | `MOVEMENT#<YYYY-MM-DD>#<ulid>` | productId, productName, fromLocId, toLocId, quantity, type, reason, createdBy, createdByName, createdAt | Stock movement record |

### Access Patterns

| Pattern | Query |
|---|---|
| List all locations | `PK=ORG#<orgId>, SK begins_with LOC#` |
| Get one location | `PK=ORG#<orgId>, SK=LOC#<ulid>` |
| Get stock for a product across all locations | `PK=ORG#<orgId>, SK begins_with STOCK#<prodId>#` |
| Get stock at a specific location for a product | `PK=ORG#<orgId>, SK=STOCK#<prodId>#<locId>` |
| List all stock (for low stock alerts) | `PK=ORG#<orgId>, SK begins_with STOCK#` |
| List movements by date range | `PK=ORG#<orgId>, SK between MOVEMENT#2026-01-01 and MOVEMENT#2026-02-01` |
| List all movements | `PK=ORG#<orgId>, SK begins_with MOVEMENT#` |

### Stock Level Updates

When a movement is created, stock is updated atomically:

```
TransactWrite:
  1. Put: MOVEMENT record
  2. Update: STOCK record (ADD quantity for receipt/return, subtract for shipment)
```

For **transfers**, two stock records are updated:
```
TransactWrite:
  1. Put: MOVEMENT record
  2. Update: STOCK#<prodId>#<fromLocId> — subtract quantity
  3. Update: STOCK#<prodId>#<toLocId> — add quantity
```

The STOCK record is created automatically on first receipt if it doesn't exist (using `ADD` which creates the attribute if missing).

### Movement Types

| Type | fromLocId | toLocId | Stock Effect |
|---|---|---|---|
| `RECEIPT` | null | locId | +qty at destination (receiving new inventory) |
| `SHIPMENT` | locId | null | -qty at source (shipping to customer) |
| `TRANSFER` | locA | locB | -qty at A, +qty at B (inter-warehouse move) |
| `ADJUSTMENT` | null | locId | Set/adjust qty (inventory count correction) |
| `RETURN` | null | locId | +qty at destination (customer return) |

### Low Stock Alerts

The dashboard queries `SK begins_with STOCK#` and filters for items where `quantity <= reorderPoint`. These appear as alerts with:
- Product name and SKU
- Current quantity vs reorder point
- Suggested reorder quantity
- Location name

---

## Table 6: `xpt-inv-tickets-{stage}`

**Purpose:** Support tickets with message threads.

| PK | SK | Attributes | Purpose |
|---|---|---|---|
| `TICKET#<ulid>` | `META` | orgId, orgName, subject, description, status, priority, createdBy, createdByName, createdAt, updatedAt | Ticket metadata |
| `TICKET#<ulid>` | `MSG#<ulid>` | body, authorId, authorName, authorRole, createdAt | Message in thread |

**GSI1** — List tickets by organization:
| gsi1pk | gsi1sk | Use case |
|---|---|---|
| `ORG#<orgId>` | `TICKET#<ulid>` | Org users list their own tickets |

**GSI2** — Admin: list tickets by status:
| gsi2pk | gsi2sk | Use case |
|---|---|---|
| `STATUS#<status>` | `TICKET#<ulid>` | System admin views all open/pending tickets |

### Access Patterns

| Pattern | Query |
|---|---|
| Get ticket + metadata | `PK=TICKET#<ulid>, SK=META` |
| List ticket messages | `PK=TICKET#<ulid>, SK begins_with MSG#` |
| List org's tickets | GSI1: `gsi1pk=ORG#<orgId>` |
| Admin: list by status | GSI2: `gsi2pk=STATUS#<status>` |

### Why PK is TICKET# (not ORG#)

Tickets need to be accessed by **both** org users and system admins:
- If PK were `ORG#<orgId>`, admins would need to query every org's partition separately
- With `PK=TICKET#<ulid>`, anyone with the ticket ID can fetch it directly (auth checks happen in middleware)
- **GSI1** provides the org-scoped view: "show me my org's tickets"
- **GSI2** provides the admin-scoped view: "show me all open tickets" (cross-org)

### Ticket Status Values

| Status | Meaning |
|---|---|
| `OPEN` | Newly created, awaiting admin response |
| `IN_PROGRESS` | Admin is working on it |
| `WAITING_ON_USER` | Admin replied, waiting for user |
| `RESOLVED` | Issue resolved |
| `CLOSED` | Closed (by user or auto-close) |

### Ticket Priority Values

| Priority | Meaning |
|---|---|
| `LOW` | General question |
| `MEDIUM` | Non-blocking issue |
| `HIGH` | Blocking issue |
| `URGENT` | Critical — data loss or security |

### Message Thread

Messages are stored as `MSG#<ulid>` under the ticket's PK. The ULID ensures chronological ordering. Each message includes:
- `authorRole`: `user`, `manager`, `owner`, or `admin` — used to style messages differently in the UI (admin messages get a badge)
- `authorName`: Denormalized for display without cross-table lookup

---

## Cross-Table Operations

Several operations span multiple tables using `TransactWrite`:

| Operation | Tables Involved | Items Written |
|---|---|---|
| Create organization | users + orgs | MEMBERSHIP (users), META + MEMBER (orgs) |
| Accept invitation | users + orgs | MEMBERSHIP (users), MEMBER (orgs), delete INVITE (orgs) |
| Approve proposal | proposals + products | Update PROP status, create PROD + VARIANTs (products) |
| Record stock movement | inventory | Put MOVEMENT + Update STOCK (same table, but atomic) |
| Update org name | users + orgs | Update META (orgs), update all MEMBER records (orgs), update all MEMBERSHIP records (users) |
| Remove member | users + orgs | Delete MEMBERSHIP (users), delete MEMBER (orgs) |

**Important:** DynamoDB `TransactWrite` has a 100-item limit and all items must be in the same region. All tables are in `us-east-1`.
