/**
 * ClawWallet Native Privacy Module
 * 
 * Implements stealth addresses and hidden amounts WITHOUT external dependencies.
 * Better than Sipher: faster, simpler, no API calls, fully native.
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { utf8ToBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';

// ============================================
// STEALTH ADDRESS IMPLEMENTATION
// ============================================

export interface StealthKeyPair {
  // Public keys (shareable)
  spendingPublicKey: string;  // hex
  viewingPublicKey: string;   // hex
  // Private keys (secret)
  spendingPrivateKey: string; // hex
  viewingPrivateKey: string;  // hex
  // Meta address (share this to receive private payments)
  metaAddress: string;        // combined format
}

export interface StealthAddress {
  address: string;            // The one-time stealth address (base58)
  ephemeralPublicKey: string; // Sender includes this so recipient can find payment
  viewTag: number;            // Fast filtering (first byte of shared secret)
}

export interface PrivateTransfer {
  id: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: number;
  encryptedAmount: string;    // Encrypted with shared secret
  encryptedMemo?: string;     // Optional encrypted memo
  senderHint?: string;        // Optional hint for sender identity
  timestamp: number;
}

/**
 * Generate a new stealth key pair for receiving private payments
 */
export function generateStealthKeyPair(): StealthKeyPair {
  // Generate two separate key pairs
  const spendingPrivateKey = randomBytes(32);
  const viewingPrivateKey = randomBytes(32);
  
  const spendingPublicKey = ed25519.getPublicKey(spendingPrivateKey);
  const viewingPublicKey = ed25519.getPublicKey(viewingPrivateKey);
  
  // Create meta address: concat of spending and viewing public keys
  const metaAddress = bytesToHex(spendingPublicKey) + bytesToHex(viewingPublicKey);
  
  return {
    spendingPublicKey: bytesToHex(spendingPublicKey),
    viewingPublicKey: bytesToHex(viewingPublicKey),
    spendingPrivateKey: bytesToHex(spendingPrivateKey),
    viewingPrivateKey: bytesToHex(viewingPrivateKey),
    metaAddress,
  };
}

/**
 * Parse a meta address into its component public keys
 */
export function parseMetaAddress(metaAddress: string): { spendingPublicKey: Uint8Array; viewingPublicKey: Uint8Array } {
  if (metaAddress.length !== 128) {
    throw new Error('Invalid meta address length');
  }
  return {
    spendingPublicKey: hexToBytes(metaAddress.slice(0, 64)),
    viewingPublicKey: hexToBytes(metaAddress.slice(64)),
  };
}

/**
 * Derive a one-time stealth address for sending a private payment
 * 
 * Uses ECDH: sender generates ephemeral key, derives shared secret with recipient's viewing key,
 * then tweaks recipient's spending key to create unique one-time address.
 */
export function deriveStealthAddress(recipientMetaAddress: string): StealthAddress {
  const { spendingPublicKey, viewingPublicKey } = parseMetaAddress(recipientMetaAddress);
  
  // Sender generates ephemeral key pair
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey);
  
  // ECDH: shared secret = ephemeralPrivate * viewingPublic
  const sharedSecret = ed25519.getSharedSecret(ephemeralPrivateKey, viewingPublicKey);
  
  // View tag = first byte of hash(sharedSecret) - for fast scanning
  const sharedSecretHash = sha256(sharedSecret);
  const viewTag = sharedSecretHash[0];
  
  // Stealth address = spendingPublic + hash(sharedSecret) * G
  // Simplified: we hash the shared secret and use it to tweak the spending key
  const tweak = sha256(new Uint8Array([...sharedSecretHash, ...utf8ToBytes('clawwallet-stealth')]));
  
  // Combine spending public key with tweak to get stealth address
  // For ed25519, we add the tweak as a scalar multiplication
  const stealthPubKey = ed25519.ExtendedPoint.fromHex(spendingPublicKey)
    .add(ed25519.ExtendedPoint.BASE.multiply(BigInt('0x' + bytesToHex(tweak.slice(0, 32)))))
    .toRawBytes();
  
  return {
    address: bytesToHex(stealthPubKey),
    ephemeralPublicKey: bytesToHex(ephemeralPublicKey),
    viewTag,
  };
}

/**
 * Check if a stealth address belongs to you (recipient)
 */
export function checkStealthOwnership(
  stealthAddress: string,
  ephemeralPublicKey: string,
  viewingPrivateKey: string,
  spendingPublicKey: string
): boolean {
  try {
    // Recreate the shared secret using viewing private key
    const sharedSecret = ed25519.getSharedSecret(
      hexToBytes(viewingPrivateKey),
      hexToBytes(ephemeralPublicKey)
    );
    
    const sharedSecretHash = sha256(sharedSecret);
    const tweak = sha256(new Uint8Array([...sharedSecretHash, ...utf8ToBytes('clawwallet-stealth')]));
    
    // Recreate expected stealth address
    const expectedStealthPubKey = ed25519.ExtendedPoint.fromHex(spendingPublicKey)
      .add(ed25519.ExtendedPoint.BASE.multiply(BigInt('0x' + bytesToHex(tweak.slice(0, 32)))))
      .toRawBytes();
    
    return bytesToHex(expectedStealthPubKey) === stealthAddress;
  } catch {
    return false;
  }
}

/**
 * Derive the private key for a stealth address you own
 */
export function deriveStealthPrivateKey(
  ephemeralPublicKey: string,
  viewingPrivateKey: string,
  spendingPrivateKey: string
): string {
  // Recreate shared secret
  const sharedSecret = ed25519.getSharedSecret(
    hexToBytes(viewingPrivateKey),
    hexToBytes(ephemeralPublicKey)
  );
  
  const sharedSecretHash = sha256(sharedSecret);
  const tweak = sha256(new Uint8Array([...sharedSecretHash, ...utf8ToBytes('clawwallet-stealth')]));
  
  // Stealth private key = spending private key + tweak (mod curve order)
  const spendingScalar = BigInt('0x' + spendingPrivateKey);
  const tweakScalar = BigInt('0x' + bytesToHex(tweak.slice(0, 32)));
  const curveOrder = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
  
  const stealthScalar = (spendingScalar + tweakScalar) % curveOrder;
  
  return stealthScalar.toString(16).padStart(64, '0');
}

// ============================================
// ENCRYPTED AMOUNTS (Simpler than Pedersen)
// ============================================

/**
 * Encrypt amount and optional memo with shared secret
 */
export function encryptPaymentData(
  amount: number,
  memo: string | undefined,
  ephemeralPrivateKey: Uint8Array,
  recipientViewingPublicKey: Uint8Array
): { encryptedAmount: string; encryptedMemo?: string } {
  const sharedSecret = ed25519.getSharedSecret(ephemeralPrivateKey, recipientViewingPublicKey);
  const encryptionKey = sha256(new Uint8Array([...sharedSecret, ...utf8ToBytes('clawwallet-encrypt')]));
  
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(encryptionKey, nonce);
  
  // Encrypt amount
  const amountBytes = new TextEncoder().encode(amount.toString());
  const encryptedAmountBytes = cipher.encrypt(amountBytes);
  const encryptedAmount = bytesToHex(nonce) + bytesToHex(encryptedAmountBytes);
  
  // Encrypt memo if provided
  let encryptedMemo: string | undefined;
  if (memo) {
    const memoNonce = randomBytes(24);
    const memoCipher = xchacha20poly1305(encryptionKey, memoNonce);
    const memoBytes = new TextEncoder().encode(memo);
    const encryptedMemoBytes = memoCipher.encrypt(memoBytes);
    encryptedMemo = bytesToHex(memoNonce) + bytesToHex(encryptedMemoBytes);
  }
  
  return { encryptedAmount, encryptedMemo };
}

/**
 * Decrypt payment data using viewing key
 */
export function decryptPaymentData(
  encryptedAmount: string,
  encryptedMemo: string | undefined,
  ephemeralPublicKey: string,
  viewingPrivateKey: string
): { amount: number; memo?: string } {
  const sharedSecret = ed25519.getSharedSecret(
    hexToBytes(viewingPrivateKey),
    hexToBytes(ephemeralPublicKey)
  );
  const encryptionKey = sha256(new Uint8Array([...sharedSecret, ...utf8ToBytes('clawwallet-encrypt')]));
  
  // Decrypt amount
  const amountNonce = hexToBytes(encryptedAmount.slice(0, 48));
  const amountCiphertext = hexToBytes(encryptedAmount.slice(48));
  const amountCipher = xchacha20poly1305(encryptionKey, amountNonce);
  const amountBytes = amountCipher.decrypt(amountCiphertext);
  const amount = parseFloat(new TextDecoder().decode(amountBytes));
  
  // Decrypt memo if present
  let memo: string | undefined;
  if (encryptedMemo) {
    const memoNonce = hexToBytes(encryptedMemo.slice(0, 48));
    const memoCiphertext = hexToBytes(encryptedMemo.slice(48));
    const memoCipher = xchacha20poly1305(encryptionKey, memoNonce);
    const memoBytes = memoCipher.decrypt(memoCiphertext);
    memo = new TextDecoder().decode(memoBytes);
  }
  
  return { amount, memo };
}

// ============================================
// PRIVACY REGISTRY (In-memory for MVP)
// ============================================

// Store of all private transfers (would be on-chain in production)
const privateTransfers: Map<string, PrivateTransfer> = new Map();

/**
 * Register a private transfer
 */
export function registerPrivateTransfer(transfer: PrivateTransfer): void {
  privateTransfers.set(transfer.id, transfer);
}

/**
 * Scan for private transfers that belong to a recipient
 */
export function scanForPayments(
  viewingPrivateKey: string,
  spendingPublicKey: string,
  afterTimestamp?: number
): PrivateTransfer[] {
  const found: PrivateTransfer[] = [];
  
  for (const transfer of privateTransfers.values()) {
    // Skip if before the requested timestamp
    if (afterTimestamp && transfer.timestamp < afterTimestamp) continue;
    
    // Quick filter using view tag
    const sharedSecret = ed25519.getSharedSecret(
      hexToBytes(viewingPrivateKey),
      hexToBytes(transfer.ephemeralPublicKey)
    );
    const expectedViewTag = sha256(sharedSecret)[0];
    
    if (expectedViewTag !== transfer.viewTag) continue;
    
    // Full ownership check
    if (checkStealthOwnership(
      transfer.stealthAddress,
      transfer.ephemeralPublicKey,
      viewingPrivateKey,
      spendingPublicKey
    )) {
      found.push(transfer);
    }
  }
  
  return found;
}

/**
 * Get privacy stats
 */
export function getPrivacyStats(): { totalPrivateTransfers: number; totalVolume: number } {
  return {
    totalPrivateTransfers: privateTransfers.size,
    totalVolume: 0, // Can't know - amounts are encrypted!
  };
}

// Export all
export const ClawPrivacy = {
  generateStealthKeyPair,
  deriveStealthAddress,
  checkStealthOwnership,
  deriveStealthPrivateKey,
  encryptPaymentData,
  decryptPaymentData,
  registerPrivateTransfer,
  scanForPayments,
  getPrivacyStats,
};

export default ClawPrivacy;
