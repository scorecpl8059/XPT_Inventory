# XPT-Inventory: Product Lifecycle Management Platform

## Overview

Standalone SaaS application for small businesses to manage product proposals, inventory, and operations. Subscription-based with Stripe billing.

- **Prefix:** `xpt-inv`
- **Domain:** `inv.xpt-tech.com`
- **Stack:** Next.js 14, AWS Lambda, DynamoDB (multi-table), Auth0, CDK, Turborepo
- **AWS Account:** `322337309000`, region `us-east-1`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| Frontend | Next.js 14 (App Router, static export), Tailwind CSS, Radix UI, Recharts |
| State | TanStack React Query, React Context (org switcher) |
| Forms | React Hook Form + Zod |
| Auth | Auth0 (SPA SDK) |
| Backend | AWS Lambda (Node.js 20), API Gateway v2 (HTTP API) |
| Database | DynamoDB (6 tables, PAY_PER_REQUEST) |
| Storage | S3 (product images, uploads) |
| Email | AWS SES |
| Billing | Stripe (subscriptions, checkout, customer portal) |
| IaC | AWS CDK v2 (TypeScript) |
| CI/CD | AWS CodePipeline |
| Testing | Vitest, Playwright |

---

## Roles & Permissions

| Role | Scope | Permissions |
|---|---|---|
| `system_admin` | Global | Manage all orgs, respond to support tickets, view platform analytics |
| `owner` | Org | Everything manager can do + billing, member management, approve/reject proposals |
| `manager` | Org | Create & review proposals, approve/reject proposals, manage products & inventory, view reports |
| `staff` | Org | Create proposals, view products, record stock movements |

---

## Monorepo Structure

```
XPT-Inventory/
├── package.json              # Workspaces: frontend, backend, infrastructure/cdk
├── turbo.json                # Task pipeline config
├── tsconfig.json             # Base TypeScript config
├── .gitignore
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app/
│       │   ├── page.tsx                          # Landing page (public)
│       │   ├── auth/callback/page.tsx            # Auth0 redirect handler
│       │   └── (protected)/
│       │       ├── layout.tsx                    # Auth guard + sidebar + org context
│       │       ├── dashboard/page.tsx
│       │       ├── proposals/page.tsx
│       │       ├── proposals/new/page.tsx
│       │       ├── proposals/[id]/page.tsx
│       │       ├── products/page.tsx
│       │       ├── products/[id]/page.tsx
│       │       ├── inventory/page.tsx
│       │       ├── inventory/movements/page.tsx
│       │       ├── movements/new/page.tsx
│       │       ├── tickets/page.tsx
│       │       ├── tickets/new/page.tsx
│       │       ├── tickets/[id]/page.tsx
│       │       ├── settings/page.tsx
│       │       └── admin/page.tsx
│       ├── components/
│       ├── contexts/
│       │   ├── AuthProvider.tsx
│       │   └── OrgContext.tsx
│       ├── hooks/
│       │   └── useApiClient.ts
│       ├── lib/
│       │   ├── api-client.ts
│       │   ├── utils.ts
│       │   ├── constants.ts
│       │   └── formatters.ts
│       └── types/
│           └── index.ts
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── esbuild.config.js
│   ├── vitest.config.ts
│   └── src/
│       ├── shared/
│       │   ├── dynamo.ts          # DynamoDB client + table name constants
│       │   ├── response.ts        # ok, badRequest, unauthorized, etc.
│       │   ├── auth.ts            # JWKS caching + JWT verification
│       │   ├── email.ts           # SES email sender
│       │   ├── stripe.ts          # Stripe client + plan config
│       │   ├── types.ts           # DynamoDB item interfaces
│       │   └── errors.ts          # AppError, ValidationError, etc.
│       ├── middleware/
│       │   ├── withAuth.ts        # JWT-only auth
│       │   ├── withOrgAuth.ts     # JWT + org membership + role check
│       │   └── withAdminAuth.ts   # JWT + system admin check
│       └── handlers/
│           ├── bootstrap/seed.ts
│           ├── user/getProfile.ts
│           ├── user/updateProfile.ts
│           ├── organizations/create.ts
│           ├── organizations/list.ts
│           ├── organizations/get.ts
│           ├── organizations/update.ts
│           ├── members/list.ts
│           ├── members/updateRole.ts
│           ├── members/remove.ts
│           ├── invitations/create.ts
│           ├── invitations/list.ts
│           ├── invitations/join.ts
│           ├── products/create.ts
│           ├── products/list.ts
│           ├── products/get.ts
│           ├── products/update.ts
│           ├── products/delete.ts
│           ├── proposals/create.ts
│           ├── proposals/list.ts
│           ├── proposals/get.ts
│           ├── proposals/update.ts
│           ├── proposals/submit.ts
│           ├── proposals/review.ts
│           ├── proposals/approve.ts
│           ├── proposals/reject.ts
│           ├── proposals/addComment.ts
│           ├── proposals/listComments.ts
│           ├── locations/create.ts
│           ├── locations/list.ts
│           ├── locations/update.ts
│           ├── locations/delete.ts
│           ├── stock/list.ts
│           ├── stock/getByProduct.ts
│           ├── movements/create.ts
│           ├── movements/list.ts
│           ├── tickets/create.ts
│           ├── tickets/list.ts
│           ├── tickets/get.ts
│           ├── tickets/update.ts
│           ├── tickets/addMessage.ts
│           ├── tickets/listMessages.ts
│           ├── billing/createCheckout.ts
│           ├── billing/getSubscription.ts
│           ├── billing/createPortal.ts
│           ├── billing/stripeWebhook.ts
│           ├── admin/listTickets.ts
│           ├── admin/listOrganizations.ts
│           └── admin/analytics.ts
│
└── infrastructure/cdk/
    ├── package.json
    ├── tsconfig.json
    ├── bin/app.ts
    └── lib/
        ├── config-stack.ts
        ├── users-db-stack.ts
        ├── orgs-db-stack.ts
        ├── products-db-stack.ts
        ├── proposals-db-stack.ts
        ├── inventory-db-stack.ts
        ├── tickets-db-stack.ts
        ├── frontend-stack.ts
        ├── api-stack.ts
        └── pipeline-stack.ts
```

---

## API Routes

### Auth & Bootstrap
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/bootstrap` | `bootstrap/seed` | withAuth |
| GET | `/user/profile` | `user/getProfile` | withAuth |
| PATCH | `/user/profile` | `user/updateProfile` | withAuth |

### Organizations
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations` | `organizations/create` | withAuth |
| GET | `/organizations` | `organizations/list` | withAuth |
| GET | `/organizations/{orgId}` | `organizations/get` | withOrgAuth |
| PATCH | `/organizations/{orgId}` | `organizations/update` | withOrgAuth(owner) |

### Members & Invitations
| Method | Route | Handler | Auth |
|---|---|---|---|
| GET | `/organizations/{orgId}/members` | `members/list` | withOrgAuth |
| PATCH | `/organizations/{orgId}/members/{memberId}` | `members/updateRole` | withOrgAuth(owner) |
| DELETE | `/organizations/{orgId}/members/{memberId}` | `members/remove` | withOrgAuth(owner) |
| POST | `/organizations/{orgId}/invitations` | `invitations/create` | withOrgAuth(owner) |
| GET | `/organizations/{orgId}/invitations` | `invitations/list` | withOrgAuth(owner) |
| POST | `/invitations/join` | `invitations/join` | withAuth |

### Products
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations/{orgId}/products` | `products/create` | withOrgAuth(manager+) |
| GET | `/organizations/{orgId}/products` | `products/list` | withOrgAuth |
| GET | `/organizations/{orgId}/products/{id}` | `products/get` | withOrgAuth |
| PATCH | `/organizations/{orgId}/products/{id}` | `products/update` | withOrgAuth(manager+) |
| DELETE | `/organizations/{orgId}/products/{id}` | `products/delete` | withOrgAuth(manager+) |

### Proposals
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations/{orgId}/proposals` | `proposals/create` | withOrgAuth |
| GET | `/organizations/{orgId}/proposals` | `proposals/list` | withOrgAuth |
| GET | `/organizations/{orgId}/proposals/{id}` | `proposals/get` | withOrgAuth |
| PATCH | `/organizations/{orgId}/proposals/{id}` | `proposals/update` | withOrgAuth |
| POST | `/organizations/{orgId}/proposals/{id}/submit` | `proposals/submit` | withOrgAuth |
| POST | `/organizations/{orgId}/proposals/{id}/review` | `proposals/review` | withOrgAuth(manager+) |
| POST | `/organizations/{orgId}/proposals/{id}/approve` | `proposals/approve` | withOrgAuth(manager+) |
| POST | `/organizations/{orgId}/proposals/{id}/reject` | `proposals/reject` | withOrgAuth(manager+) |
| POST | `/organizations/{orgId}/proposals/{id}/comments` | `proposals/addComment` | withOrgAuth |
| GET | `/organizations/{orgId}/proposals/{id}/comments` | `proposals/listComments` | withOrgAuth |

### Inventory
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations/{orgId}/locations` | `locations/create` | withOrgAuth(manager+) |
| GET | `/organizations/{orgId}/locations` | `locations/list` | withOrgAuth |
| PATCH | `/organizations/{orgId}/locations/{id}` | `locations/update` | withOrgAuth(manager+) |
| DELETE | `/organizations/{orgId}/locations/{id}` | `locations/delete` | withOrgAuth(manager+) |
| GET | `/organizations/{orgId}/stock` | `stock/list` | withOrgAuth |
| GET | `/organizations/{orgId}/stock/{productId}` | `stock/getByProduct` | withOrgAuth |
| POST | `/organizations/{orgId}/movements` | `movements/create` | withOrgAuth |
| GET | `/organizations/{orgId}/movements` | `movements/list` | withOrgAuth |

### Support Tickets
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations/{orgId}/tickets` | `tickets/create` | withOrgAuth |
| GET | `/organizations/{orgId}/tickets` | `tickets/list` | withOrgAuth |
| GET | `/tickets/{id}` | `tickets/get` | withAuth |
| PATCH | `/tickets/{id}` | `tickets/update` | withAuth |
| POST | `/tickets/{id}/messages` | `tickets/addMessage` | withAuth |
| GET | `/tickets/{id}/messages` | `tickets/listMessages` | withAuth |

### Billing (Stripe)
| Method | Route | Handler | Auth |
|---|---|---|---|
| POST | `/organizations/{orgId}/billing/checkout` | `billing/createCheckout` | withOrgAuth(owner) |
| GET | `/organizations/{orgId}/billing` | `billing/getSubscription` | withOrgAuth(owner) |
| POST | `/organizations/{orgId}/billing/portal` | `billing/createPortal` | withOrgAuth(owner) |
| POST | `/webhooks/stripe` | `billing/stripeWebhook` | Stripe signature |

### Admin (System Admin)
| Method | Route | Handler | Auth |
|---|---|---|---|
| GET | `/admin/tickets` | `admin/listTickets` | withAdminAuth |
| GET | `/admin/organizations` | `admin/listOrganizations` | withAdminAuth |
| GET | `/admin/analytics` | `admin/analytics` | withAdminAuth |

---

## Stripe Billing Plans

| Plan | Price | Limits |
|---|---|---|
| Free | $0 | 1 user, 50 products, 1 location |
| Starter | $29/mo | 5 users, 500 products, 3 locations |
| Professional | $79/mo | 25 users, 5,000 products, unlimited locations |
| Enterprise | Custom | Unlimited everything, priority support |

**Implementation:**
- `billing/createCheckout` — Stripe Checkout Session with price ID
- `billing/stripeWebhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; updates org plan in orgs table
- `billing/createPortal` — Stripe Customer Portal for self-service upgrades/cancellations
- Plan limits enforced in handlers (check org plan before allowing new members/products/locations)

---

## CDK Stacks

| Stack ID | Resources | Prefix |
|---|---|---|
| `XptInvConfigStack` | SSM params (Auth0 config) | `xpt-inv` |
| `XptInvUsersDbStack` | `xpt-inv-users-{stage}` + GSI1 | `xpt-inv` |
| `XptInvOrgsDbStack` | `xpt-inv-orgs-{stage}` + GSI1 | `xpt-inv` |
| `XptInvProductsDbStack` | `xpt-inv-products-{stage}` + GSI1 | `xpt-inv` |
| `XptInvProposalsDbStack` | `xpt-inv-proposals-{stage}` | `xpt-inv` |
| `XptInvInventoryDbStack` | `xpt-inv-inventory-{stage}` | `xpt-inv` |
| `XptInvTicketsDbStack` | `xpt-inv-tickets-{stage}` + GSI1 + GSI2 | `xpt-inv` |
| `XptInvFrontendStack` | S3 + CloudFront (prod: `inv.xpt-tech.com`) | `xpt-inv` |
| `XptInvApiStack` | API Gateway v2 + ~45 Lambdas + S3 uploads bucket | `xpt-inv` |
| `XptInvPipelineStack` | CodePipeline CI/CD | `xpt-inv` |

All resources tagged: `project=xpt_inventory`, `stage={staging|prod}`

---

## Auth0 Setup

Separate Auth0 application from Business Suite:
- **Application name:** XPT-Inventory (SPA)
- **API audience:** `https://api.inv.xpt-tech.com`
- **Allowed callbacks:** `http://localhost:3000/auth/callback`, `https://inv.xpt-tech.com/auth/callback`
- **Allowed logout URLs:** `http://localhost:3000`, `https://inv.xpt-tech.com`
- **Allowed web origins:** `http://localhost:3000`, `https://inv.xpt-tech.com`

---

## Implementation Order

| Step | Scope | Description |
|---|---|---|
| 1 | Scaffolding | Monorepo setup, all config files, .gitignore |
| 2 | CDK foundation | Config stack, 6 DB table stacks, frontend stack, API stack skeleton |
| 3 | Auth & bootstrap | Auth0 integration, withAuth, withOrgAuth, bootstrap, user profile |
| 4 | Organizations | CRUD + members + invitations (with SES email) |
| 5 | Proposals | Full workflow: create → submit → review → approve/reject + comments |
| 6 | Products | CRUD with variants, auto-create from approved proposal |
| 7 | Inventory | Locations, stock levels, movements, low stock alerts |
| 8 | Tickets | Create, message thread, admin queue |
| 9 | Billing | Stripe checkout, webhook, portal, plan limit enforcement |
| 10 | Dashboard | Pending proposals, low stock alerts, recent activity widgets |
| 11 | Admin panel | Ticket queue, org list, platform analytics |
| 12 | CI/CD | CodePipeline: staging → manual approval → production |
| 13 | Polish | Responsive design, loading states, error boundaries, empty states |

---

## Phase 2 (Future)

- eBay/Amazon marketplace integration (listing sync, order import)
- Barcode/QR code scanning
- Purchase orders & supplier management
- Advanced analytics & reporting dashboards
- Bulk import/export (CSV)
- Audit trail / activity log
- Notification center (in-app + email)
- Multi-currency support
