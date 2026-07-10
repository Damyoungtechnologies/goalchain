use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

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
        market.mint = ctx.accounts.mint.key();

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

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

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
        payload: ValidateStatPayload,
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
        require!(
            (payload.fixture_summary.fixture_id as u64) == market.fixture_id,
            SettlelineError::FixtureMismatch
        );

        let mut ix_data = vec![107, 197, 232, 90, 191, 136, 105, 185]; // validate_stat discriminator
        payload.serialize(&mut ix_data)?;
        
        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.txline_program.key(),
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    ctx.accounts.daily_scores_merkle_roots.key(),
                    false,
                ),
            ],
            data: ix_data,
        };
        
        invoke(
            &ix,
            &[
                ctx.accounts.txline_program.to_account_info(),
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
            ],
        )?;

        market.status = MarketStatus::Settled;
        market.winning_outcome = Some(winning_outcome);
        market.txline_receipt_hash = payload.stat_a.event_stat_root;

        emit!(MarketSettled {
            market: market.key(),
            fixture_id: market.fixture_id,
            winning_outcome,
            txline_receipt_hash: payload.stat_a.event_stat_root,
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

        let market_key = market.key();
        let bump = market.vault_bump;
        let seeds = &[b"vault", market_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, payout)?;

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
    pub mint: Account<'info, Mint>,
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
        token::mint = mint,
        token::authority = vault,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(outcome_index: u8)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
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
    pub token_program: Program<'info, Token>,
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
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
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
    pub token_program: Program<'info, Token>,
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
    pub mint: Pubkey,
}

impl Market {
    pub fn space(max_outcomes: usize, max_label_bytes: usize) -> usize {
        8 + 32 + 8 + 1 + 8 + 1 + 1 + 1 + 4 + max_outcomes * (4 + max_label_bytes) + 4
            + max_outcomes * 8 + 8 + 2 + 32 + 32
    }
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
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateStatPayload {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
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
