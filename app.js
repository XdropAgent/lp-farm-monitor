// LP Farm Monitor - Simulation Data
// Replace with real API calls when connecting to live data

const SIMULATION_POSITIONS = [
    {
        pool: "SOL/USDC",
        chain: "solana",
        protocol: "Meteora DLMM",
        value: 2450.80,
        fees: 187.32,
        il: -1.2,
        apr: 68.5,
        rangePercent: 85,
        inRange: true,
        entryDate: "2026-05-10"
    },
    {
        pool: "ETH/USDC",
        chain: "base",
        protocol: "Uniswap V3",
        value: 1820.50,
        fees: 94.18,
        il: -0.8,
        apr: 42.3,
        rangePercent: 72,
        inRange: true,
        entryDate: "2026-05-12"
    },
    {
        pool: "ARB/ETH",
        chain: "arbitrum",
        protocol: "Camelot V3",
        value: 980.25,
        fees: 62.44,
        il: -2.5,
        apr: 95.2,
        rangePercent: 45,
        inRange: false,
        entryDate: "2026-05-08"
    },
    {
        pool: "SOL/JUP",
        chain: "solana",
        protocol: "Orca Whirlpool",
        value: 1560.00,
        fees: 142.88,
        il: -3.1,
        apr: 112.7,
        rangePercent: 90,
        inRange: true,
        entryDate: "2026-05-14"
    },
    {
        pool: "WETH/USDC",
        chain: "base",
        protocol: "Aerodrome",
        value: 3200.00,
        fees: 210.55,
        il: -0.4,
        apr: 55.8,
        rangePercent: 95,
        inRange: true,
        entryDate: "2026-05-06"
    },
    {
        pool: "GMX/ETH",
        chain: "arbitrum",
        protocol: "Uniswap V3",
        value: 720.30,
        fees: 38.92,
        il: -4.2,
        apr: 78.4,
        rangePercent: 30,
        inRange: false,
        entryDate: "2026-05-15"
    }
];

function formatUSD(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function getChainClass(chain) {
    return `chain-${chain}`;
}

function getChainLabel(chain) {
    const labels = { solana: "SOL", base: "Base", arbitrum: "ARB" };
    return labels[chain] || chain;
}

function renderStats(positions) {
    const tvl = positions.reduce((sum, p) => sum + p.value, 0);
    const fees = positions.reduce((sum, p) => sum + p.fees, 0);
    const avgIL = positions.reduce((sum, p) => sum + p.il, 0) / positions.length;
    const pnl = fees + positions.reduce((sum, p) => sum + (p.value * p.il / 100), 0);
    const avgAPR = positions.reduce((sum, p) => sum + p.apr, 0) / positions.length;
    const inRange = positions.filter(p => p.inRange).length;

    document.getElementById('tvl').textContent = formatUSD(tvl);
    document.getElementById('tvl-change').textContent = `+${(Math.random() * 3).toFixed(1)}% 24h`;
    
    document.getElementById('fees').textContent = formatUSD(fees);
    document.getElementById('fees-change').textContent = `+${formatUSD(fees * 0.03)} today`;
    document.getElementById('fees-change').className = 'change positive';
    
    document.getElementById('il').textContent = `${avgIL.toFixed(2)}%`;
    document.getElementById('il').style.color = avgIL < 0 ? 'var(--red)' : 'var(--green)';
    document.getElementById('il-change').textContent = 'vs HODL avg';
    
    document.getElementById('pnl').textContent = formatUSD(pnl);
    document.getElementById('pnl').style.color = pnl >= 0 ? 'var(--green)' : 'var(--red)';
    document.getElementById('pnl-change').textContent = pnl >= 0 ? '↑ Profitable' : '↓ Underwater';
    document.getElementById('pnl-change').className = `change ${pnl >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('active-count').textContent = positions.length;
    document.getElementById('in-range-count').textContent = `${inRange} in range`;
    document.getElementById('in-range-count').className = `change ${inRange === positions.length ? 'positive' : ''}`;
    
    document.getElementById('apr').textContent = `${avgAPR.toFixed(1)}%`;
    document.getElementById('apr').style.color = 'var(--green)';
    
    document.getElementById('position-badge').textContent = `${positions.length} positions`;
}

function renderPositions(positions) {
    const tbody = document.getElementById('positions-body');
    tbody.innerHTML = positions.map(p => `
        <tr>
            <td>
                <strong>${p.pool}</strong>
                <div style="font-size:0.7rem;color:var(--muted);margin-top:2px">${p.protocol}</div>
            </td>
            <td><span class="chain-badge ${getChainClass(p.chain)}">${getChainLabel(p.chain)}</span></td>
            <td>${formatUSD(p.value)}</td>
            <td class="positive">${formatUSD(p.fees)}</td>
            <td class="${p.il < -2 ? 'negative' : ''}">${p.il.toFixed(1)}%</td>
            <td class="positive">${p.apr.toFixed(1)}%</td>
            <td>
                <div class="range-bar">
                    <div class="fill ${p.inRange ? 'range-in' : 'range-out'}" style="width:${p.rangePercent}%"></div>
                </div>
                <span style="font-size:0.7rem;margin-left:6px;color:var(--muted)">${p.rangePercent}%</span>
            </td>
            <td>
                <span style="color:${p.inRange ? 'var(--green)' : 'var(--red)'}">
                    ${p.inRange ? '● In Range' : '○ Out of Range'}
                </span>
            </td>
        </tr>
    `).join('');
}

function updateTime() {
    const now = new Date();
    document.getElementById('update-time').textContent = now.toLocaleString();
    document.getElementById('last-update').textContent = `Last: ${now.toLocaleTimeString()}`;
}

// Simulate small price movements
function simulateMovement() {
    SIMULATION_POSITIONS.forEach(p => {
        p.value *= (1 + (Math.random() - 0.48) * 0.005);
        p.fees += Math.random() * 0.5;
        p.rangePercent = Math.max(10, Math.min(100, p.rangePercent + (Math.random() - 0.5) * 3));
        p.inRange = p.rangePercent > 40;
        p.apr = Math.max(5, p.apr + (Math.random() - 0.5) * 2);
    });
}

// Initial render
renderStats(SIMULATION_POSITIONS);
renderPositions(SIMULATION_POSITIONS);
updateTime();

// Auto-refresh every 10 seconds
setInterval(() => {
    simulateMovement();
    renderStats(SIMULATION_POSITIONS);
    renderPositions(SIMULATION_POSITIONS);
    updateTime();
}, 10000);
