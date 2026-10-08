# Full Circle

A Cairo clothing development and manufacturing partner. Its website explains the service, takes
sample requests, and gives each client brand a page to follow its orders through production.

## Language

### Brands and people

**Brand**:
A clothing label that works with Full Circle. On the site, the visitor or client.
_Avoid_: Customer, account

**Path**:
Where a brand is when it arrives: **Starting** (an idea or a sketch, no factory yet, enters at
stage 01) or **Scaling** (already selling, enters at stage 04).

**Client**:
A brand with at least one order, whose people can sign in to the portal.
_Avoid_: Customer, user

**Client member**:
A person who signs in for a client. A client can have several.

**Staff**:
Full Circle's own people who use the admin view. Each is an **owner** or **staff**.
_Avoid_: Admin (that is the name of the view, not of a person)

### Work

**Request**:
A brand's first message through the request form: path, product, pieces per style, what they
have, contact, optional files. Not yet a commitment.
_Avoid_: Lead, enquiry, quote

**Code**:
The reference a brand gets with its request (`FC-####`), which stays with the order that follows.
It identifies; it never grants access.

**Order**:
A product being developed and made for a client, moving through the eight stages.
_Avoid_: Job, project

**Stage**:
One of eight steps every order goes through, in order: Research, Design support, Sourcing,
Development, Sampling, Production, QC, Delivery. Each ends with something the client can see.

**Entry stage**:
The stage an order starts at: 01 for Starting brands, 04 for Scaling brands.

**Decision**:
What staff ask a client to approve at the end of a stage (the brief, the tech pack, a fabric, a
pattern, a sample).

**Sample gate**:
The decision at stage 05. Bulk production cannot start until the client approves a sample, and the
approved sample becomes the reference every bulk piece is measured against.

**Approval log**:
The permanent record of an order's decisions, requests and stage moves, kept with the order. Entries
are never edited or deleted.

**Stage photo**:
A photo of an order at a stage, uploaded by staff or asked for by the client.

**Portal**:
The signed-in part of the site where client members follow their orders (`/track`).
_Avoid_: Dashboard, account page

**Admin**:
The staff-only view for answering requests and running orders (`/admin`).
