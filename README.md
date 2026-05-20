# LP Farm Monitor

Live dashboard for monitoring LP farming simulation positions across multiple chains.

## Features

- Real-time position tracking (SOL, Base, Arbitrum)
- PnL & Impermanent Loss monitoring
- Fee accumulation tracking
- APR calculation (24h rolling)
- Range status visualization
- Auto-refresh every 10 seconds

## Supported Protocols

- Meteora DLMM (Solana)
- Orca Whirlpool (Solana)
- Uniswap V3 (Base, Arbitrum)
- Aerodrome (Base)
- Camelot V3 (Arbitrum)

## Deployment

Deployed via GitHub Pages: https://xdropagent.github.io/lp-farm-monitor/

## Development

Static HTML + vanilla JS. No build step required.

```bash
# Local preview
python3 -m http.server 8080
open http://localhost:8080
```

## License

MIT
