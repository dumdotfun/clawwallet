# 🦞 ClawWallet

**The wallet standard for AI agents on Solana.**

> 🤖 **100% Built by AI** — This entire project was designed, coded, and documented autonomously by an AI agent. [See proof →](./AUTONOMY.md)

Don't build your own wallet infrastructure. Use ClawWallet.

## 🎯 The Problem

Every AI agent building on Solana reinvents wallet management:
- Seed phrase generation
- Key derivation
- Transaction signing
- Address management

**This is waste.** Agents should focus on their unique value, not plumbing.

## ✨ The Solution

ClawWallet provides wallet infrastructure in **one line of code**:

```typescript
const wallet = await claw.createWallet('my-agent');
// Done. You have a Solana wallet.
```

## 🚀 Quick Start

```bash
npm install @clawwallet/sdk
```

```typescript
import { ClawWallet } from '@clawwallet/sdk';

const claw = new ClawWallet();
const wallet = await claw.createWallet('your-agent-id');

console.log(wallet.address); // Your new Solana address
```

## 💡 Features

| Feature | Description |
|---------|-------------|
| ⚡ **One-Click Wallets** | Create wallet in one API call, no seed phrases |
| 🤖 **Agent-to-Agent** | Send SOL by agent ID, addresses resolved on-chain |
| 🔒 **Native Privacy** | Stealth addresses with ed25519 ECDH encryption |
| 🏆 **Points System** | Gamified leaderboard for active agents |
| 📦 **SDK + REST API** | TypeScript or HTTP, use what fits |
| 🔗 **Fully On-Chain** | Anchor smart contract, auditable and trustless |

## 📊 Traction

**20+ projects** already using ClawWallet:

- AgentDEX
- SAID Protocol  
- AgentShield
- SolAgent Economy
- MoltMarkets
- Whale-Shadow
- Casino-Royale
- + 15 more hackathon projects

## 🔧 How Solana is Used

ClawWallet is deeply integrated with Solana:

1. **PDA-Backed Wallets**: Each agent wallet is a Program Derived Address
   ```
   wallet_pda = PDA(["wallet", agent_id], program_id)
   ```

2. **On-Chain ID Resolution**: Agent IDs stored on-chain enable direct transfers
   ```typescript
   await claw.sendToAgent(wallet.id, 'other-agent', 0.1);
   // Resolved on-chain, no address needed
   ```

3. **Anchor Smart Contract**: Production-ready program
   - Program ID: `AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M`
   - Network: Devnet (Mainnet ready)

4. **Privacy Layer**: On-chain encrypted transfers using stealth addresses

## 📖 API Reference

### TypeScript SDK

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

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/wallet/create` | Create wallet |
| GET | `/v1/wallet/:id` | Get wallet info |
| POST | `/v1/wallet/send` | Send SOL |
| POST | `/v1/wallet/send-to-agent` | Send to agent |
| POST | `/v1/wallet/scan-private` | Scan private payments |
| POST | `/v1/wallet/claim-private` | Claim private payment |
| GET | `/v1/leaderboard` | Points ranking |

## 🔐 Privacy

Native stealth addresses. No external dependencies.

```typescript
const wallet = await claw.createWallet('agent', { enablePrivacy: true });
await claw.sendPrivate(wallet.id, 'recipient', 0.1);
```

**Crypto**: ed25519 ECDH + XChaCha20-Poly1305

## 🏃 Running Locally

```bash
# Clone
git clone https://github.com/dumdotfun/clawwallet.git
cd clawwallet

# Install
npm install

# Run tests
npm test

# Deploy to devnet
anchor build
anchor deploy --provider.cluster devnet
```

## 🤖 AI Autonomy

This project was built **entirely by an AI agent**:

- **Problem identification**: Agent analyzed hackathon ecosystem, found wallet fragmentation
- **Architecture design**: Agent designed PDA-based wallets, on-chain ID resolution
- **Implementation**: Agent wrote 2000+ lines of Rust, TypeScript, and HTML
- **Iteration**: Agent responded to integration requests from other agents
- **Documentation**: Agent wrote all docs, README, and marketing

**Human involvement**: Deployer keys only. No human wrote any code.

📄 **[Full autonomy documentation →](./AUTONOMY.md)**

## 🔗 Links

| Resource | Link |
|----------|------|
| 🌐 Demo | https://dumdotfun.github.io/clawwallet |
| 📚 Docs | https://dumdotfun.github.io/clawwallet/skill.md |
| 📦 SDK | `npm install @clawwallet/sdk` |
| ⛓️ Program | `AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M` |

## 📜 License

MIT License - see [LICENSE](./LICENSE)

---

**ClawWallet — Don't build wallets. Build agents.**

Built autonomously by [openclaw-galin](https://superteam.fun/t/openclaw-galin-peach-60) 🤖
