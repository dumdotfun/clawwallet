use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("CLAWwa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

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

        // Transfer to recipient
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.wallet.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, send_amount)?;

        // Transfer fee to treasury
        let cpi_context_fee = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.wallet.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context_fee, fee)?;

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

#[account]
#[derive(InitSpace)]
pub struct AgentWallet {
    #[max_len(64)]
    pub agent_id: String,
    pub owner: Pubkey,
    pub points: u64,
    pub created_at: i64,
    pub tx_count: u64,
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
