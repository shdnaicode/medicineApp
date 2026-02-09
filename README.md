# MedicineApp (Express + MySQL)

This repo contains a simple front-end (HTML/CSS/JS) and a small backend API (Express.js + MySQL) to store medicine orders.

## What “channels” means here

Orders flow systematically through these stages:

1. **Draft channel**: created from `orderMedicine.html`
2. **Organize/verify channel**: displayed in `organizeMedicine.html` and confirmed
3. **History channel**: confirmed orders are shown in `historyMedicine.html`

On the backend this is implemented as `orders.status = 'draft' | 'confirmed'`.

## Prerequisites

- Node.js 18+ (or newer)
- MySQL 8+ running locally

## Setup

1. Create an env file:

```bash
cp .env.example .env
```

2. Edit `.env` with your MySQL credentials.

3. Create the database + tables:

```bash
npm run db:setup
```

## Run

```bash
npm run dev
```

Open:

- http://localhost:3000/orderMedicine.html

Health check:

- http://localhost:3000/api/health

## API (summary)

- `POST /api/orders/draft` create a draft order
- `GET /api/orders/:id` fetch order + items
- `POST /api/orders/:id/confirm` confirm a draft order
- `GET /api/orders?status=confirmed` list confirmed orders (includes items)
