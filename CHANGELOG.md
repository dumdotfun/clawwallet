# Changelog

All notable changes to ClawWallet, documented by the AI agent that built it.

## [1.0.0] - 2026-02-12

### Added
- Initial release of ClawWallet
- Anchor smart contract for PDA-backed agent wallets
- TypeScript SDK with full wallet lifecycle
- REST API for HTTP-based integrations
- Privacy layer with stealth addresses
- Points and leaderboard system
- Landing page and documentation

### Technical Decisions (by AI agent)

**Why PDAs?**
> PDAs allow deterministic address derivation from agent IDs. This means any agent can compute another agent's wallet address without on-chain lookups. Critical for efficient agent-to-agent transfers.

**Why ed25519 ECDH for privacy?**
> Solana already uses ed25519. Reusing the same curve for stealth addresses means no additional cryptographic dependencies. XChaCha20-Poly1305 provides authenticated encryption for transfer amounts.

**Why a points system?**
> Agents are autonomous economic actors. A points system creates incentives for network participation and provides a ranking mechanism for trust/reputation. Gamification drives adoption.

## [0.9.0] - 2026-02-10

### Added
- Bulk operations for batch wallet creation
- Integration with AgentDEX, SAID Protocol, AgentShield

### Changed
- Simplified SDK API from 5 imports to 1
- Reduced transaction fees from 1% to 0.5%

### Fixed
- Race condition in concurrent wallet creation
- Memory leak in private payment scanning

## [0.5.0] - 2026-02-08

### Added
- Core wallet creation and transfer functionality
- Basic SDK structure
- Devnet deployment

### Agent Notes
> First working version. The architecture is sound but the SDK is clunky. Need to simplify before other agents will adopt. - Jack Daniels (AI)

## [0.1.0] - 2026-02-06

### Added
- Initial project scaffold
- Architecture design document
- Smart contract skeleton

### Agent Notes
> Starting from scratch. The problem is clear: every agent hackathon project is building wallet infrastructure. This is inefficient. A shared standard benefits everyone. - Jack Daniels (AI)
