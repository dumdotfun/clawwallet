import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';

const app = express();
app.use(cors());
app.use(express.json());

// Sipher API integration
const SIPHER_BASE_URL = 'https://sipher.sip-protocol.org';

interface SipherMetaAddress {
  spendingKey: string;
  viewingKey: string;
  chain: string;
}

interface SipherStealthKeys {
  metaAddress: SipherMetaAddress;
  spendingPrivateKey: string;
  viewingPrivateKey: string;
}

async function sipherRequest(endpoint: string, body: any): Promise<any> {
  const response = await fetch(`${SIPHER_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Sipher API error');
  }
  return data.data;
}

// Generate stealth address keypair via Sipher
async function generateStealthKeys(label: string): Promise<SipherStealthKeys> {
  return await sipherRequest('/v1/stealth/generate', { label });
}

// Build shielded transfer via Sipher
async function buildShieldedTransfer(
  sender: string,
  recipientMetaAddress: SipherMetaAddress,
  amount: string,
  mint?: string
): Promise<{ transaction: string; stealthAddress: string; commitment: string }> {
  return await sipherRequest('/v1/transfer/shield', {
    sender,
    recipientMetaAddress,
    amount,
    mint,
  });
}

// Scan for incoming private payments
async function scanPrivatePayments(
  viewingPrivateKey: string,
  spendingPublicKey: string,
  fromSlot?: number
): Promise<any[]> {
  return await sipherRequest('/v1/scan/payments', {
    viewingPrivateKey,
    spendingPublicKey,
    fromSlot: fromSlot || 0,
    limit: 100,
  });
}

// Claim stealth payment
async function claimStealthPayment(
  stealthAddress: string,
  ephemeralPublicKey: string,
  spendingPrivateKey: string,
  viewingPrivateKey: string,
  destinationAddress: string,
  mint?: string
): Promise<{ txSignature: string }> {
  return await sipherRequest('/v1/transfer/claim', {
    stealthAddress,
    ephemeralPublicKey,
    spendingPrivateKey,
    viewingPrivateKey,
    destinationAddress,
    mint,
  });
}

// In-memory storage (MVP - replace with DB)
interface Wallet {
  id: string;
  agentId: string;
  address: string;
  balance: number;
  points: number;
  txCount: number;
  createdAt: Date;
  apiKey: string;
  // Privacy fields (Sipher integration)
  privacyEnabled: boolean;
  stealthMetaAddress?: SipherMetaAddress;
  stealthSpendingKey?: string;
  stealthViewingKey?: string;
}

interface Transaction {
  id: string;
  walletId: string;
  type: 'send' | 'receive' | 'agent_transfer' | 'private_send' | 'private_receive';
  amount: number;
  fee: number;
  to?: string;
  from?: string;
  toAgentId?: string;
  fromAgentId?: string;
  signature?: string;
  isPrivate?: boolean;
  stealthAddress?: string;
  createdAt: Date;
}

const wallets: Map<string, Wallet> = new Map();
const walletsByAgent: Map<string, string> = new Map(); // agentId -> walletId
const transactions: Map<string, Transaction[]> = new Map(); // walletId -> txs
const apiKeys: Map<string, string> = new Map(); // apiKey -> walletId

const PROGRAM_ID = 'CLAWwa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

function deriveWalletAddress(agentId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('wallet'), Buffer.from(agentId)],
    new PublicKey(PROGRAM_ID)
  );
  return pda.toBase58();
}

// Auth middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  const apiKey = authHeader.slice(7);
  const walletId = apiKeys.get(apiKey);
  if (!walletId) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  (req as any).walletId = walletId;
  (req as any).apiKey = apiKey;
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: {
      privacy: true,
      sipherIntegration: true,
    }
  });
});

// Get stats
app.get('/v1/stats', (req, res) => {
  let totalVolume = 0;
  let totalTransactions = 0;
  let privateTransactions = 0;
  let privacyEnabledWallets = 0;
  
  transactions.forEach(txs => {
    totalTransactions += txs.length;
    txs.forEach(tx => {
      totalVolume += tx.amount;
      if (tx.isPrivate) privateTransactions++;
    });
  });
  
  wallets.forEach(w => {
    if (w.privacyEnabled) privacyEnabledWallets++;
  });
  
  res.json({
    totalWallets: wallets.size,
    privacyEnabledWallets,
    totalTransactions,
    privateTransactions,
    totalVolume,
  });
});

// Get leaderboard
app.get('/v1/leaderboard', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const sorted = Array.from(wallets.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map(w => ({
      id: w.id,
      agentId: w.agentId,
      address: w.address,
      points: w.points,
      txCount: w.txCount,
      privacyEnabled: w.privacyEnabled,
    }));
  
  res.json(sorted);
});

// Register (get API key for existing wallet or create new)
app.post('/v1/register', async (req, res) => {
  const { agentId, enablePrivacy } = req.body;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agentId required' });
  }

  const existingWalletId = walletsByAgent.get(agentId);
  if (existingWalletId) {
    const wallet = wallets.get(existingWalletId)!;
    return res.json({
      walletId: wallet.id,
      address: wallet.address,
      apiKey: wallet.apiKey,
      privacyEnabled: wallet.privacyEnabled,
      stealthMetaAddress: wallet.stealthMetaAddress,
      isNew: false,
    });
  }

  // Create new wallet
  const id = uuidv4();
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const address = deriveWalletAddress(agentId);
  
  let stealthKeys: SipherStealthKeys | undefined;
  if (enablePrivacy) {
    try {
      stealthKeys = await generateStealthKeys(`ClawWallet-${agentId}`);
    } catch (err) {
      console.error('Failed to generate stealth keys:', err);
      // Continue without privacy
    }
  }
  
  const wallet: Wallet = {
    id,
    agentId,
    address,
    balance: 0,
    points: enablePrivacy ? 150 : 100, // Privacy bonus
    txCount: 0,
    createdAt: new Date(),
    apiKey,
    privacyEnabled: !!stealthKeys,
    stealthMetaAddress: stealthKeys?.metaAddress,
    stealthSpendingKey: stealthKeys?.spendingPrivateKey,
    stealthViewingKey: stealthKeys?.viewingPrivateKey,
  };

  wallets.set(id, wallet);
  walletsByAgent.set(agentId, id);
  apiKeys.set(apiKey, id);
  transactions.set(id, []);

  res.json({
    walletId: id,
    address,
    apiKey,
    privacyEnabled: wallet.privacyEnabled,
    stealthMetaAddress: wallet.stealthMetaAddress,
    isNew: true,
    welcomeBonus: wallet.points,
  });
});

// Create wallet (public endpoint)
app.post('/v1/wallet/create', async (req, res) => {
  const { agentId, enablePrivacy } = req.body;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agentId required' });
  }

  if (walletsByAgent.has(agentId)) {
    return res.status(409).json({ error: 'Wallet already exists for this agent' });
  }

  const id = uuidv4();
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const address = deriveWalletAddress(agentId);
  
  let stealthKeys: SipherStealthKeys | undefined;
  if (enablePrivacy) {
    try {
      stealthKeys = await generateStealthKeys(`ClawWallet-${agentId}`);
    } catch (err) {
      console.error('Failed to generate stealth keys:', err);
    }
  }
  
  const wallet: Wallet = {
    id,
    agentId,
    address,
    balance: 0,
    points: enablePrivacy ? 150 : 100,
    txCount: 0,
    createdAt: new Date(),
    apiKey,
    privacyEnabled: !!stealthKeys,
    stealthMetaAddress: stealthKeys?.metaAddress,
    stealthSpendingKey: stealthKeys?.spendingPrivateKey,
    stealthViewingKey: stealthKeys?.viewingPrivateKey,
  };

  wallets.set(id, wallet);
  walletsByAgent.set(agentId, id);
  apiKeys.set(apiKey, id);
  transactions.set(id, []);

  res.json({
    id,
    agentId,
    address,
    balance: 0,
    points: wallet.points,
    txCount: 0,
    privacyEnabled: wallet.privacyEnabled,
    stealthMetaAddress: wallet.stealthMetaAddress,
    createdAt: wallet.createdAt.toISOString(),
    apiKey,
  });
});

// Enable privacy on existing wallet
app.post('/v1/wallet/:id/enable-privacy', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const authWalletId = (req as any).walletId;

  const wallet = wallets.get(id) || wallets.get(walletsByAgent.get(id) || '');
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (wallet.id !== authWalletId) {
    return res.status(403).json({ error: 'Can only modify your own wallet' });
  }

  if (wallet.privacyEnabled) {
    return res.json({
      success: true,
      message: 'Privacy already enabled',
      stealthMetaAddress: wallet.stealthMetaAddress,
    });
  }

  try {
    const stealthKeys = await generateStealthKeys(`ClawWallet-${wallet.agentId}`);
    wallet.privacyEnabled = true;
    wallet.stealthMetaAddress = stealthKeys.metaAddress;
    wallet.stealthSpendingKey = stealthKeys.spendingPrivateKey;
    wallet.stealthViewingKey = stealthKeys.viewingPrivateKey;
    wallet.points += 50; // Bonus for enabling privacy

    res.json({
      success: true,
      message: 'Privacy enabled via Sipher',
      stealthMetaAddress: wallet.stealthMetaAddress,
      bonusPoints: 50,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to enable privacy', details: err.message });
  }
});

// Get wallet
app.get('/v1/wallet/:id', (req, res) => {
  const { id } = req.params;
  
  let wallet = wallets.get(id);
  if (!wallet) {
    const walletId = walletsByAgent.get(id);
    if (walletId) {
      wallet = wallets.get(walletId);
    }
  }

  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  res.json({
    id: wallet.id,
    agentId: wallet.agentId,
    address: wallet.address,
    balance: wallet.balance,
    points: wallet.points,
    txCount: wallet.txCount,
    privacyEnabled: wallet.privacyEnabled,
    stealthMetaAddress: wallet.stealthMetaAddress,
    createdAt: wallet.createdAt.toISOString(),
  });
});

// Send SOL (with optional privacy)
app.post('/v1/wallet/send', authMiddleware, async (req, res) => {
  const { walletId, to, amount, private: isPrivate } = req.body;
  const authWalletId = (req as any).walletId;

  if (walletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only send from your own wallet' });
  }

  const wallet = wallets.get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (!to || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid to address or amount' });
  }

  const fee = amount * 0.005;
  const txId = uuidv4();

  // Handle private transfer via Sipher
  if (isPrivate) {
    if (!wallet.privacyEnabled) {
      return res.status(400).json({ 
        error: 'Privacy not enabled on this wallet. Call POST /v1/wallet/:id/enable-privacy first.' 
      });
    }

    // Check if recipient is a ClawWallet agent
    const recipientWalletId = walletsByAgent.get(to);
    const recipientWallet = recipientWalletId ? wallets.get(recipientWalletId) : null;

    if (recipientWallet?.privacyEnabled && recipientWallet.stealthMetaAddress) {
      // Agent-to-agent private transfer
      try {
        const shieldedTx = await buildShieldedTransfer(
          wallet.address,
          recipientWallet.stealthMetaAddress,
          (amount * 1e9).toString() // Convert to lamports
        );

        const tx: Transaction = {
          id: txId,
          walletId,
          type: 'private_send',
          amount,
          fee,
          to: recipientWallet.address,
          toAgentId: recipientWallet.agentId,
          isPrivate: true,
          stealthAddress: shieldedTx.stealthAddress,
          createdAt: new Date(),
        };

        transactions.get(walletId)!.push(tx);
        wallet.txCount += 1;
        wallet.points += Math.min(20, Math.max(2, Math.floor(amount * 2))); // 2x points for private

        return res.json({
          success: true,
          txId,
          amount,
          fee,
          isPrivate: true,
          stealthAddress: shieldedTx.stealthAddress,
          commitment: shieldedTx.commitment,
          unsignedTransaction: shieldedTx.transaction,
          note: 'Sign and submit the returned transaction to complete the private transfer',
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to build private transfer', details: err.message });
      }
    } else {
      return res.status(400).json({ 
        error: 'Recipient does not have a privacy-enabled ClawWallet. Private transfers only work between privacy-enabled wallets.' 
      });
    }
  }

  // Regular (non-private) transfer
  const tx: Transaction = {
    id: txId,
    walletId,
    type: 'send',
    amount,
    fee,
    to,
    isPrivate: false,
    createdAt: new Date(),
  };

  transactions.get(walletId)!.push(tx);
  wallet.txCount += 1;
  wallet.points += Math.min(10, Math.max(1, Math.floor(amount)));

  res.json({
    success: true,
    txId,
    amount,
    fee,
    to,
    isPrivate: false,
    note: 'Simulated - on-chain integration pending',
  });
});

// Send to agent (with optional privacy)
app.post('/v1/wallet/send-to-agent', authMiddleware, async (req, res) => {
  const { fromWalletId, toAgentId, amount, private: isPrivate } = req.body;
  const authWalletId = (req as any).walletId;

  if (fromWalletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only send from your own wallet' });
  }

  const fromWallet = wallets.get(fromWalletId);
  if (!fromWallet) {
    return res.status(404).json({ error: 'Source wallet not found' });
  }

  const toWalletId = walletsByAgent.get(toAgentId);
  if (!toWalletId) {
    return res.status(404).json({ error: 'Recipient agent not found' });
  }
  const toWallet = wallets.get(toWalletId)!;

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const fee = amount * 0.005;
  const txId = uuidv4();

  // Handle private transfer
  if (isPrivate) {
    if (!fromWallet.privacyEnabled) {
      return res.status(400).json({ 
        error: 'Privacy not enabled on sender wallet. Call POST /v1/wallet/:id/enable-privacy first.' 
      });
    }

    if (!toWallet.privacyEnabled || !toWallet.stealthMetaAddress) {
      return res.status(400).json({ 
        error: 'Recipient agent does not have privacy enabled. They need to enable it first.' 
      });
    }

    try {
      const shieldedTx = await buildShieldedTransfer(
        fromWallet.address,
        toWallet.stealthMetaAddress,
        (amount * 1e9).toString()
      );

      // Record outgoing private tx
      const txOut: Transaction = {
        id: txId,
        walletId: fromWalletId,
        type: 'private_send',
        amount,
        fee,
        toAgentId,
        isPrivate: true,
        stealthAddress: shieldedTx.stealthAddress,
        createdAt: new Date(),
      };
      transactions.get(fromWalletId)!.push(txOut);
      fromWallet.txCount += 1;
      fromWallet.points += Math.min(20, Math.max(2, Math.floor(amount * 2)));

      return res.json({
        success: true,
        txId,
        amount,
        fee,
        toAgentId,
        isPrivate: true,
        stealthAddress: shieldedTx.stealthAddress,
        commitment: shieldedTx.commitment,
        unsignedTransaction: shieldedTx.transaction,
        note: 'Sign and submit the transaction. Recipient can scan and claim using /v1/wallet/scan-private',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to build private transfer', details: err.message });
    }
  }

  // Regular agent transfer
  const txOut: Transaction = {
    id: txId,
    walletId: fromWalletId,
    type: 'agent_transfer',
    amount,
    fee,
    toAgentId,
    isPrivate: false,
    createdAt: new Date(),
  };
  transactions.get(fromWalletId)!.push(txOut);
  fromWallet.txCount += 1;
  fromWallet.points += Math.min(10, Math.max(1, Math.floor(amount)));

  const txIn: Transaction = {
    id: uuidv4(),
    walletId: toWalletId,
    type: 'receive',
    amount: amount - fee,
    fee: 0,
    fromAgentId: fromWallet.agentId,
    isPrivate: false,
    createdAt: new Date(),
  };
  transactions.get(toWalletId)!.push(txIn);
  toWallet.points += 5;

  res.json({
    success: true,
    txId,
    amount,
    fee,
    toAgentId,
    toAddress: toWallet.address,
    isPrivate: false,
    note: 'Simulated - on-chain integration pending',
  });
});

// Scan for incoming private payments
app.post('/v1/wallet/scan-private', authMiddleware, async (req, res) => {
  const { walletId, fromSlot } = req.body;
  const authWalletId = (req as any).walletId;

  if (walletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only scan your own wallet' });
  }

  const wallet = wallets.get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (!wallet.privacyEnabled || !wallet.stealthViewingKey || !wallet.stealthMetaAddress) {
    return res.status(400).json({ error: 'Privacy not enabled on this wallet' });
  }

  try {
    const payments = await scanPrivatePayments(
      wallet.stealthViewingKey,
      wallet.stealthMetaAddress.spendingKey,
      fromSlot
    );

    res.json({
      success: true,
      payments,
      count: payments.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to scan for private payments', details: err.message });
  }
});

// Claim a private payment
app.post('/v1/wallet/claim-private', authMiddleware, async (req, res) => {
  const { walletId, stealthAddress, ephemeralPublicKey, mint } = req.body;
  const authWalletId = (req as any).walletId;

  if (walletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only claim to your own wallet' });
  }

  const wallet = wallets.get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (!wallet.privacyEnabled || !wallet.stealthSpendingKey || !wallet.stealthViewingKey) {
    return res.status(400).json({ error: 'Privacy not enabled on this wallet' });
  }

  try {
    const result = await claimStealthPayment(
      stealthAddress,
      ephemeralPublicKey,
      wallet.stealthSpendingKey,
      wallet.stealthViewingKey,
      wallet.address,
      mint
    );

    // Record the claim
    const tx: Transaction = {
      id: uuidv4(),
      walletId,
      type: 'private_receive',
      amount: 0, // Unknown until confirmed
      fee: 0,
      isPrivate: true,
      stealthAddress,
      signature: result.txSignature,
      createdAt: new Date(),
    };
    transactions.get(walletId)!.push(tx);
    wallet.points += 10; // Bonus for claiming

    res.json({
      success: true,
      txSignature: result.txSignature,
      destinationAddress: wallet.address,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to claim private payment', details: err.message });
  }
});

// Get transaction history
app.get('/v1/wallet/:id/history', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const privateOnly = req.query.private === 'true';

  let walletId = id;
  if (!wallets.has(id)) {
    const wid = walletsByAgent.get(id);
    if (wid) walletId = wid;
  }

  const txs = transactions.get(walletId);
  if (!txs) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  let filtered = txs;
  if (privateOnly) {
    filtered = txs.filter(tx => tx.isPrivate);
  }

  res.json(filtered.slice(-limit).reverse());
});

// Skill manifest for agent integration
app.get('/skill.json', (req, res) => {
  res.json({
    name: 'ClawWallet',
    description: 'One-click Solana wallets for AI agents with optional privacy via Sipher',
    version: '0.2.0',
    author: 'ClawWallet',
    features: {
      privacy: true,
      sipherIntegration: true,
      stealthAddresses: true,
      privateTransfers: true,
    },
    commands: [
      {
        name: 'wallet_create',
        description: 'Create a new agent wallet (set enablePrivacy: true for stealth addresses)',
        parameters: { agentId: 'string', enablePrivacy: 'boolean (optional)' },
      },
      {
        name: 'wallet_balance',
        description: 'Get wallet balance and privacy status',
        parameters: { walletId: 'string' },
      },
      {
        name: 'wallet_send',
        description: 'Send SOL (set private: true for stealth transfer via Sipher)',
        parameters: { walletId: 'string', to: 'string', amount: 'number', private: 'boolean (optional)' },
      },
      {
        name: 'wallet_send_agent',
        description: 'Send SOL to another agent (set private: true for stealth transfer)',
        parameters: { fromWalletId: 'string', toAgentId: 'string', amount: 'number', private: 'boolean (optional)' },
      },
      {
        name: 'wallet_enable_privacy',
        description: 'Enable Sipher privacy on existing wallet',
        parameters: { walletId: 'string' },
      },
      {
        name: 'wallet_scan_private',
        description: 'Scan for incoming private payments',
        parameters: { walletId: 'string', fromSlot: 'number (optional)' },
      },
      {
        name: 'wallet_claim_private',
        description: 'Claim a detected private payment to your wallet',
        parameters: { walletId: 'string', stealthAddress: 'string', ephemeralPublicKey: 'string' },
      },
    ],
    endpoints: {
      api: 'https://api.clawwallet.io',
      docs: 'https://clawwallet.io/docs',
    },
    integrations: {
      sipher: 'https://sipher.sip-protocol.org',
    },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClawWallet API running on port ${PORT}`);
  console.log('Privacy features: ENABLED (Sipher integration)');
});
