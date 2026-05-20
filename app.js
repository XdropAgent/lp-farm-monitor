// LP Farm Monitor - Multi-Strategy Comparison Dashboard
// Fetches real-time data from /api/strategies

let DATA = {};
let activeTab = "compare";
let refreshInterval = null;

async function fetchData() {
    try {
        console.log('Fetching /api/strategies...');
        const res = await fetch('/api/strategies?t=' + Date.now());
        console.log('Response status:', res.status);
        if (!res.ok) throw new Error('API error: ' + res.status);
        DATA = await res.json();
        console.log('DATA loaded:', Object.keys(DATA.strategies || {}));
        updateStatus('live');
        return true;
    } catch (e) {
        console.error('Fetch failed:', e.message);
        updateStatus('offline');
        return false;
    }
}

function updateStatus(state) {
    const dot = document.querySelector('.dot');
    const label = document.querySelector('.status-label');
    if (state === 'live') {
        dot.style.background = '#00d68f';
        label.textContent = 'Live · 30s refresh';
    } else {
        dot.style.background = '#ff4d6a';
        label.textContent = 'Offline';
    }
}

function formatUSD(v) {
    if (Math.abs(v) < 0.01) return '$' + v.toFixed(4);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

function formatPct(v) {
    const sign = v >= 0 ? '+' : '';
    return sign + v.toFixed(3) + '%';
}

function pnlClass(v) { return v >= 0 ? 'green' : 'red'; }

function timeAgo(ts) {
    const diff = Date.now() / 1000 - ts;
    if (diff < 60) return Math.floor(diff) + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

function renderTabs() {
    const el = document.getElementById('tabs');
    const strategies = DATA.strategies || {};
    let html = '<div class="tab active" onclick="switchTab(\'compare\')">⚔️ Compare</div>';

    for (const [key, s] of Object.entries(strategies)) {
        const pnl = s.summary?.total_pnl_pct || 0;
        const pnlHtml = s.status === 'active'
            ? '<span class="tab-pnl ' + pnlClass(pnl) + '">' + formatPct(pnl) + '</span>'
            : '<span class="tab-pnl" style="color:var(--muted)">no data</span>';
        html += '<div class="tab ' + (activeTab === key ? 'active' : '') + '" onclick="switchTab(\'' + key + '\')">' + s.name + pnlHtml + '</div>';
    }
    el.innerHTML = html;
}

function renderCompareBar() {
    const el = document.getElementById('compare-bar');
    const strategies = DATA.strategies || {};
    const entries = Object.entries(strategies);

    if (entries.length < 2) {
        el.innerHTML = '';
        return;
    }

    let bestKey = null;
    let bestPnl = -Infinity;
    for (const [key, s] of entries) {
        const pnl = s.summary?.total_pnl_pct || 0;
        if (pnl > bestPnl) { bestPnl = pnl; bestKey = key; }
    }

    let html = '';
    for (const [key, s] of entries) {
        const sum = s.summary || {};
        const isWinner = key === bestKey && s.status === 'active';
        const crown = isWinner ? '<div class="crown">👑 LEADING</div>' : '';
        html += '<div class="compare-card ' + (isWinner ? 'winner' : '') + '">' +
                crown +
                '<div class="label">' + s.name + '</div>' +
                '<div class="value ' + pnlClass(sum.total_pnl_pct || 0) + '">' + formatPct(sum.total_pnl_pct || 0) + '</div>' +
                '<div class="sub">' + formatUSD(sum.total_pnl_usd || 0) + ' PnL · ' + formatUSD(sum.total_fees_usd || 0) + ' fees</div>' +
                '<div class="sub">' + (sum.active_positions || 0) + ' open · ' + (sum.closed_positions || 0) + ' closed · ' + formatUSD(sum.total_capital_usd || 0) + ' capital</div>' +
                '</div>';
    }
    el.innerHTML = html;
}

function renderPanels() {
    const el = document.getElementById('panels');
    const strategies = DATA.strategies || {};

    let html = '<div class="strategy-panel ' + (activeTab === 'compare' ? 'active' : '') + '" id="panel-compare">';
    html += renderComparePanel(strategies);
    html += '</div>';

    for (const [key, s] of Object.entries(strategies)) {
        html += '<div class="strategy-panel ' + (activeTab === key ? 'active' : '') + '" id="panel-' + key + '">';
        html += renderStrategyPanel(key, s);
        html += '</div>';
    }
    el.innerHTML = html;
}

function renderComparePanel(strategies) {
    const entries = Object.entries(strategies);
    if (entries.length === 0) return '<div class="no-data">No strategy data available</div>';

    let html = '<div class="stats">';
    for (const [key, s] of entries) {
        const sum = s.summary || {};
        const color = key === 'meridian' ? 'blue' : 'green';
        html += '<div class="stat-card"><div class="stat-label">' + s.name + ' — Capital</div><div class="stat-value">' + formatUSD(sum.total_capital_usd || 0) + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">' + s.name + ' — PnL</div><div class="stat-value ' + pnlClass(sum.total_pnl_usd || 0) + '">' + formatUSD(sum.total_pnl_usd || 0) + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">' + s.name + ' — APY (avg)</div><div class="stat-value ' + color + '">' + calcAvgApy(s) + '%</div></div>';
    }
    html += '</div>';

    html += '<h3 style="color:var(--muted);font-size:0.85rem;margin-bottom:12px;">All Active Positions</h3>';
    html += '<div class="positions">';
    for (const [key, s] of entries) {
        const positions = s.positions || [];
        for (const p of positions) {
            html += renderPositionCard(p, key);
        }
    }
    html += '</div>';

    return html;
}

function calcAvgApy(s) {
    const positions = s.positions || [];
    if (positions.length === 0) return '0.0';
    const avg = positions.reduce((sum, p) => sum + (p.current_apy || 0), 0) / positions.length;
    return avg.toFixed(1);
}

function renderStrategyPanel(key, s) {
    if (s.status === 'no_data') {
        return '<div class="no-data"><p style="font-size:1.2rem;margin-bottom:8px;">📊 ' + s.name + '</p><p>' + (s.description || '') + '</p><p style="margin-top:12px;">No position data yet. Start the strategy with 2 SOL to begin tracking.</p></div>';
    }

    const sum = s.summary || {};
    let html = '<div class="stats">' +
        '<div class="stat-card"><div class="stat-label">Capital</div><div class="stat-value">' + formatUSD(sum.total_capital_usd) + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Total PnL</div><div class="stat-value ' + pnlClass(sum.total_pnl_usd) + '">' + formatUSD(sum.total_pnl_usd) + ' (' + formatPct(sum.total_pnl_pct) + ')</div></div>' +
        '<div class="stat-card"><div class="stat-label">Fees Earned</div><div class="stat-value green">' + formatUSD(sum.total_fees_usd) + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Avg APY</div><div class="stat-value green">' + calcAvgApy(s) + '%</div></div>' +
        '<div class="stat-card"><div class="stat-label">Positions</div><div class="stat-value">' + sum.active_positions + ' open / ' + sum.closed_positions + ' closed</div></div>' +
        '<div class="stat-card"><div class="stat-label">Last Update</div><div class="stat-value">' + (s.last_update ? timeAgo(s.last_update) : 'N/A') + '</div></div>' +
        '</div>';

    const positions = s.positions || [];
    if (positions.length > 0) {
        html += '<div class="positions">';
        for (const p of positions) {
            html += renderPositionCard(p, key);
        }
        html += '</div>';
    }

    const closed = s.closed_positions || [];
    if (closed.length > 0) {
        html += '<div class="closed-section"><h3>Closed Positions</h3><div class="positions">';
        for (const p of closed) {
            html += renderClosedCard(p, key);
        }
        html += '</div></div>';
    }

    return html;
}

function renderPositionCard(p, strategyKey) {
    const badgeClass = strategyKey === 'meridian' ? 'badge-meridian' : 'badge-custom';
    const strategyLabel = strategyKey === 'meridian' ? 'Meridian AI' : 'Custom Sim';
    const noteHtml = p.note ? '<span class="badge">' + p.note + '</span>' : '';
    
    return '<div class="position-card">' +
        '<div class="position-header">' +
        '<span class="pool-name">' + (p.pool_name || 'Unknown') + '</span>' +
        '<span class="badge ' + badgeClass + '">' + strategyLabel + '</span>' +
        '<span class="badge badge-open">' + (p.status || 'open') + '</span>' +
        noteHtml +
        '</div>' +
        '<div class="position-grid">' +
        '<div><span class="metric-label">Capital</span><span class="metric-value">' + formatUSD(p.capital_usd || 0) + '</span></div>' +
        '<div><span class="metric-label">PnL</span><span class="metric-value ' + pnlClass(p.current_pnl_pct || 0) + '">' + formatPct(p.current_pnl_pct || 0) + ' (' + formatUSD(p.current_pnl_usd || 0) + ')</span></div>' +
        '<div><span class="metric-label">APY</span><span class="metric-value green">' + (p.current_apy || 0).toFixed(1) + '%</span></div>' +
        '<div><span class="metric-label">IL</span><span class="metric-value yellow">' + (p.current_il_pct || 0).toFixed(4) + '%</span></div>' +
        '<div><span class="metric-label">Fees</span><span class="metric-value green">' + formatUSD(p.accumulated_fee || 0) + '</span></div>' +
        '<div><span class="metric-label">Duration</span><span class="metric-value">' + (p.hours_held || 0).toFixed(1) + 'h</span></div>' +
        '<div><span class="metric-label">Entry</span><span class="metric-value">' + (p.entry_price || 0).toFixed(6) + '</span></div>' +
        '<div><span class="metric-label">Current</span><span class="metric-value">' + (p.last_price || 0).toFixed(6) + '</span></div>' +
        '</div>' +
        '</div>';
}

function renderClosedCard(p, strategyKey) {
    const badgeClass = strategyKey === 'meridian' ? 'badge-meridian' : 'badge-custom';
    const strategyLabel = strategyKey === 'meridian' ? 'Meridian AI' : 'Custom Sim';
    const reasonHtml = p.close_reason ? '<span class="badge">' + p.close_reason + '</span>' : '';
    
    return '<div class="position-card">' +
        '<div class="position-header">' +
        '<span class="pool-name">' + (p.pool_name || 'Unknown') + '</span>' +
        '<span class="badge ' + badgeClass + '">' + strategyLabel + '</span>' +
        '<span class="badge badge-closed">closed</span>' +
        reasonHtml +
        '</div>' +
        '<div class="position-grid">' +
        '<div><span class="metric-label">Capital</span><span class="metric-value">' + formatUSD(p.capital_usd || 0) + '</span></div>' +
        '<div><span class="metric-label">Final PnL</span><span class="metric-value ' + pnlClass(p.final_pnl_pct || 0) + '">' + formatPct(p.final_pnl_pct || 0) + ' (' + formatUSD(p.final_pnl_usd || 0) + ')</span></div>' +
        '<div><span class="metric-label">Fees</span><span class="metric-value green">' + formatUSD(p.fees_earned || 0) + '</span></div>' +
        '<div><span class="metric-label">Duration</span><span class="metric-value">' + (p.hours_held || 0).toFixed(1) + 'h</span></div>' +
        '</div>' +
        '</div>';
}

function switchTab(tab) {
    activeTab = tab;
    renderTabs();
    renderPanels();
}

function renderFooter() {
    const el = document.getElementById('footer');
    const st = DATA.server_time;
    if (!st) return;
    el.textContent = 'Server: ' + new Date(st * 1000).toLocaleTimeString() + ' · Auto-refresh 30s · 2 SOL per strategy';
}

async function refresh() {
    await fetchData();
    try {
        console.log('Rendering tabs...');
        renderTabs();
        console.log('Rendering compare bar...');
        renderCompareBar();
        console.log('Rendering panels...');
        renderPanels();
        console.log('Rendering footer...');
        renderFooter();
        console.log('Render complete');
    } catch(e) {
        console.error('Render error:', e.message, e.stack);
    }
}

function initDashboard() {
    try {
        console.log('Initializing dashboard...');
        refresh();
        refreshInterval = setInterval(refresh, 30000);
        console.log('Dashboard initialized');
    } catch(e) {
        console.error('Init error:', e.message, e.stack);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
