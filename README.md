# AgentPay

AgentPay is a Docker-first autonomous escrow payment system for digital delivery workflows.

## Vision

AgentPay is built around a simple idea: digital work should be paid with the same certainty and automation that software already brings to delivery itself.

In many online workflows, the hardest part is not moving money. It is deciding when money should move. Teams still rely on manual review, fragmented proofs, delayed approvals, and platform operators acting as the trust layer between both sides of a transaction.

This project explores a different model:

- escrow holds funds until delivery conditions are met
- software evaluates delivery signals and risk in real time
- AI-assisted reasoning helps determine whether to release, delay, or reject payment
- every outcome is written to an auditable ledger and, when approved, executed on-chain

The long-term vision is an autonomous payment agent that can sit between buyers, sellers, platforms, and service providers and handle digital delivery settlement with less friction, less ambiguity, and a stronger audit trail.

That makes AgentPay a foundation for systems where payment is not a separate back-office step, but a programmable outcome of verified delivery.

It combines:

- a local Hardhat blockchain
- an escrow smart contract and mock USDT token
- a Bun backend with API and worker processes
- Redis-backed job processing
- AI-assisted decisioning for release, wait, or rejection
- a SQLite decision ledger for auditability

## What It Does

AgentPay receives delivery or milestone events, evaluates them, and decides whether to release escrowed funds.

At runtime it can:

- ingest webhook-style payment events
- inspect escrow state on-chain
- score obvious fraud signals
- call an AI model to reason about payout decisions
- execute on-chain escrow actions
- persist every decision with reasoning, confidence, and transaction metadata
- retry delayed decisions automatically

## Core Capabilities

### 1. Autonomous payment decisions

The worker evaluates incoming delivery events and produces one of three outcomes:

- `PAY`
- `WAIT`
- `REJECT`

That decision is based on:

- fraud signal analysis
- escrow state
- agent wallet gas status
- AI reasoning

### 2. On-chain settlement

When the decision is `PAY`, AgentPay can:

- release a normal escrow payment
- process milestone payments
- process split payments

When the decision is `REJECT`, it can freeze an escrow if fraud risk is high enough.

### 3. Decision ledger

Every decision is written to SQLite with:

- delivery id
- escrow id
- event type
- decision
- confidence
- reasoning
- risk factors
- retry state
- transaction hash and block number when applicable

### 4. Wallet abstraction through WDK

The backend uses Tether’s WDK to derive and manage the agent wallet from a seed phrase.

That allows the agent to:

- derive a deterministic wallet from `WDK_SEED_PHRASE`
- inspect wallet balances
- sign and send EVM transactions
- expose wallet status through the API

## Main Components

### `contracts/`

Contains:

- Hardhat config and Docker image
- `MockUSDT`
- `AgentPayEscrow`
- deployment scripts

The deployer seeds a demo escrow on startup so the system can be tested immediately.

### `agent-backend/`

Contains:

- Bun API server
- BullMQ worker
- fraud analysis
- AI reasoning
- SQLite decision ledger
- WDK wallet integration

Key endpoints:

- `GET /health`
- `GET /agent/status`
- `GET /agent/wdk/status`
- `GET /agent/decisions`
- `POST /webhook/delivery`
- `POST /webhook/milestone`
- `POST /oracle/input`
- `GET /demo/setup`

### `dashboard/`

Contains the front-end application for interacting with the backend.

### `docker-compose.yaml`

Orchestrates:

- Redis
- Hardhat node
- contract deployer
- API
- worker
- dashboard

## Runtime Architecture

The startup order is:

1. `redis`
2. `blockchain-node`
3. `contract-deployer`
4. `agent-api`
5. `agent-worker`
6. `dashboard`

At startup:

- contracts are deployed to the local Hardhat node
- addresses are shared through `/shared/contracts.env`
- the backend reads those addresses
- the worker starts listening for queued payment jobs

## Typical Flow

1. A delivery event is sent to the API.
2. The API queues the event in Redis.
3. The worker reads the event and checks on-chain idempotency.
4. Fraud signals are scored.
5. AI reasoning determines `PAY`, `WAIT`, or `REJECT`.
6. The decision is saved to SQLite.
7. If needed, the worker executes an on-chain transaction.
8. Retry scheduling kicks in for `WAIT` decisions.

## Use Cases

AgentPay is useful anywhere you want programmable escrow release with an auditable decision trail.

Examples:

- logistics and delivery confirmation payouts
- milestone-based contractor payments
- marketplace escrow for off-platform fulfillment
- vendor settlements with fraud review
- autonomous payout agents for internal operations demos
- AI-assisted payment orchestration prototypes

## Why This Repo Uses SQLite

This project currently uses SQLite because:

- Bun includes `bun:sqlite`
- the decision ledger is simple and local to the stack
- it keeps the runtime lighter for demos and local testing

The current Docker setup stores SQLite on a dedicated volume at `/data/agentpay.db`, not in the source bind mount. That avoids WAL-related Docker Desktop file I/O issues.

If you later need:

- multi-instance write scaling
- stronger operational tooling
- richer relational reporting
- hosted database workflows

Postgres is the natural upgrade path.

## Running the Stack

Create a root `.env` with:

```env
OPENAI_API_KEY=your_openai_key
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Make sure [agent-backend/.env](/Users/mac/Documents/persional_projects/AgentPay/agent-backend/.env) contains a valid `WDK_SEED_PHRASE`.

Then run:

```bash
docker compose down -v
docker compose up --build
```

## Important Operational Notes

- The agent wallet must have gas on the chain pointed to by `RPC_URL`.
- Changing `WDK_SEED_PHRASE` changes the agent wallet address.
- The local Hardhat node and deployer are part of the default compose flow.
- Contract addresses are shared into the backend at runtime, not hardcoded.

<!-- ## Testing

Use the full testing guide here:

[TESTING.md](/Users/mac/Documents/persional_projects/AgentPay/TESTING.md) -->
