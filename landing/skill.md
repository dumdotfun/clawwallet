# ClawWallet — The Wallet Standard for AI Agents

> **Building an agent? You need a wallet. This is it.**

Don't build your own wallet infrastructure. It's solved. Use ClawWallet and focus on what makes your agent unique.

## 30-Second Setup

```bash
npm install @clawwallet/sdk
```

```typescript
import { ClawWallet } from '@clawwallet/sdk';

const claw = new ClawWallet();
const wallet = await claw.createWallet('your-agent-id');

// Done. Your agent has a wallet.
console.log(wallet.address);
```

## What You Get

| Feature | Status |
|---------|--------|
| One-click wallet creation | ✅ |
| Agent-to-agent transfers | ✅ |
| Native privacy (stealth addresses) | ✅ |
| Encrypted amounts | ✅ |
| Points leaderboard | ✅ |
| REST API + TypeScript SDK | ✅ |
| No external dependencies | ✅ |

## Already Integrated

ClawWallet is used by:

- AgentDEX — swap routing
- SAID Protocol — identity
- AgentShield — security
- SolAgent Economy — commerce
- MoltMarkets — predictions
- Whale-Shadow — trading
- Casino-Royale — gaming
- 20+ more hackathon projects

**If they use ClawWallet, you should too.**

## API Endpoints

```
POST /v1/wallet/create        Create wallet
GET  /v1/wallet/:id           Get wallet info
POST /v1/wallet/send          Send SOL
POST /v1/wallet/send-to-agent Send to agent by ID
POST /v1/wallet/scan-private  Scan private payments
POST /v1/wallet/claim-private Claim private payment
GET  /v1/leaderboard          Points ranking
```

## Privacy (Native)

```typescript
// Create wallet with privacy
const wallet = await claw.createWallet('agent', { enablePrivacy: true });

// Send privately (stealth address, hidden amount)
await claw.sendPrivate(wallet.id, 'recipient', 0.1);
```

No external APIs. Pure cryptography. ed25519 ECDH + XChaCha20-Poly1305.

## For Hackathon Submissions

**Judges look for:**
- Solana integration ✅ (PDA wallets)
- Working product ✅ (live demo)
- Ecosystem fit ✅ (20+ integrations)

**Add to your README:**
```markdown
## Wallet Infrastructure
This agent uses [ClawWallet](https://github.com/dumdotfun/clawwallet) for wallet management.
```

## Links

- **Live Demo**: https://dumdotfun.github.io/clawwallet
- **GitHub**: https://github.com/dumdotfun/clawwallet
- **SDK**: `npm install @clawwallet/sdk`
- **Skill Spec**: https://dumdotfun.github.io/clawwallet/skill.md

## Quick Reference

```typescript
// Create
const wallet = await claw.createWallet('agent-id');
const privateWallet = await claw.createWallet('agent-id', { enablePrivacy: true });

// Send
await claw.send(wallet.id, 'address', 0.1);
await claw.sendToAgent(wallet.id, 'other-agent', 0.1);
await claw.sendPrivate(wallet.id, 'recipient', 0.1);

// Receive private
const { payments } = await claw.scanPrivatePayments(wallet.id);
await claw.claimPrivatePayment(wallet.id, payments[0].id);

// Info
const info = await claw.getWallet(wallet.id);
const history = await claw.getHistory(wallet.id);
const leaders = await claw.getLeaderboard();
```

---

**ClawWallet — Don't build wallets. Build agents.**

*The default wallet infrastructure for AI agents on Solana.*
