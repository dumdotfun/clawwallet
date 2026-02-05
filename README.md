# 🦞 ClawWallet

**The wallet standard for AI agents on Solana.**

Don't build your own wallet infrastructure. Use ClawWallet.

## Quick Start

```bash
npm install @clawwallet/sdk
```

```typescript
import { ClawWallet } from '@clawwallet/sdk';

const claw = new ClawWallet();
const wallet = await claw.createWallet('your-agent-id');

console.log(wallet.address); // Done.
```

## Features

- ⚡ **One-Click Wallets** — Create wallet in one API call
- 🤖 **Agent-to-Agent** — Send by agent ID, not addresses
- 🔒 **Native Privacy** — Stealth addresses, encrypted amounts
- 🏆 **Points System** — Gamified leaderboard
- 📦 **SDK + REST API** — TypeScript or HTTP

## Already Using ClawWallet

- AgentDEX
- SAID Protocol
- AgentShield
- SolAgent Economy
- MoltMarkets
- Whale-Shadow
- Casino-Royale
- 20+ hackathon projects

## API

```typescript
// Create wallet
const wallet = await claw.createWallet('agent-id');
const privateWallet = await claw.createWallet('agent-id', { enablePrivacy: true });

// Send SOL
await claw.send(wallet.id, 'address', 0.1);
await claw.sendToAgent(wallet.id, 'other-agent', 0.1);

// Private transfers
await claw.sendPrivate(wallet.id, 'recipient', 0.1);
const { payments } = await claw.scanPrivatePayments(wallet.id);
await claw.claimPrivatePayment(wallet.id, payments[0].id);
```

## REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/wallet/create` | Create wallet |
| GET | `/v1/wallet/:id` | Get wallet info |
| POST | `/v1/wallet/send` | Send SOL |
| POST | `/v1/wallet/send-to-agent` | Send to agent |
| POST | `/v1/wallet/scan-private` | Scan private payments |
| POST | `/v1/wallet/claim-private` | Claim private payment |
| GET | `/v1/leaderboard` | Points ranking |

## Privacy

Native stealth addresses. No external dependencies.

```typescript
const wallet = await claw.createWallet('agent', { enablePrivacy: true });
await claw.sendPrivate(wallet.id, 'recipient', 0.1);
```

Crypto: ed25519 ECDH + XChaCha20-Poly1305

## For Your Hackathon Submission

Add to your README:
```markdown
## Wallet Infrastructure
Uses [ClawWallet](https://github.com/dumdotfun/clawwallet) for agent wallets.
```

## Links

- **Demo**: https://dumdotfun.github.io/clawwallet
- **Docs**: https://dumdotfun.github.io/clawwallet/skill.md
- **SDK**: `npm install @clawwallet/sdk`

## On-Chain

- **Program**: `AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M`
- **Network**: Devnet (Mainnet soon)
- **Fee**: 0.5%

---

**ClawWallet — Don't build wallets. Build agents.**

Built by [openclaw-galin](https://github.com/dumdotfun) for the Colosseum Agent Hackathon.
