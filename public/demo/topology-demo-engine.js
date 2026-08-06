// Topology Demo Engine — adapted from Yoda Flow Navigator
// Self-contained D3 force-directed graph with lineage traversal
(function () {
    const svg = d3.select("#main-graph");
    const tooltip = d3.select("#tooltip");
    const graphArea = document.getElementById('graphArea');
    let width = graphArea.clientWidth;
    let height = graphArea.clientHeight;
    svg.attr('width', width).attr('height', height);

    // Panel toggle
    document.getElementById('panelToggle').onclick = () => {
        const panel = document.getElementById('uiPanel');
        panel.classList.toggle('collapsed');
        document.getElementById('panelToggle').textContent = panel.classList.contains('collapsed') ? '☰' : '✕';
        setTimeout(() => {
            width = graphArea.clientWidth; height = graphArea.clientHeight;
            svg.attr('width', width).attr('height', height);
            simulation.force('x', d3.forceX(width / 2).strength(0.08));
            simulation.force('y', d3.forceY(height / 2).strength(0.08));
            simulation.alpha(0.3).restart();
        }, 400);
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Parse CSV data from global
    const csvData = globalThis.routesDataCsv;
    const data = d3.csvParse(csvData);
    const catalogByName = new Map();
    if (typeof MIGRATION_CATALOG !== 'undefined') {
        MIGRATION_CATALOG.forEach(row => catalogByName.set(row.flow_name, row));
    }

    // Icon base path
    const ICON_BASE = './icons/';

    // Node ID helper
    function getResourceId(row) {
        if (row.service === 'sftp') return row.component;
        return `${row.system}-${row.service}-${row.component}`;
    }

    // Build node catalog
    const allRoutes = Array.from(new Set(data.map(d => d.flow_name))).sort();
    const nodeCatalog = new Map();
    data.forEach(row => {
        if (!nodeCatalog.has(row.flow_name)) {
            const flowType = (row.flow_type || 'route').toLowerCase();
            const cat = catalogByName.get(row.flow_name) || {};
            nodeCatalog.set(row.flow_name, {
                id: row.flow_name, label: row.flow_name,
                nodeType: flowType, service: flowType, system: 'middleware',
                owner: cat.owner || '', entity: cat.entity || '',
                project: cat.project || '', description: cat.description || '',
                source_system: cat.source_system || '', target_system: cat.target_system || '',
            });
        }
        const rid = getResourceId(row);
        if (!nodeCatalog.has(rid)) {
            nodeCatalog.set(rid, {
                id: rid, label: row.component, nodeType: 'endpoint',
                service: (row.service || 'other').toLowerCase(), system: row.system,
                component: row.component, protocol: row.protocol,
                direction: row.direction, operation: row.operation, endpoint: row.endpoint,
            });
        }
    });

    // Adjacency
    const adjacency = new Map(), adjacencyOut = new Map(), adjacencyIn = new Map();
    data.forEach(row => {
        const rid = getResourceId(row);
        const fid = row.flow_name;
        const isInput = (row.direction || '').toLowerCase() === 'inbound';
        [adjacency, adjacencyOut, adjacencyIn].forEach(m => { if (!m.has(fid)) m.set(fid, new Set()); if (!m.has(rid)) m.set(rid, new Set()); });
        adjacency.get(fid).add(rid); adjacency.get(rid).add(fid);
        if (isInput) { adjacencyOut.get(rid).add(fid); adjacencyIn.get(fid).add(rid); }
        else { adjacencyOut.get(fid).add(rid); adjacencyIn.get(rid).add(fid); }
    });

    // BFS lineage
    const topoDepths = new Map(), topoRanks = new Map();
    let maxLineageDepth = Infinity;
    function bfs(startId) {
        const visited = new Set(), depths = new Map(), ranks = new Map();
        const queue = [{ id: startId, depth: 0, rank: 0, dir: 'none' }];
        visited.add(startId); depths.set(startId, 0); ranks.set(startId, 0);
        while (queue.length > 0) {
            const { id: cur, depth, rank, dir } = queue.shift();
            if (depth >= maxLineageDepth) continue;
            let neighbors = new Set();
            if (dir === 'none') {
                (adjacencyOut.get(cur) || []).forEach(n => neighbors.add({ id: n, d: 'out', rc: 1 }));
                (adjacencyIn.get(cur) || []).forEach(n => neighbors.add({ id: n, d: 'in', rc: -1 }));
            } else if (dir === 'out') {
                (adjacencyOut.get(cur) || []).forEach(n => neighbors.add({ id: n, d: 'out', rc: 1 }));
            } else {
                (adjacencyIn.get(cur) || []).forEach(n => neighbors.add({ id: n, d: 'in', rc: -1 }));
            }
            for (const nb of neighbors) {
                if (visited.has(nb.id)) continue;
                visited.add(nb.id); depths.set(nb.id, depth + 1);
                if (!ranks.has(nb.id)) ranks.set(nb.id, rank + nb.rc);
                queue.push({ id: nb.id, depth: depth + 1, rank: rank + nb.rc, dir: nb.d });
            }
        }
        return { depths, ranks };
    }

    // State
    const focusNodes = new Set();
    let searchTerm = '';
    const activeTypes = new Set(['route', 'job', 'api', 'queue', 'gcs', 'gbq', 'database', 'sftp']);

    // URL params
    const urlParams = new URLSearchParams(globalThis.location.search);
    const embedMode = urlParams.get('embed') === 'true' || urlParams.get('ui') === 'false';
    if (embedMode) {
        document.getElementById('uiPanel').classList.add('collapsed');
        document.getElementById('panelToggle').textContent = '☰';
        width = graphArea.clientWidth; height = graphArea.clientHeight;
        svg.attr('width', width).attr('height', height);
    }
    const focusRoute = urlParams.get('route');
    if (focusRoute) focusRoute.split(',').forEach(id => focusNodes.add(id));

    // Filter logic
    function getFilteredData() {
        topoDepths.clear(); topoRanks.clear();
        if (focusNodes.size > 0) {
            const reachable = new Set();
            for (const nid of focusNodes) {
                const r = bfs(nid);
                for (const [k, v] of r.depths) { reachable.add(k); topoDepths.set(k, Math.min(v, topoDepths.get(k) ?? Infinity)); }
                for (const [k, v] of r.ranks) { if (!topoRanks.has(k)) topoRanks.set(k, v); }
            }
            return data.filter(row => reachable.has(row.flow_name));
        }
        return data;
    }

    // Search UI
    const searchInput = document.getElementById('nodeSearch');
    const searchResults = document.getElementById('searchResults');
    const ghostHint = document.getElementById('ghostHint');
    let ghostMatches = [], ghostIndex = 0;

    function activateLineage(nodeId, additive) {
        if (additive) { focusNodes.has(nodeId) ? focusNodes.delete(nodeId) : focusNodes.add(nodeId); }
        else { if (focusNodes.size === 1 && focusNodes.has(nodeId)) return; focusNodes.clear(); focusNodes.add(nodeId); }
        renderSearchResults(); updateGraph(false);
    }

    function renderSearchResults() {
        const q = searchTerm.toLowerCase();
        searchResults.innerHTML = '';
        const entries = Array.from(nodeCatalog.values())
            .filter(n => {
                if (q && !n.label.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q)) return false;
                const t = (n.nodeType === 'route' || n.nodeType === 'job') ? n.nodeType : n.service;
                return activeTypes.has(t);
            })
            .sort((a, b) => {
                const as = focusNodes.has(a.id), bs = focusNodes.has(b.id);
                if (as && !bs) return -1; if (!as && bs) return 1;
                const order = ['route', 'job', 'api', 'queue', 'gcs', 'gbq', 'database', 'sftp'];
                const ta = (a.nodeType === 'route' || a.nodeType === 'job') ? a.nodeType : a.service;
                const tb = (b.nodeType === 'route' || b.nodeType === 'job') ? b.nodeType : b.service;
                const d = order.indexOf(ta) - order.indexOf(tb);
                return d !== 0 ? d : a.label.localeCompare(b.label);
            });
        entries.forEach(node => {
            const item = document.createElement('div');
            item.className = `route-item ${focusNodes.has(node.id) ? 'selected' : ''}`;
            const display = node.label.length > 35 ? node.label.substring(0, 32) + '...' : node.label;
            const typeLabel = (node.nodeType === 'route' || node.nodeType === 'job') ? node.nodeType : node.service;
            item.innerHTML = `<span class="result-type type-${node.service}">${escapeHtml(typeLabel)}</span><span class="route-name" title="${escapeHtml(node.id)}">${escapeHtml(display)}</span>`;
            item.onclick = (e) => activateLineage(node.id, e.metaKey || e.ctrlKey);
            searchResults.appendChild(item);
        });
    }

    function getGhostMatches(q) {
        if (!q) return [];
        const ql = q.toLowerCase();
        return Array.from(nodeCatalog.values()).filter(n => {
            const t = (n.nodeType === 'route' || n.nodeType === 'job') ? n.nodeType : n.service;
            return activeTypes.has(t) && !focusNodes.has(n.id) && n.label.toLowerCase().startsWith(ql);
        }).sort((a, b) => a.label.localeCompare(b.label));
    }
    function renderGhostHint(q) {
        if (!ghostMatches.length || !q) { ghostHint.innerHTML = ''; return; }
        const m = ghostMatches[ghostIndex];
        ghostHint.innerHTML = `<span class="ghost-match">${m.label.substring(0, q.length)}</span><span class="ghost-completion">${m.label.substring(q.length)}</span>`;
    }

    searchInput.oninput = (e) => {
        searchTerm = e.target.value;
        ghostMatches = getGhostMatches(searchTerm); ghostIndex = 0;
        renderGhostHint(searchTerm); renderSearchResults();
    };
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && ghostMatches.length) { e.preventDefault(); searchInput.value = ghostMatches[ghostIndex].label; searchTerm = searchInput.value; ghostMatches = getGhostMatches(searchTerm); ghostIndex = 0; renderGhostHint(searchTerm); renderSearchResults(); }
        else if (e.key === 'Enter' && ghostMatches.length) { e.preventDefault(); focusNodes.add(ghostMatches[ghostIndex].id); updateGraph(true); searchInput.value = ''; searchTerm = ''; ghostHint.innerHTML = ''; ghostMatches = []; renderSearchResults(); }
        else if (e.key === 'ArrowDown' && ghostMatches.length) { e.preventDefault(); ghostIndex = (ghostIndex + 1) % ghostMatches.length; renderGhostHint(searchTerm); }
        else if (e.key === 'ArrowUp' && ghostMatches.length) { e.preventDefault(); ghostIndex = (ghostIndex - 1 + ghostMatches.length) % ghostMatches.length; renderGhostHint(searchTerm); }
        else if (e.key === 'Escape') { ghostHint.innerHTML = ''; ghostMatches = []; }
    });

    // Type filter pills
    document.querySelectorAll('#typeFilterBar .type-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const t = pill.dataset.type;
            if (activeTypes.has(t)) { activeTypes.delete(t); pill.classList.add('inactive'); }
            else { activeTypes.add(t); pill.classList.remove('inactive'); }
            renderSearchResults();
        });
    });

    // Instructions legend
    const modKey = /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';
    document.getElementById('instrLegend').innerHTML =
        `<kbd>Click</kbd> Select & trace lineage<br><kbd>${modKey}</kbd>+<kbd>Click</kbd> Add to selection<br><kbd>Scroll</kbd> Zoom · <kbd>Drag</kbd> Pan<br><span style="border-top:1px solid var(--glass-border);display:block;margin:4px 0"></span><kbd>Tab</kbd> Accept suggestion<br><kbd>Enter</kbd> Select & search next<br><kbd>↑</kbd><kbd>↓</kbd> Cycle suggestions`;

    // D3 setup
    const g = svg.append("g");
    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");

    svg.selectAll("defs").remove();
    svg.append("defs").append("marker").attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10").attr("refX", 32).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
        .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#64748b");

    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    // Toolbar buttons
    document.getElementById('fitBtn').onclick = () => {
        width = graphArea.clientWidth; height = graphArea.clientHeight;
        svg.attr('width', width).attr('height', height);
        const nodes = nodeGroup.selectAll('g.node').data();
        if (!nodes.length) return;
        const xs = nodes.map(d => d.x), ys = nodes.map(d => d.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const pad = 80, bw = (x1 - x0) + pad * 2, bh = (y1 - y0) + pad * 2;
        const scale = Math.min(width / bw, height / bh, 2);
        const tx = width / 2 - (x0 + x1) / 2 * scale, ty = height / 2 - (y0 + y1) / 2 * scale;
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };
    document.getElementById('resetViewBtn').onclick = () => {
        focusNodes.clear(); renderSearchResults(); updateGraph(false);
        svg.call(zoom.transform, d3.zoomIdentity);
    };
    document.getElementById('zoomSelectedBtn').onclick = () => {
        if (!focusNodes.size) { document.getElementById('fitBtn').click(); return; }
        width = graphArea.clientWidth; height = graphArea.clientHeight;
        const nodes = nodeGroup.selectAll('g.node').data().filter(d => focusNodes.has(d.id));
        if (!nodes.length) return;
        const xs = nodes.map(d => d.x), ys = nodes.map(d => d.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const pad = 120, bw = Math.max((x1 - x0) + pad * 2, 400), bh = Math.max((y1 - y0) + pad * 2, 400);
        const scale = Math.min(width / bw, height / bh, 2.5);
        const tx = width / 2 - (x0 + x1) / 2 * scale, ty = height / 2 - (y0 + y1) / 2 * scale;
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(280))
        .force("charge", d3.forceManyBody().strength(-1500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(100));

    function getIcon(d) {
        if (d.type === 'route') return 'route';
        if (d.type === 'job') return 'job';
        const svc = (d.service || '').toLowerCase();
        if (svc === 'api') return 'api';
        if (svc === 'queue') return 'queue';
        if (svc === 'gcs') return 'gcs';
        if (svc === 'gbq') return 'gbq';
        if (svc === 'database') return 'database';
        if (svc === 'sftp') return 'sftp';
        return 'unknown';
    }

    function getNodeRank(n) {
        if (focusNodes.size > 0) return topoRanks.get(n.id) || 0;
        if (n.type === 'endpoint') return n.group === 1 ? -1 : 1;
        return 0;
    }

    function updateGraph(isGentle = false) {
        const activeData = getFilteredData();
        const nodesMap = new Map(), linkMap = new Map();
        activeData.forEach((row, i) => {
            const fid = row.flow_name, eid = getResourceId(row);
            const flowType = (row.flow_type || 'route').toLowerCase();
            if (!nodesMap.has(fid)) {
                const cat = catalogByName.get(fid) || {};
                nodesMap.set(fid, { id: fid, group: 3, type: flowType, owner: cat.owner || '', entity: cat.entity || '', project: cat.project || '', description: cat.description || '', source_system: cat.source_system || '', target_system: cat.target_system || '', originalOrder: i });
            }
            const isInput = (row.direction || '').toLowerCase() === 'inbound';
            if (!nodesMap.has(eid)) {
                nodesMap.set(eid, { id: eid, group: isInput ? 1 : 2, system: row.system, service: row.service, component: row.component, protocol: row.protocol, endpoint: row.endpoint, operation: row.operation, direction: row.direction, type: 'endpoint', originalOrder: i });
            }
            const src = isInput ? eid : fid, tgt = isInput ? fid : eid;
            const pk = [src, tgt].sort().join('||');
            const lbl = `${row.protocol || ''} ${row.operation || ''}`.trim();
            if (!linkMap.has(pk)) linkMap.set(pk, { source: src, target: tgt, labels: [lbl] });
            else { const e = linkMap.get(pk); if (!e.labels.includes(lbl)) e.labels.push(lbl); }
        });
        const links = Array.from(linkMap.values()).map(l => ({ ...l, label: l.labels.join(' / ') }));
        const nodes = Array.from(nodesMap.values());

        const prevPos = new Map();
        if (isGentle) (simulation.nodes() || []).forEach(n => { if (n.x != null) prevPos.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }); });

        width = graphArea.clientWidth; height = graphArea.clientHeight;
        const cx = width / 2, cy = height / 2;
        const activeRanks = nodes.map(n => topoRanks.get(n.id) || 0);
        const minR = activeRanks.length ? Math.min(...activeRanks) : 0;
        const maxR = activeRanks.length ? Math.max(...activeRanks) : 0;
        const rankOff = (maxR + minR) / 2;

        const byRank = d3.group(nodes, n => getNodeRank(n));
        for (const [rank, rn] of byRank) {
            const idealX = cx + ((rank - rankOff) * 350);
            rn.sort((a, b) => ((a.system || a.type || '')).localeCompare(b.system || b.type || ''));
            rn.forEach((n, i) => { if (n.x == null) { n.x = idealX; n.y = cy + (i - (rn.length - 1) / 2) * 150; } });
        }
        if (isGentle) nodes.forEach(n => { const p = prevPos.get(n.id); if (p) { n.x = p.x; n.y = p.y; n.vx = p.vx; n.vy = p.vy; } });

        // Links
        let linkSel = linkGroup.selectAll("g.link-group").data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        linkSel.exit().remove();
        const linkEnter = linkSel.enter().append("g").attr("class", "link-group");
        linkEnter.append("line").attr("class", "link").attr("stroke-width", 2).attr("marker-end", "url(#arrowhead)");
        linkEnter.append("text").attr("dy", "-4").attr("text-anchor", "middle").text(d => d.label || "");
        linkSel = linkEnter.merge(linkSel);

        // Nodes
        let nodeSel = nodeGroup.selectAll("g.node").data(nodes, d => d.id);
        nodeSel.exit().remove();
        const nodeEnter = nodeSel.enter().append("g").attr("class", d => `node ${focusNodes.has(d.id) ? 'focus-match' : ''}`)
            .call(d3.drag().on("start", ds).on("drag", dd).on("end", de));
        nodeEnter.each(function (d) {
            const el = d3.select(this);
            const size = (d.type === 'route' || d.type === 'job') ? 44 : 32;
            el.insert('rect', ':first-child').attr('x', -size / 2 - 4).attr('y', -size / 2 - 4).attr('width', size + 8).attr('height', size + 40).attr('fill', 'transparent');
            el.append('image').attr('href', ICON_BASE + getIcon(d) + '.svg').attr('width', size).attr('height', size).attr('x', -size / 2).attr('y', -size / 2);
            const label = d.type === 'route' || d.type === 'job' ? d.id : (d.component || d.id);
            const display = label.length > 30 ? label.substring(0, 27) + '...' : label;
            el.append("text").attr("text-anchor", "middle").append("tspan").attr("x", 0).attr("dy", size / 2 + 14).style("font-weight", "600").text(display);
        });
        nodeSel = nodeEnter.merge(nodeSel);

        // Tooltip
        let currentTT = null;
        nodeSel.on("click", (event, d) => {
            event.stopPropagation();
            if (currentTT === d.id) { dismissTT(); return; }
            nodeGroup.selectAll('g.node').classed('tooltip-source', false);
            d3.select(event.currentTarget).classed('tooltip-source', true);
            currentTT = d.id;
            const cat = catalogByName.get(d.id);
            let html = `<div style="font-weight:700;color:var(--primary-color);margin-bottom:4px">${escapeHtml((d.type || d.service || '').toUpperCase())}</div>`;
            html += `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(d.label || d.component || d.id)}</div>`;
            const fields = [['system', 'System'], ['service', 'Service'], ['protocol', 'Protocol'], ['operation', 'Operation'], ['endpoint', 'Endpoint']];
            fields.forEach(([f, l]) => { if (d[f]) html += `<div><span style="color:var(--text-muted)">${l}:</span> ${escapeHtml(d[f])}</div>`; });
            if (cat) {
                if (cat.description) html += `<div style="margin-top:6px;font-style:italic;color:var(--text-muted)">${escapeHtml(cat.description)}</div>`;
                ['entity', 'project', 'source_system', 'target_system'].forEach(f => { if (cat[f]) html += `<div><span style="color:var(--text-muted)">${f.replace('_', ' ')}:</span> ${escapeHtml(cat[f])}</div>`; });
            }
            const rect = graphArea.getBoundingClientRect();
            let x = event.clientX - rect.left + 15, y = event.clientY - rect.top - 10;
            if (x + 340 > rect.width) x = event.clientX - rect.left - 350;
            if (y < 0) y = 10;
            tooltip.html(html).style("left", x + "px").style("top", y + "px").style("opacity", 1);
        });
        nodeSel.on("dblclick", (event, d) => { event.stopPropagation(); activateLineage(d.id, true); });
        function dismissTT() { tooltip.style("opacity", 0); nodeGroup.selectAll('g.node').classed('tooltip-source', false); currentTT = null; }
        svg.on("click.tooltip", dismissTT);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismissTT(); });

        // Physics
        simulation
            .force("link", d3.forceLink().id(d => d.id).distance(140).strength(0.4))
            .force("charge", d3.forceManyBody().strength(-1100))
            .force("center", null)
            .force("x", d3.forceX(d => cx + ((getNodeRank(d) - rankOff) * 240)).strength(0.6))
            .force("y", d3.forceY(cy).strength(0.05))
            .force("collision", d3.forceCollide().radius(65))
            .alphaDecay(0.015);
        simulation.nodes(nodes).on("tick", () => {
            linkSel.select("line").attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            linkSel.select("text").attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2);
            nodeSel.attr("transform", d => `translate(${d.x},${d.y})`);
        });
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
        if (!isGentle && focusNodes.size > 0) {
            for (let i = 0; i < 300; ++i) simulation.tick();
            document.getElementById('fitBtn').click();
            simulation.on('end.autofit', () => requestAnimationFrame(() => document.getElementById('fitBtn').click()));
        }
    }

    function ds(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dd(event, d) { d.fx = event.x; d.fy = event.y; }
    function de(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

    // Initial render
    renderSearchResults();
    updateGraph(false);
})();
