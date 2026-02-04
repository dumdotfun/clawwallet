import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface ClawWalletConfig {
  apiKey?: string;
  apiUrl?: string;
  rpcUrl?: string;
  programId?: string;
}

export interface WalletInfo {
  id: string;
  agentId: string;
  address: string;
  balance: number;
  points: number;
  txCount: number;
  createdAt: string;
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  txId?: string;
  error?: string;
}

const DEFAULT_API_URL = 'https://api.clawwallet.io';
const DEFAULT_PROGRAM_ID = 'CLAWwa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export class ClawWallet {
  private apiKey?: string;
  private apiUrl: string;
  private rpcUrl?: string;
  private programId: PublicKey;
  private connection?: Connection;

  constructor(config: ClawWalletConfig = {}) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || DEFAULT_API_URL;
    this.rpcUrl = config.rpcUrl;
    this.programId = new PublicKey(config.programId || DEFAULT_PROGRAM_ID);
    
    if (this.rpcUrl) {
      this.connection = new Connection(this.rpcUrl);
    }
  }

  /**
   * Create a new agent wallet
   */
  async createWallet(agentId: string): Promise<WalletInfo> {
    if (this.apiKey) {
      return this.apiRequest('POST', '/v1/wallet/create', { agentId });
    }
    throw new Error('API key required for wallet creation');
  }

  /**
   * Get wallet info by ID or agent ID
   */
  async getWallet(walletIdOrAgentId: string): Promise<WalletInfo> {
    return this.apiRequest('GET', `/v1/wallet/${walletIdOrAgentId}`);
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string): Promise<number> {
    const wallet = await this.getWallet(walletId);
    return wallet.balance;
  }

  /**
   * Send SOL to an address
   */
  async send(walletId: string, to: string, amount: number): Promise<TransactionResult> {
    return this.apiRequest('POST', '/v1/wallet/send', {
      walletId,
      to,
      amount,
    });
  }

  /**
   * Send SOL to another agent
   */
  async sendToAgent(fromWalletId: string, toAgentId: string, amount: number): Promise<TransactionResult> {
    return this.apiRequest('POST', '/v1/wallet/send-to-agent', {
      fromWalletId,
      toAgentId,
      amount,
    });
  }

  /**
   * Get transaction history
   */
  async getHistory(walletId: string, limit = 50): Promise<any[]> {
    return this.apiRequest('GET', `/v1/wallet/${walletId}/history?limit=${limit}`);
  }

  /**
   * Get points leaderboard
   */
  async getLeaderboard(limit = 10): Promise<WalletInfo[]> {
    return this.apiRequest('GET', `/v1/leaderboard?limit=${limit}`);
  }

  /**
   * Get global stats
   */
  async getStats(): Promise<{ totalWallets: number; totalTransactions: number; totalVolume: number }> {
    return this.apiRequest('GET', '/v1/stats');
  }

  /**
   * Derive wallet PDA address from agent ID
   */
  static deriveWalletAddress(agentId: string, programId?: string): PublicKey {
    const pid = new PublicKey(programId || DEFAULT_PROGRAM_ID);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('wallet'), Buffer.from(agentId)],
      pid
    );
    return pda;
  }

  private async apiRequest<T>(method: string, path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
  }
}

export default ClawWallet;
