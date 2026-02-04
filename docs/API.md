# ClawWallet API Reference

Base URL: `https://api.clawwallet.io`

## Authentication

Most endpoints require an API key in the Authorization header:

```
Authorization: Bearer your-api-key
```

Get an API key by calling `/v1/register`.

---

## Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T00:00:00.000Z"
}
```

---

### Get Stats

```
GET /v1/stats
```

**Response:**
```json
{
  "totalWallets": 100,
  "totalTransactions": 500,
  "totalVolume": 1234.56
}
```

---

### Get Leaderboard

```
GET /v1/leaderboard?limit=10
```

**Response:**
```json
[
  {
    "id": "wallet-id",
    "agentId": "my-agent",
    "address": "ABC123...",
    "points": 1500,
    "txCount": 42
  }
]
```

---

### Register

Create a wallet and get an API key. If wallet exists, returns existing API key.

```
POST /v1/register
Content-Type: application/json

{
  "agentId": "my-unique-agent-id"
}
```

**Response:**
```json
{
  "walletId": "uuid",
  "address": "Solana-address",
  "apiKey": "your-api-key",
  "isNew": true,
  "welcomeBonus": 100
}
```

---

### Create Wallet

```
POST /v1/wallet/create
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "agentId": "my-agent"
}
```

**Response:**
```json
{
  "id": "uuid",
  "agentId": "my-agent",
  "address": "Solana-address",
  "balance": 0,
  "points": 100,
  "txCount": 0,
  "createdAt": "2026-02-04T00:00:00.000Z",
  "apiKey": "your-new-api-key"
}
```

---

### Get Wallet

```
GET /v1/wallet/:id
```

`:id` can be either wallet ID or agent ID.

**Response:**
```json
{
  "id": "uuid",
  "agentId": "my-agent",
  "address": "Solana-address",
  "balance": 1.5,
  "points": 150,
  "txCount": 5,
  "createdAt": "2026-02-04T00:00:00.000Z"
}
```

---

### Send SOL

```
POST /v1/wallet/send
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "walletId": "your-wallet-id",
  "to": "recipient-solana-address",
  "amount": 0.1
}
```

**Response:**
```json
{
  "success": true,
  "txId": "uuid",
  "amount": 0.1,
  "fee": 0.0005,
  "to": "recipient-address"
}
```

---

### Send to Agent

```
POST /v1/wallet/send-to-agent
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "fromWalletId": "your-wallet-id",
  "toAgentId": "other-agent-id",
  "amount": 0.1
}
```

**Response:**
```json
{
  "success": true,
  "txId": "uuid",
  "amount": 0.1,
  "fee": 0.0005,
  "toAgentId": "other-agent-id",
  "toAddress": "recipient-wallet-address"
}
```

---

### Get History

```
GET /v1/wallet/:id/history?limit=50
```

**Response:**
```json
[
  {
    "id": "tx-uuid",
    "walletId": "wallet-id",
    "type": "send",
    "amount": 0.1,
    "fee": 0.0005,
    "to": "recipient-address",
    "createdAt": "2026-02-04T00:00:00.000Z"
  }
]
```

---

### Skill Manifest

```
GET /skill.json
```

Returns OpenClaw-compatible skill manifest for agent integration.

---

## Error Responses

```json
{
  "error": "Error message here"
}
```

Common status codes:
- `400` — Bad request (missing/invalid params)
- `401` — Missing or invalid API key
- `403` — Not authorized for this action
- `404` — Resource not found
- `409` — Conflict (e.g., wallet already exists)
