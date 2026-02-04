use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as SplTransfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M");

// USDC mint addresses
pub const USDC_MINT_DEVNET: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
pub const USDC_MINT_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

#[program]
pub mod clawwallet {
    use super::*;

    /// Create a new agent wallet (PDA)
    pub fn create_wallet(ctx: Context<CreateWallet>, agent_id: String) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        wallet.agent_id = agent_id.clone();
        wallet.owner = ctx.accounts.payer.key();
        wallet.points = 100; // Welcome bonus
        wallet.created_at = Clock::get()?.unix_timestamp;
        wallet.tx_count = 0;
        wallet.bump = *ctx.bumps.get("wallet").unwrap();

        emit!(WalletCreated {
            agent_id,
            wallet: wallet.key(),
            owner: wallet.owner,
        });

        Ok(())
    }

    /// Send SOL from agent wallet (0.5% fee)
    pub fn send_sol(ctx: Context<SendSol>, amount: u64) -> Result<()> {
        let fee = amount / 200; // 0.5%
        let send_amount = amount - fee;
        
        // Direct lamport manipulation for PDA with data
        let wallet_info = ctx.accounts.wallet.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        
        // Check sufficient balance (keeping rent-exempt minimum)
        let rent = anchor_lang::prelude::Rent::get()?;
        let min_balance = rent.minimum_balance(wallet_info.data_len());
        require!(
            **wallet_info.lamports.borrow() >= amount + min_balance,
            ClawWalletError::InsufficientFunds
        );
        
        // Transfer to recipient
        **wallet_info.try_borrow_mut_lamports()? -= send_amount;
        **recipient_info.try_borrow_mut_lamports()? += send_amount;
        
        // Transfer fee to treasury
        **wallet_info.try_borrow_mut_lamports()? -= fee;
        **treasury_info.try_borrow_mut_lamports()? += fee;

        // Update wallet stats
        let wallet = &mut ctx.accounts.wallet;
        wallet.tx_count += 1;
        
        // Award points based on amount (1-10 points)
        let points_earned = std::cmp::min(10, std::cmp::max(1, (amount / 100_000_000) as u64));
        wallet.points += points_earned;

        emit!(SolSent {
            agent_id: wallet.agent_id.clone(),
            amount: send_amount,
            fee,
            recipient: ctx.accounts.recipient.key(),
            points_earned,
        });

        Ok(())
    }

    /// Send SOL to another agent's wallet
    pub fn send_to_agent(ctx: Context<SendToAgent>, amount: u64) -> Result<()> {
        let fee = amount / 200; // 0.5%
        let send_amount = amount - fee;

        // Transfer to recipient wallet
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.from_wallet.to_account_info(),
                to: ctx.accounts.to_wallet.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, send_amount)?;

        // Transfer fee to treasury
        let cpi_context_fee = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.from_wallet.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context_fee, fee)?;

        // Update stats
        let from_wallet = &mut ctx.accounts.from_wallet;
        from_wallet.tx_count += 1;
        let points_earned = std::cmp::min(10, std::cmp::max(1, (amount / 100_000_000) as u64));
        from_wallet.points += points_earned;

        let to_wallet = &mut ctx.accounts.to_wallet;
        to_wallet.points += 5; // Bonus for receiving agent-to-agent

        emit!(AgentTransfer {
            from_agent: from_wallet.agent_id.clone(),
            to_agent: to_wallet.agent_id.clone(),
            amount: send_amount,
            fee,
            points_earned,
        });

        Ok(())
    }

    /// Send SPL tokens (USDC, etc.) from agent wallet (0.5% fee)
    pub fn send_token(ctx: Context<SendToken>, amount: u64) -> Result<()> {
        let fee = amount / 200; // 0.5%
        let send_amount = amount - fee;
        
        let wallet = &ctx.accounts.wallet;
        let bump = wallet.bump;
        let agent_id = wallet.agent_id.clone();
        let seeds = &[b"wallet".as_ref(), agent_id.as_bytes(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Transfer tokens to recipient
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.wallet_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.wallet.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, send_amount)?;

        // Transfer fee to treasury
        let cpi_ctx_fee = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.wallet_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.wallet.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx_fee, fee)?;

        // Update wallet stats
        let wallet = &mut ctx.accounts.wallet;
        wallet.tx_count += 1;
        
        // Award more points for USDC transactions (2-20 points)
        let points_earned = std::cmp::min(20, std::cmp::max(2, (amount / 100_000) as u64)); // USDC has 6 decimals
        wallet.points += points_earned;

        emit!(TokenSent {
            agent_id: wallet.agent_id.clone(),
            mint: ctx.accounts.mint.key(),
            amount: send_amount,
            fee,
            recipient: ctx.accounts.recipient_token_account.key(),
            points_earned,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct CreateWallet<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + AgentWallet::INIT_SPACE,
        seeds = [b"wallet", agent_id.as_bytes()],
        bump
    )]
    pub wallet: Account<'info, AgentWallet>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendSol<'info> {
    #[account(mut, has_one = owner)]
    pub wallet: Account<'info, AgentWallet>,
    pub owner: Signer<'info>,
    /// CHECK: Recipient can be any account
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    /// CHECK: Treasury account
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendToAgent<'info> {
    #[account(mut, has_one = owner)]
    pub from_wallet: Account<'info, AgentWallet>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub to_wallet: Account<'info, AgentWallet>,
    /// CHECK: Treasury account
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendToken<'info> {
    #[account(mut, has_one = owner)]
    pub wallet: Account<'info, AgentWallet>,
    pub owner: Signer<'info>,
    
    /// CHECK: Token mint (USDC or other SPL token)
    pub mint: AccountInfo<'info>,
    
    /// Wallet's token account
    #[account(mut)]
    pub wallet_token_account: Account<'info, TokenAccount>,
    
    /// Recipient's token account
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    /// Treasury's token account for fees
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct AgentWallet {
    #[max_len(64)]
    pub agent_id: String,
    pub owner: Pubkey,
    pub points: u64,
    pub created_at: i64,
    pub tx_count: u64,
    pub bump: u8,
}

#[event]
pub struct WalletCreated {
    pub agent_id: String,
    pub wallet: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct SolSent {
    pub agent_id: String,
    pub amount: u64,
    pub fee: u64,
    pub recipient: Pubkey,
    pub points_earned: u64,
}

#[event]
pub struct AgentTransfer {
    pub from_agent: String,
    pub to_agent: String,
    pub amount: u64,
    pub fee: u64,
    pub points_earned: u64,
}

#[event]
pub struct TokenSent {
    pub agent_id: String,
    pub mint: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub recipient: Pubkey,
    pub points_earned: u64,
}

#[error_code]
pub enum ClawWalletError {
    #[msg("Insufficient funds in wallet")]
    InsufficientFunds,
}
