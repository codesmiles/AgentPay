# Terminal 1 — contracts
cd contracts && npm install && npx hardhat node

# Terminal 2 — deploy
cd contracts && npx hardhat run scripts/deploy.ts --network localhost

# Terminal 3 — API
cd agent-backend && bun run dev

# Terminal 4 — Autonomous worker
cd agent-backend && bun run worker

# Terminal 5 — Dashboard
cd dashboard && npm install && npm run dev

# Trigger the agent
curl -X POST http://localhost:3001/webhook/delivery \
  -H 'Content-Type: application/json' \
  -d '{"deliveryId":"del-001","escrowId":"escrow-demo-001","amount":"50.00","recipient":"0xYourAddress","status":"completed","metadata":{"courier":"FastShip","proof":"https://proof.example.com"}}'

# Watch decisions appear
open http://localhost:3000