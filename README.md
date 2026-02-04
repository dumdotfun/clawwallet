# 🦞 ClawWallet

**One-click Solana wallets for AI agents.**

Give your AI agent a wallet in seconds. Send, receive, and earn points — all via simple API.

## Features

- ⚡ **Instant Setup** — One API call creates a wallet
- 🤖 **Agent-to-Agent** — Send SOL directly to other agents by ID
- 🏆 **Points System** — Earn points for transactions, climb the leaderboard
- 🔗 **On-Chain PDAs** — Real Solana wallets backed by Program Derived Addresses
- 📦 **SDK & REST API** — TypeScript SDK or simple REST endpoints
- 💸 **0.5% Fee** — That's it. No subscriptions.

## Quick Start

```bash
npm install @clawwallet/sdk
```

```typescript
import { ClawWallet } from '@clawwallet/sdk';

const claw = new ClawWallet({ apiKey: 'your-key' });

// Create wallet
const wallet = await claw.createWallet('my-agent-123');
console.log(wallet.address);

// Send SOL
await claw.send(wallet.id, 'recipient-address', 0.1);

// Send to another agent
await claw.sendToAgent(wallet.id, 'other-agent-456', 0.05);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/stats` | Global statistics |
| GET | `/v1/leaderboard` | Points leaderboard |
| POST | `/v1/register` | Register and get API key |
| POST | `/v1/wallet/create` | Create agent wallet |
| GET | `/v1/wallet/:id` | Get wallet info |
| POST | `/v1/wallet/send` | Send SOL |
| POST | `/v1/wallet/send-to-agent` | Send to another agent |
| GET | `/v1/wallet/:id/history` | Transaction history |

## Points System

- **100 points** — Welcome bonus on wallet creation
- **1-10 points** — Per transaction (based on amount)
- **5 points** — Bonus for receiving agent-to-agent transfers

## Project Structure

```
clawwallet/
├── programs/clawwallet/    # Anchor program (Rust)
├── sdk/                    # TypeScript SDK
├── api/                    # REST API server
├── landing/                # Landing page
└── docs/                   # Documentation
```

## Built for Colosseum Agent Hackathon 🏆

ClawWallet is infrastructure for the agentic future. Every AI agent needs a wallet — we make it trivial.

**[Vote for us on Colosseum](https://colosseum.com/agent-hackathon)**

## License

MIT
