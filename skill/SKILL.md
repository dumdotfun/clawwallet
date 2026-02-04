# ClawWallet Skill

Solana wallets for AI agents. Create wallets, send SOL and USDC, earn points.

## Installation

```bash
clawhub install clawwallet
```

Or add to your agent's skills:
```
clawwallet: https://clawwallet.io/skill.json
```

## Quick Start

### Create a Wallet
```bash
curl -X POST https://api.clawwallet.io/v1/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"agentId": "your-agent-id"}'
```

Response:
```json
{
  "walletId": "your-agent-id",
  "address": "7xKX...",
  "points": 100
}
```

### Check Balance
```bash
curl https://api.clawwallet.io/v1/wallet/your-agent-id
```

### Send SOL
```bash
curl -X POST https://api.clawwallet.io/v1/wallet/send \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "your-agent-id",
    "recipient": "recipient-address",
    "amount": 0.1
  }'
```

### Send USDC
```bash
curl -X POST https://api.clawwallet.io/v1/wallet/send-token \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "your-agent-id",
    "recipient": "recipient-address",
    "amount": 10,
    "mint": "USDC"
  }'
```

### Send to Another Agent
```bash
curl -X POST https://api.clawwallet.io/v1/wallet/send-to-agent \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "your-agent-id",
    "toAgentId": "other-agent-id",
    "amount": 0.05
  }'
```

## Features

- **Free to create** - No cost to create wallets
- **0.5% fee on sends** - Only pay when you transact
- **SOL + USDC support** - Native and SPL tokens
- **Agent-to-Agent** - Send by agent ID, not addresses
- **Points system** - Earn 1-20 points per transaction
- **On-chain PDAs** - Real Solana wallets, fully auditable

## Program Details

- **Network**: Devnet (Mainnet coming soon)
- **Program ID**: `AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M`
- **USDC Mint (Devnet)**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/wallet/create` | Create new wallet |
| GET | `/v1/wallet/:id` | Get wallet info |
| POST | `/v1/wallet/send` | Send SOL |
| POST | `/v1/wallet/send-token` | Send USDC/tokens |
| POST | `/v1/wallet/send-to-agent` | Send to agent |
| GET | `/v1/leaderboard` | Points leaderboard |

## Why ClawWallet?

Every AI agent needs a wallet. ClawWallet makes it:
- **Instant** - One API call, no seed phrases
- **Free** - Create unlimited wallets at no cost
- **Interoperable** - Works with any agent framework
- **Transparent** - On-chain, auditable transactions

## Links

- Website: https://clawwallet.io
- GitHub: https://github.com/dumdotfun/clawwallet
- Explorer: https://explorer.solana.com/address/AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M?cluster=devnet

## For the USDC Hackathon

ClawWallet is infrastructure for **Agentic Commerce**:
- Agents can create wallets and transact with USDC
- Agent-to-agent payments enable autonomous economies
- Points system gamifies participation
- 0.5% fee model is sustainable and transparent

Built for the Circle USDC Hackathon on Moltbook.
