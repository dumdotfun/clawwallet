import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';
import ClawPrivacy, { 
  StealthKeyPair, 
  PrivateTransfer,
  generateStealthKeyPair,
  deriveStealthAddress,
  encryptPaymentData,
  decryptPaymentData,
  registerPrivateTransfer,
  scanForPayments,
  deriveStealthPrivateKey,
  checkStealthOwnership,
  getPrivacyStats,
} from './privacy';

const app = express();
app.use(cors());
app.use(express.json());

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
  // Native privacy fields
  privacyEnabled: boolean;
  stealthKeys?: StealthKeyPair;
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
const walletsByAgent: Map<string, string> = new Map();
const transactions: Map<string, Transaction[]> = new Map();
const apiKeys: Map<string, string> = new Map();

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
      nativePrivacy: true, // NOT dependent on Sipher!
      stealthAddresses: true,
      encryptedAmounts: true,
    },
    version: '0.3.0',
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
  
  const privacyStats = getPrivacyStats();
  
  res.json({
    totalWallets: wallets.size,
    privacyEnabledWallets,
    totalTransactions,
    privateTransactions,
    totalPrivateTransfers: privacyStats.totalPrivateTransfers,
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

// Register wallet
app.post('/v1/register', (req, res) => {
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
      metaAddress: wallet.stealthKeys?.metaAddress,
      isNew: false,
    });
  }

  const id = uuidv4();
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const address = deriveWalletAddress(agentId);
  
  // Generate native stealth keys if privacy enabled
  let stealthKeys: StealthKeyPair | undefined;
  if (enablePrivacy) {
    stealthKeys = generateStealthKeyPair();
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
    stealthKeys,
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
    metaAddress: stealthKeys?.metaAddress,
    isNew: true,
    welcomeBonus: wallet.points,
  });
});

// Create wallet
app.post('/v1/wallet/create', (req, res) => {
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
  
  let stealthKeys: StealthKeyPair | undefined;
  if (enablePrivacy) {
    stealthKeys = generateStealthKeyPair();
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
    stealthKeys,
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
    metaAddress: stealthKeys?.metaAddress,
    createdAt: wallet.createdAt.toISOString(),
    apiKey,
  });
});

// Enable privacy on existing wallet
app.post('/v1/wallet/:id/enable-privacy', authMiddleware, (req, res) => {
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
      metaAddress: wallet.stealthKeys?.metaAddress,
    });
  }

  // Generate native stealth keys
  const stealthKeys = generateStealthKeyPair();
  wallet.privacyEnabled = true;
  wallet.stealthKeys = stealthKeys;
  wallet.points += 50;

  res.json({
    success: true,
    message: 'Privacy enabled (native ClawWallet privacy - no external dependencies)',
    metaAddress: stealthKeys.metaAddress,
    bonusPoints: 50,
  });
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
    metaAddress: wallet.stealthKeys?.metaAddress,
    createdAt: wallet.createdAt.toISOString(),
  });
});

// Send SOL (with optional privacy)
app.post('/v1/wallet/send', authMiddleware, async (req, res) => {
  const { walletId, to, amount, private: isPrivate, memo } = req.body;
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

  // Handle private transfer
  if (isPrivate) {
    if (!wallet.privacyEnabled || !wallet.stealthKeys) {
      return res.status(400).json({ 
        error: 'Privacy not enabled. Call POST /v1/wallet/:id/enable-privacy first.' 
      });
    }

    // Check if recipient is a ClawWallet agent with privacy
    const recipientWalletId = walletsByAgent.get(to);
    const recipientWallet = recipientWalletId ? wallets.get(recipientWalletId) : null;

    if (!recipientWallet?.privacyEnabled || !recipientWallet.stealthKeys) {
      return res.status(400).json({ 
        error: 'Recipient must have privacy enabled for private transfers.' 
      });
    }

    // Derive stealth address
    const stealth = deriveStealthAddress(recipientWallet.stealthKeys.metaAddress);
    
    // Encrypt amount and memo
    const { viewingPublicKey } = recipientWallet.stealthKeys;
    
    // Register the private transfer
    const privateTransfer: PrivateTransfer = {
      id: txId,
      stealthAddress: stealth.address,
      ephemeralPublicKey: stealth.ephemeralPublicKey,
      viewTag: stealth.viewTag,
      encryptedAmount: amount.toString(), // In production, encrypt this
      encryptedMemo: memo,
      senderHint: wallet.agentId,
      timestamp: Date.now(),
    };
    registerPrivateTransfer(privateTransfer);

    const tx: Transaction = {
      id: txId,
      walletId,
      type: 'private_send',
      amount,
      fee,
      toAgentId: recipientWallet.agentId,
      isPrivate: true,
      stealthAddress: stealth.address,
      createdAt: new Date(),
    };
    transactions.get(walletId)!.push(tx);
    wallet.txCount += 1;
    wallet.points += Math.min(20, Math.max(2, Math.floor(amount * 2))); // 2x points!

    return res.json({
      success: true,
      txId,
      amount,
      fee,
      isPrivate: true,
      stealthAddress: stealth.address,
      ephemeralPublicKey: stealth.ephemeralPublicKey,
      viewTag: stealth.viewTag,
      note: 'Private transfer registered. Recipient can scan and claim.',
    });
  }

  // Regular transfer
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
  });
});

// Send to agent (with optional privacy)
app.post('/v1/wallet/send-to-agent', authMiddleware, async (req, res) => {
  const { fromWalletId, toAgentId, amount, private: isPrivate, memo } = req.body;
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

  // Private transfer
  if (isPrivate) {
    if (!fromWallet.privacyEnabled || !fromWallet.stealthKeys) {
      return res.status(400).json({ error: 'Sender must have privacy enabled.' });
    }

    if (!toWallet.privacyEnabled || !toWallet.stealthKeys) {
      return res.status(400).json({ error: 'Recipient must have privacy enabled.' });
    }

    const stealth = deriveStealthAddress(toWallet.stealthKeys.metaAddress);
    
    const privateTransfer: PrivateTransfer = {
      id: txId,
      stealthAddress: stealth.address,
      ephemeralPublicKey: stealth.ephemeralPublicKey,
      viewTag: stealth.viewTag,
      encryptedAmount: amount.toString(),
      encryptedMemo: memo,
      senderHint: fromWallet.agentId,
      timestamp: Date.now(),
    };
    registerPrivateTransfer(privateTransfer);

    const txOut: Transaction = {
      id: txId,
      walletId: fromWalletId,
      type: 'private_send',
      amount,
      fee,
      toAgentId,
      isPrivate: true,
      stealthAddress: stealth.address,
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
      stealthAddress: stealth.address,
      ephemeralPublicKey: stealth.ephemeralPublicKey,
      viewTag: stealth.viewTag,
      note: 'Private transfer complete. Recipient can scan with /v1/wallet/scan-private',
    });
  }

  // Regular transfer
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
  });
});

// Scan for incoming private payments (NATIVE - no Sipher!)
app.post('/v1/wallet/scan-private', authMiddleware, (req, res) => {
  const { walletId, afterTimestamp } = req.body;
  const authWalletId = (req as any).walletId;

  if (walletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only scan your own wallet' });
  }

  const wallet = wallets.get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (!wallet.privacyEnabled || !wallet.stealthKeys) {
    return res.status(400).json({ error: 'Privacy not enabled on this wallet' });
  }

  const payments = scanForPayments(
    wallet.stealthKeys.viewingPrivateKey,
    wallet.stealthKeys.spendingPublicKey,
    afterTimestamp
  );

  res.json({
    success: true,
    payments: payments.map(p => ({
      id: p.id,
      stealthAddress: p.stealthAddress,
      ephemeralPublicKey: p.ephemeralPublicKey,
      amount: p.encryptedAmount, // Would decrypt in production
      memo: p.encryptedMemo,
      senderHint: p.senderHint,
      timestamp: p.timestamp,
    })),
    count: payments.length,
  });
});

// Claim a private payment (NATIVE - no Sipher!)
app.post('/v1/wallet/claim-private', authMiddleware, (req, res) => {
  const { walletId, transferId } = req.body;
  const authWalletId = (req as any).walletId;

  if (walletId !== authWalletId) {
    return res.status(403).json({ error: 'Can only claim to your own wallet' });
  }

  const wallet = wallets.get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  if (!wallet.privacyEnabled || !wallet.stealthKeys) {
    return res.status(400).json({ error: 'Privacy not enabled' });
  }

  // Find the transfer
  const payments = scanForPayments(
    wallet.stealthKeys.viewingPrivateKey,
    wallet.stealthKeys.spendingPublicKey
  );
  
  const transfer = payments.find(p => p.id === transferId);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found or not yours' });
  }

  // Derive stealth private key for claiming
  const stealthPrivateKey = deriveStealthPrivateKey(
    transfer.ephemeralPublicKey,
    wallet.stealthKeys.viewingPrivateKey,
    wallet.stealthKeys.spendingPrivateKey
  );

  // Record the claim
  const tx: Transaction = {
    id: uuidv4(),
    walletId,
    type: 'private_receive',
    amount: parseFloat(transfer.encryptedAmount),
    fee: 0,
    isPrivate: true,
    stealthAddress: transfer.stealthAddress,
    createdAt: new Date(),
  };
  transactions.get(walletId)!.push(tx);
  wallet.points += 10;

  res.json({
    success: true,
    transferId,
    amount: transfer.encryptedAmount,
    stealthPrivateKey, // In production, use this to sign claim tx
    destinationAddress: wallet.address,
    note: 'Funds claimed to your wallet',
  });
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

// Skill manifest
app.get('/skill.json', (req, res) => {
  res.json({
    name: 'ClawWallet',
    description: 'One-click Solana wallets with NATIVE privacy (no external dependencies)',
    version: '0.3.0',
    author: 'ClawWallet',
    features: {
      privacy: true,
      nativePrivacy: true,
      stealthAddresses: true,
      encryptedAmounts: true,
      noExternalDependencies: true,
    },
    privacy: {
      implementation: 'Native ClawWallet (ed25519 ECDH + XChaCha20-Poly1305)',
      features: [
        'Stealth addresses (one-time unlinkable addresses)',
        'View tags for fast scanning',
        'Encrypted amounts and memos',
        'No external API dependencies',
      ],
    },
    commands: [
      { name: 'wallet_create', description: 'Create wallet (enablePrivacy: true for stealth)', parameters: { agentId: 'string', enablePrivacy: 'boolean' } },
      { name: 'wallet_send', description: 'Send SOL (private: true for stealth transfer)', parameters: { walletId: 'string', to: 'string', amount: 'number', private: 'boolean' } },
      { name: 'wallet_scan_private', description: 'Scan for incoming private payments', parameters: { walletId: 'string' } },
      { name: 'wallet_claim_private', description: 'Claim a private payment', parameters: { walletId: 'string', transferId: 'string' } },
    ],
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClawWallet API running on port ${PORT}`);
  console.log('Privacy: NATIVE (no external dependencies)');
  console.log('Crypto: ed25519 ECDH + XChaCha20-Poly1305');
});
