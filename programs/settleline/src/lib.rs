use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("11111111111111111111111111111111");

const MAX_OUTCOMES: usize = 8;
const MAX_LABEL_BYTES: usize = 32;

#[program]
pub mod settleline {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: u64,
        market_kind: MarketKind,
        close_ts: i64,
        outcomes: Vec<String>,
    ) -> Result<()> {
        require!(outcomes.len() >= 2, SettlelineError::TooFewOutcomes);
        require!(outcomes.len() <= MAX_OUTCOMES, SettlelineError::TooManyOutcomes);
        require!(
            outcomes
                .iter()
                .all(|outcome| !outcome.is_empty() && outcome.as_bytes().len() <= MAX_LABEL_BYTES),
            SettlelineError::InvalidOutcomeLabel
        );

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.fixture_id = fixture_id;
        market.market_kind = market_kind;
        market.close_ts = close_ts;
        market.status = MarketStatus::Open;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.outcomes = outcomes;
        market.outcome_pools = vec![0; market.outcomes.len()];
        market.total_stake = 0;
        market.winning_outcome = None;
        market.txline_receipt_hash = [0; 32];

        ctx.accounts.vault.market = market.key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, outcome_index: u8, amount: u64) -> Result<()> {
        require!(amount > 0, SettlelineError::ZeroStake);

        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, SettlelineError::MarketNotOpen);
        require!(
            (outcome_index as usize) < market.outcomes.len(),
            SettlelineError::InvalidOutcome
        );

        let clock = Clock::get()?;
        require!(clock.unix_timestamp < market.close_ts, SettlelineError::MarketClosed);

        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault.key(),
            amount,
        );
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let position = &mut ctx.accounts.position;
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.outcome_index = outcome_index;
        position.stake = position
            .stake
            .checked_add(amount)
            .ok_or(SettlelineError::MathOverflow)?;
        position.claimed = false;
        position.bump = ctx.bumps.position;

        market.total_stake = market
            .total_stake
            .checked_add(amount)
            .ok_or(SettlelineError::MathOverflow)?;
        market.outcome_pools[outcome_index as usize] = market.outcome_pools[outcome_index as usize]
            .checked_add(amount)
            .ok_or(SettlelineError::MathOverflow)?;

        emit!(PositionDeposited {
            market: market.key(),
            owner: ctx.accounts.user.key(),
            outcome_index,
            amount,
        });

        Ok(())
    }

    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, SettlelineError::MarketNotOpen);
        require_keys_eq!(
            market.authority,
            ctx.accounts.authority.key(),
            SettlelineError::Unauthorized
        );

        market.status = MarketStatus::Closed;
        emit!(MarketClosed {
            market: market.key(),
            fixture_id: market.fixture_id,
        });
        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        winning_outcome: u8,
        proof: TxlineScoreProof,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Closed || market.status == MarketStatus::Open,
            SettlelineError::MarketAlreadySettled
        );
        require!(
            (winning_outcome as usize) < market.outcomes.len(),
            SettlelineError::InvalidOutcome
        );
        require!(proof.fixture_id == market.fixture_id, SettlelineError::FixtureMismatch);
        require!(proof.proof_nodes.len() > 0, SettlelineError::MissingProof);
        require!(
            proof.proof_nodes.len() <= TxlineScoreProof::MAX_PROOF_NODES,
            SettlelineError::ProofTooLarge
        );

        // Production path: replace this local receipt gate with a CPI into the
        // TxLINE devnet program's validate_stat instruction using the same proof.
        require!(proof.locally_consistent(), SettlelineError::InvalidTxlineProof);

        market.status = MarketStatus::Settled;
        market.winning_outcome = Some(winning_outcome);
        market.txline_receipt_hash = proof.receipt_hash;

        emit!(MarketSettled {
            market: market.key(),
            fixture_id: market.fixture_id,
            winning_outcome,
            txline_receipt_hash: proof.receipt_hash,
        });

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        require!(market.status == MarketStatus::Settled, SettlelineError::MarketNotSettled);
        require!(!position.claimed, SettlelineError::AlreadyClaimed);
        require_keys_eq!(position.owner, ctx.accounts.user.key(), SettlelineError::Unauthorized);

        let winning_outcome = market.winning_outcome.ok_or(SettlelineError::MarketNotSettled)?;
        require!(position.outcome_index == winning_outcome, SettlelineError::PositionLost);

        let winning_pool = market.outcome_pools[winning_outcome as usize];
        require!(winning_pool > 0, SettlelineError::NoWinningPool);

        let payout = (position.stake as u128)
            .checked_mul(market.total_stake as u128)
            .ok_or(SettlelineError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(SettlelineError::MathOverflow)? as u64;

        let rent_floor = Rent::get()?.minimum_balance(Vault::SPACE);
        let vault_lamports = ctx.accounts.vault.to_account_info().lamports();
        require!(
            vault_lamports.saturating_sub(rent_floor) >= payout,
            SettlelineError::InsufficientVaultBalance
        );

        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += payout;
        position.claimed = true;

        emit!(PositionClaimed {
            market: market.key(),
            owner: ctx.accounts.user.key(),
            payout,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fixture_id: u64, market_kind: MarketKind, close_ts: i64, outcomes: Vec<String>)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Market::space(outcomes.len(), MAX_LABEL_BYTES),
        seeds = [
            b"market",
            authority.key().as_ref(),
            &fixture_id.to_le_bytes(),
            &[market_kind.seed()]
        ],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = authority,
        space = Vault::SPACE,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome_index: u8)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
        has_one = market
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init_if_needed,
        payer = user,
        space = Position::SPACE,
        seeds = [
            b"position",
            market.key().as_ref(),
            user.key().as_ref(),
            &[outcome_index]
        ],
        bump
    )]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    pub keeper: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: TxLINE program account used by the backend/keeper when the CPI
    /// adapter is enabled. Keep this account from the same cluster as the API.
    pub txline_program: UncheckedAccount<'info>,
    /// CHECK: TxLINE daily scores PDA containing the anchored Merkle root.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
        has_one = market
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [
            b"position",
            market.key().as_ref(),
            user.key().as_ref(),
            &[position.outcome_index]
        ],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,
}

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub fixture_id: u64,
    pub market_kind: MarketKind,
    pub close_ts: i64,
    pub status: MarketStatus,
    pub bump: u8,
    pub vault_bump: u8,
    pub outcomes: Vec<String>,
    pub outcome_pools: Vec<u64>,
    pub total_stake: u64,
    pub winning_outcome: Option<u8>,
    pub txline_receipt_hash: [u8; 32],
}

impl Market {
    pub fn space(max_outcomes: usize, max_label_bytes: usize) -> usize {
        8 + 32 + 8 + 1 + 8 + 1 + 1 + 1 + 4 + max_outcomes * (4 + max_label_bytes) + 4
            + max_outcomes * 8 + 8 + 2 + 32
    }
}

#[account]
pub struct Vault {
    pub market: Pubkey,
}

impl Vault {
    pub const SPACE: usize = 8 + 32;
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub outcome_index: u8,
    pub stake: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Position {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketKind {
    MatchWinner,
    TotalGoalsOver25,
    FirstScorer,
    CustomProp,
}

impl MarketKind {
    pub fn seed(&self) -> u8 {
        match self {
            MarketKind::MatchWinner => 0,
            MarketKind::TotalGoalsOver25 => 1,
            MarketKind::FirstScorer => 2,
            MarketKind::CustomProp => 3,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Closed,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxlineScoreProof {
    pub fixture_id: u64,
    pub seq: u64,
    pub stat_key: u16,
    pub expected_value: i64,
    pub event_stat_root: [u8; 32],
    pub receipt_hash: [u8; 32],
    pub proof_nodes: Vec<TxlineProofNode>,
}

impl TxlineScoreProof {
    pub const MAX_PROOF_NODES: usize = 32;

    pub fn locally_consistent(&self) -> bool {
        self.fixture_id > 0
            && self.seq > 0
            && self.stat_key > 0
            && self.event_stat_root != [0; 32]
            && self.receipt_hash != [0; 32]
            && !self.proof_nodes.is_empty()
            && self.proof_nodes.len() <= Self::MAX_PROOF_NODES
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxlineProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[event]
pub struct PositionDeposited {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub outcome_index: u8,
    pub amount: u64,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
    pub fixture_id: u64,
}

#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub winning_outcome: u8,
    pub txline_receipt_hash: [u8; 32],
}

#[event]
pub struct PositionClaimed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub payout: u64,
}

#[error_code]
pub enum SettlelineError {
    #[msg("At least two outcomes are required")]
    TooFewOutcomes,
    #[msg("Too many outcomes")]
    TooManyOutcomes,
    #[msg("Outcome labels must be 1-32 bytes")]
    InvalidOutcomeLabel,
    #[msg("Market is not open")]
    MarketNotOpen,
    #[msg("Market is already closed")]
    MarketClosed,
    #[msg("Market is already settled")]
    MarketAlreadySettled,
    #[msg("Market has not settled yet")]
    MarketNotSettled,
    #[msg("Invalid outcome")]
    InvalidOutcome,
    #[msg("Stake amount must be greater than zero")]
    ZeroStake,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Only the authorized account can perform this action")]
    Unauthorized,
    #[msg("TxLINE proof fixture does not match this market")]
    FixtureMismatch,
    #[msg("TxLINE proof is missing proof nodes")]
    MissingProof,
    #[msg("TxLINE proof has too many proof nodes")]
    ProofTooLarge,
    #[msg("TxLINE proof did not pass the settlement gate")]
    InvalidTxlineProof,
    #[msg("Position did not select the winning outcome")]
    PositionLost,
    #[msg("Position has already been claimed")]
    AlreadyClaimed,
    #[msg("No stake exists on the winning side")]
    NoWinningPool,
    #[msg("Vault cannot cover this payout")]
    InsufficientVaultBalance,
}
