import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface ClawWalletConfig {
  apiKey?: string;
  apiUrl?: string;
  rpcUrl?: string;
  programId?: string;
}

export interface StealthMetaAddress {
  spendingKey: string;
  viewingKey: string;
  chain: string;
}

export interface WalletInfo {
  id: string;
  agentId: string;
  address: string;
  balance: number;
  points: number;
  txCount: number;
  privacyEnabled: boolean;
  stealthMetaAddress?: StealthMetaAddress;
  createdAt: string;
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  txId?: string;
  isPrivate?: boolean;
  stealthAddress?: string;
  commitment?: string;
  unsignedTransaction?: string;
  error?: string;
}

export interface PrivatePayment {
  stealthAddress: string;
  ephemeralPublicKey: string;
  amount?: string;
  sender?: string;
}

export interface CreateWalletOptions {
  enablePrivacy?: boolean;
}

export interface SendOptions {
  private?: boolean;
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
   * @param agentId - Unique identifier for the agent
   * @param options - Optional settings (enablePrivacy for stealth addresses)
   */
  async createWallet(agentId: string, options?: CreateWalletOptions): Promise<WalletInfo> {
    return this.apiRequest('POST', '/v1/wallet/create', { 
      agentId,
      enablePrivacy: options?.enablePrivacy,
    });
  }

  /**
   * Register and get API key (creates wallet if doesn't exist)
   * @param agentId - Unique identifier for the agent
   * @param options - Optional settings (enablePrivacy for stealth addresses)
   */
  async register(agentId: string, options?: CreateWalletOptions): Promise<WalletInfo & { apiKey: string }> {
    return this.apiRequest('POST', '/v1/register', { 
      agentId,
      enablePrivacy: options?.enablePrivacy,
    });
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
   * Enable privacy (Sipher stealth addresses) on an existing wallet
   */
  async enablePrivacy(walletId: string): Promise<{ success: boolean; stealthMetaAddress?: StealthMetaAddress }> {
    return this.apiRequest('POST', `/v1/wallet/${walletId}/enable-privacy`, {});
  }

  /**
   * Send SOL to an address
   * @param walletId - Source wallet ID
   * @param to - Destination address or agent ID
   * @param amount - Amount in SOL
   * @param options - Optional settings (private for stealth transfer)
   */
  async send(walletId: string, to: string, amount: number, options?: SendOptions): Promise<TransactionResult> {
    return this.apiRequest('POST', '/v1/wallet/send', {
      walletId,
      to,
      amount,
      private: options?.private,
    });
  }

  /**
   * Send SOL to another agent
   * @param fromWalletId - Source wallet ID
   * @param toAgentId - Destination agent ID
   * @param amount - Amount in SOL
   * @param options - Optional settings (private for stealth transfer)
   */
  async sendToAgent(fromWalletId: string, toAgentId: string, amount: number, options?: SendOptions): Promise<TransactionResult> {
    return this.apiRequest('POST', '/v1/wallet/send-to-agent', {
      fromWalletId,
      toAgentId,
      amount,
      private: options?.private,
    });
  }

  /**
   * Send privately using Sipher stealth addresses
   * Convenience method that sets private: true
   */
  async sendPrivate(walletId: string, to: string, amount: number): Promise<TransactionResult> {
    return this.send(walletId, to, amount, { private: true });
  }

  /**
   * Send privately to another agent using Sipher stealth addresses
   * Convenience method that sets private: true
   */
  async sendToAgentPrivate(fromWalletId: string, toAgentId: string, amount: number): Promise<TransactionResult> {
    return this.sendToAgent(fromWalletId, toAgentId, amount, { private: true });
  }

  /**
   * Scan for incoming private payments
   * @param walletId - Your wallet ID
   * @param fromSlot - Optional starting slot to scan from
   */
  async scanPrivatePayments(walletId: string, fromSlot?: number): Promise<{ payments: PrivatePayment[]; count: number }> {
    return this.apiRequest('POST', '/v1/wallet/scan-private', {
      walletId,
      fromSlot,
    });
  }

  /**
   * Claim a private payment to your wallet
   * @param walletId - Your wallet ID
   * @param stealthAddress - The stealth address holding the funds
   * @param ephemeralPublicKey - The ephemeral public key from the payment
   * @param mint - Optional SPL token mint (for token transfers)
   */
  async claimPrivatePayment(
    walletId: string, 
    stealthAddress: string, 
    ephemeralPublicKey: string,
    mint?: string
  ): Promise<{ success: boolean; txSignature: string }> {
    return this.apiRequest('POST', '/v1/wallet/claim-private', {
      walletId,
      stealthAddress,
      ephemeralPublicKey,
      mint,
    });
  }

  /**
   * Get transaction history
   * @param walletId - Wallet ID or agent ID
   * @param limit - Max transactions to return
   * @param privateOnly - Only return private transactions
   */
  async getHistory(walletId: string, limit = 50, privateOnly = false): Promise<any[]> {
    return this.apiRequest('GET', `/v1/wallet/${walletId}/history?limit=${limit}&private=${privateOnly}`);
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
  async getStats(): Promise<{ 
    totalWallets: number; 
    privacyEnabledWallets: number;
    totalTransactions: number; 
    privateTransactions: number;
    totalVolume: number;
  }> {
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
