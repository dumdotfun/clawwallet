import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';

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
}

interface Transaction {
  id: string;
  walletId: string;
  type: 'send' | 'receive' | 'agent_transfer';
  amount: number;
  fee: number;
  to?: string;
  from?: string;
  toAgentId?: string;
  fromAgentId?: string;
  signature?: string;
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get stats
app.get('/v1/stats', (req, res) => {
  let totalVolume = 0;
  let totalTransactions = 0;
  transactions.forEach(txs => {
    totalTransactions += txs.length;
    txs.forEach(tx => totalVolume += tx.amount);
  });
  
  res.json({
    totalWallets: wallets.size,
    totalTransactions,
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
    }));
  
  res.json(sorted);
});

// Register (get API key for existing wallet or create new)
app.post('/v1/register', (req, res) => {
  const { agentId } = req.body;
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
      isNew: false,
    });
  }

  // Create new wallet
  const id = uuidv4();
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const address = deriveWalletAddress(agentId);
  
  const wallet: Wallet = {
    id,
    agentId,
    address,
    balance: 0,
    points: 100, // Welcome bonus
    txCount: 0,
    createdAt: new Date(),
    apiKey,
  };

  wallets.set(id, wallet);
  walletsByAgent.set(agentId, id);
  apiKeys.set(apiKey, id);
  transactions.set(id, []);

  res.json({
    walletId: id,
    address,
    apiKey,
    isNew: true,
    welcomeBonus: 100,
  });
});

// Create wallet (authenticated)
app.post('/v1/wallet/create', (req, res) => {
  const { agentId } = req.body;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agentId required' });
  }

  if (walletsByAgent.has(agentId)) {
    return res.status(409).json({ error: 'Wallet already exists for this agent' });
  }

  const id = uuidv4();
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const address = deriveWalletAddress(agentId);
  
  const wallet: Wallet = {
    id,
    agentId,
    address,
    balance: 0,
    points: 100,
    txCount: 0,
    createdAt: new Date(),
    apiKey,
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
    points: 100,
    txCount: 0,
    createdAt: wallet.createdAt.toISOString(),
    apiKey,
  });
});

// Get wallet
app.get('/v1/wallet/:id', (req, res) => {
  const { id } = req.params;
  
  // Try by wallet ID first
  let wallet = wallets.get(id);
  
  // Then try by agent ID
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
    createdAt: wallet.createdAt.toISOString(),
  });
});

// Send SOL (placeholder - needs on-chain integration)
app.post('/v1/wallet/send', authMiddleware, (req, res) => {
  const { walletId, to, amount } = req.body;
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

  // In production, this would submit an on-chain transaction
  // For MVP, we simulate
  const fee = amount * 0.005;
  const txId = uuidv4();

  const tx: Transaction = {
    id: txId,
    walletId,
    type: 'send',
    amount,
    fee,
    to,
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
    note: 'Simulated - on-chain integration pending',
  });
});

// Send to agent
app.post('/v1/wallet/send-to-agent', authMiddleware, (req, res) => {
  const { fromWalletId, toAgentId, amount } = req.body;
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

  // Record outgoing tx
  const txOut: Transaction = {
    id: txId,
    walletId: fromWalletId,
    type: 'agent_transfer',
    amount,
    fee,
    toAgentId,
    createdAt: new Date(),
  };
  transactions.get(fromWalletId)!.push(txOut);
  fromWallet.txCount += 1;
  fromWallet.points += Math.min(10, Math.max(1, Math.floor(amount)));

  // Record incoming tx
  const txIn: Transaction = {
    id: uuidv4(),
    walletId: toWalletId,
    type: 'receive',
    amount: amount - fee,
    fee: 0,
    fromAgentId: fromWallet.agentId,
    createdAt: new Date(),
  };
  transactions.get(toWalletId)!.push(txIn);
  toWallet.points += 5; // Bonus for receiving

  res.json({
    success: true,
    txId,
    amount,
    fee,
    toAgentId,
    toAddress: toWallet.address,
    note: 'Simulated - on-chain integration pending',
  });
});

// Get transaction history
app.get('/v1/wallet/:id/history', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  let walletId = id;
  if (!wallets.has(id)) {
    const wid = walletsByAgent.get(id);
    if (wid) walletId = wid;
  }

  const txs = transactions.get(walletId);
  if (!txs) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  res.json(txs.slice(-limit).reverse());
});

// Skill manifest for agent integration
app.get('/skill.json', (req, res) => {
  res.json({
    name: 'ClawWallet',
    description: 'One-click Solana wallets for AI agents',
    version: '0.1.0',
    author: 'ClawWallet',
    commands: [
      {
        name: 'wallet_create',
        description: 'Create a new agent wallet',
        parameters: { agentId: 'string' },
      },
      {
        name: 'wallet_balance',
        description: 'Get wallet balance',
        parameters: { walletId: 'string' },
      },
      {
        name: 'wallet_send',
        description: 'Send SOL to an address',
        parameters: { walletId: 'string', to: 'string', amount: 'number' },
      },
      {
        name: 'wallet_send_agent',
        description: 'Send SOL to another agent',
        parameters: { fromWalletId: 'string', toAgentId: 'string', amount: 'number' },
      },
    ],
    endpoints: {
      api: 'https://api.clawwallet.io',
      docs: 'https://clawwallet.io/docs',
    },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClawWallet API running on port ${PORT}`);
});
