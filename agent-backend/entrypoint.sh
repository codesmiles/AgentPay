#!/bin/sh
# Entrypoint for Docker: sources contract addresses written by contract-deployer,
# then hands off to the actual process (bun run src/index.ts, etc.)

SHARED_ENV="/shared/contracts.env"

if [ -f "$SHARED_ENV" ]; then
    echo "📋 Loading contract addresses from $SHARED_ENV"
    # set -a exports every variable assigned while active
    set -a
    # shellcheck disable=SC1090
    . "$SHARED_ENV"
    set +a
    echo "   CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
    echo "   USDT_ADDRESS=$USDT_ADDRESS"
else
    echo "⚠️  $SHARED_ENV not found — using environment variables as-is"
fi

exec "$@"
