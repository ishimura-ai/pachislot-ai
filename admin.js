// ============================================================
// PACHISLOT AI - Admin Dashboard JS
// ============================================================

(function () {
  'use strict';

  // ── Constants ──
  const STORAGE_KEY   = 'pachislot_hall_data';
  const PW_KEY        = 'pachislot_admin_pw';
  const DEFAULT_PW    = 'admin2024';
  const PAGE_SIZE     = 20;

  // ── State ──
  const state = {
    records: [],
    filteredRecords: [],
    currentPage: 1,
    sortKey: 'timestamp',
    sortDir: 'desc',
    currentView: 'dashboard',
    deleteTargetId: null,
  };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initSidebar();
    initHeader();
    initFilters();
    initModal();
    initSettings();
    updateDatetime();
    setInterval(updateDatetime, 30000);
  });

  // ─────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────
  function initLogin() {
    const overlay = document.getElementById('login-overlay');
    const app     = document.getElementById('admin-app');
    const btn     = document.getElementById('login-btn');
    const input   = document.getElementById('admin-password');
    const err     = document.getElementById('login-error');

    // Session check
    if (sessionStorage.getItem('admin_auth') === '1') {
      overlay.style.display = 'none';
      app.style.display = 'flex';
      loadData(() => {
        renderDashboard();
        startAutoRefresh();
        updateHeaderStatus();
      });
    }

    const tryLogin = () => {
      const pw = input.value;
      const stored = localStorage.getItem(PW_KEY) || DEFAULT_PW;
      if (pw === stored) {
        sessionStorage.setItem('admin_auth', '1');
        overlay.style.display = 'none';
        app.style.display = 'flex';
        err.style.display = 'none';
        loadData(() => {
          renderDashboard();
          startAutoRefresh();
          updateHeaderStatus();
        });
      } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
      }
    };

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

    document.getElementById('logout-btn').addEventListener('click', () => {
      sessionStorage.removeItem('admin_auth');
      location.reload();
    });
  }

  // ─────────────────────────────────────
  // SIDEBAR / NAVIGATION
  // ─────────────────────────────────────
  function initSidebar() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
        // Close sidebar on mobile
        document.querySelector('.sidebar').classList.remove('open');
      });
    });

    document.getElementById('hamburger-btn').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    });

    // View-all buttons inside dashboard
    document.querySelectorAll('.view-all-btn').forEach(b => {
      b.addEventListener('click', () => switchView(b.dataset.view));
    });
  }

  function switchView(viewId) {
    state.currentView = viewId;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('view-' + viewId)?.classList.add('active');
    document.querySelector(`.nav-btn[data-view="${viewId}"]`)?.classList.add('active');

    const titles = {
      dashboard: 'ダッシュボード',
      records:   '台データ一覧',
      users:     'ユーザー管理',
      halls:     'ホール分析',
      machines:  '機種別集計',
      settings:  '設定',
    };
    document.getElementById('view-title').textContent = titles[viewId] || viewId;

    if (viewId === 'records')   renderRecords();
    if (viewId === 'users')     renderUsers();
    if (viewId === 'halls')     renderHalls();
    if (viewId === 'machines')  renderMachines();
  }

  // ─────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────
  function initHeader() {
    document.getElementById('refresh-btn').addEventListener('click', () => {
      const btn = document.getElementById('refresh-btn');
      btn.style.transform = 'rotate(360deg)';
      btn.style.transition = 'transform 0.6s';
      setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 700);
      loadData(() => {
        renderCurrentView();
        showToast('🔄 データを更新しました', 'ok');
      });
    });

    document.getElementById('export-btn').addEventListener('click', exportCSV);
  }

  function updateHeaderStatus() {
    const cfg = getFirebaseConfig();
    const el = document.getElementById('header-datetime');
    if (!el) return;
    const now = new Date();
    const timeStr = now.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    if (cfg) {
      el.innerHTML = `<span class="status-dot"></span> Firebase接続中 | ${timeStr}`;
    } else {
      el.innerHTML = `<span style="color:var(--accent4);">⚠ ローカルのみ</span> | ${timeStr}`;
    }
  }

  function updateDatetime() {
    const el = document.getElementById('header-datetime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function renderCurrentView() {
    if (state.currentView === 'dashboard') renderDashboard();
    if (state.currentView === 'records')   renderRecords();
    if (state.currentView === 'users')     renderUsers();
    if (state.currentView === 'halls')     renderHalls();
    if (state.currentView === 'machines')  renderMachines();
  }

  // ─────────────────────────────────────
  // DATA LOADING（Local + Firebase統合）
  // ─────────────────────────────────────
  function loadData(callback) {
    const fbConfig = getFirebaseConfig();

    if (fbConfig) {
      // Firebase から全データ取得（管理者のみ読み取り）
      loadFromFirebase(fbConfig).then(firebaseRecords => {
        // LocalStorageのデータとFirebaseデータをマージ（重複排除）
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const localRecords = localRaw ? JSON.parse(localRaw) : [];
        const allIds = new Set();
        const merged = [];
        [...firebaseRecords, ...localRecords].forEach(r => {
          if (!allIds.has(r.id)) {
            allIds.add(r.id);
            merged.push(r);
          }
        });
        merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        state.records = merged;
        state.filteredRecords = [...merged];
        document.getElementById('sidebar-record-count').textContent = merged.length;
        updateFirebaseStatus(true, merged.length);
        if (callback) callback();
        renderCurrentView();
      }).catch(err => {
        console.warn('Firebase読み込みエラー、ローカルデータを使用:', err);
        loadFromLocal();
        updateFirebaseStatus(false);
        if (callback) callback();
      });
    } else {
      loadFromLocal();
      if (callback) callback();
    }
  }

  function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.records = raw ? JSON.parse(raw) : [];
    state.records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    state.filteredRecords = [...state.records];
    document.getElementById('sidebar-record-count').textContent = state.records.length;
  }

  function getFirebaseConfig() {
    // ★ Firebase設定をハードコード（pachislot-ai-data プロジェクト）
    return {
      apiKey:     'AIzaSyBgcsiEZ-Jgm9E4TjOm4X1YHspLUVHy5Bc',
      projectId:  'pachislot-ai-data',
      collection: 'hall_data',
    };
  }

  async function loadFromFirebase(cfg) {
    const collection = cfg.collection || 'hall_data';
    // Firestore REST API: pageSize=500（管理者用・読み取り権限はここで使用）
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${collection}?key=${cfg.apiKey}&pageSize=500`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Firebase fetch failed: ' + res.status);
    const data = await res.json();
    if (!data.documents) return [];

    // Firestoreドキュメントをフラットなオブジェクトに変換
    return data.documents.map(doc => {
      return fromFirestore(doc.fields, doc.name);
    }).filter(Boolean);
  }

  function fromFirestore(fields, docName) {
    if (!fields) return null;
    const out = {};
    // Extract document ID from name
    const nameParts = (docName || '').split('/');
    out._firestoreId = nameParts[nameParts.length - 1];

    for (const [key, val] of Object.entries(fields)) {
      out[key] = extractFirestoreValue(val);
    }
    // Ensure id field
    if (!out.id) out.id = out._firestoreId;
    return out;
  }

  function extractFirestoreValue(val) {
    if (!val) return null;
    if ('stringValue'  in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue'  in val) return Number(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue'    in val) return null;
    if ('arrayValue'   in val) return (val.arrayValue.values || []).map(extractFirestoreValue);
    if ('mapValue'     in val) {
      const obj = {};
      for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
        obj[k] = extractFirestoreValue(v);
      }
      return obj;
    }
    return null;
  }

  function updateFirebaseStatus(connected, count) {
    // Update settings page status indicator
    const infoEl = document.querySelector('.settings-info');
    if (infoEl) {
      infoEl.textContent = connected
        ? `🟢 Firebase Firestore（クラウド・${count}件取得）`
        : '🟠 Firebase設定済み（接続試行中...）';
    }
  }

  // ── 自動更新（30秒ごとにFirebaseから最新データ取得） ──
  function startAutoRefresh() {
    setInterval(() => {
      loadData();
    }, 30000);
  }


  // ─────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────
  function renderDashboard() {
    const records = state.records;

    // KPIs
    const today = new Date().toDateString();
    const todayCount = records.filter(r => new Date(r.timestamp).toDateString() === today).length;
    const halls = new Set(records.map(r => r.hallName).filter(Boolean)).size;
    const machines = new Set(records.map(r => r.machineName).filter(Boolean)).size;
    const highSettingCount = records.filter(r => getTopSetting(r) >= 4).length;
    const highSettingPct = records.length > 0 ? Math.round(highSettingCount / records.length * 100) : 0;

    document.getElementById('kpi-total').textContent = records.length.toLocaleString();
    document.getElementById('kpi-total-sub').textContent = `本日 +${todayCount}件`;
    document.getElementById('kpi-halls').textContent = halls;
    document.getElementById('kpi-halls-sub').textContent = halls > 0 ? 'ホール登録中' : 'まだなし';
    document.getElementById('kpi-machines').textContent = machines;
    document.getElementById('kpi-machines-sub').textContent = machines > 0 ? '種類の機種データ' : '';
    document.getElementById('kpi-high-setting').textContent = highSettingPct + '%';

    // Setting distribution
    renderSettingDist(records);

    // Machine ranking
    renderMachineRanking(records);

    // Recent table (last 10)
    renderRecentTable(records.slice(0, 10));
  }

  function renderSettingDist(records) {
    const container = document.getElementById('setting-dist-chart');
    if (!container) return;

    const counts = [0, 0, 0, 0, 0, 0]; // s1..s6
    records.forEach(r => {
      const top = getTopSetting(r);
      if (top >= 1 && top <= 6) counts[top - 1]++;
    });
    const total = records.length || 1;

    const colors = ['bar-set1', 'bar-set2', 'bar-set3', 'bar-set4', 'bar-set5', 'bar-set6'];
    const labels = ['設定1疑い', '設定2疑い', '設定3疑い', '設定4疑い', '設定5疑い', '設定6疑い'];

    container.innerHTML = '';
    for (let i = 5; i >= 0; i--) {
      const pct = Math.round(counts[i] / total * 100);
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.innerHTML = `
        <div class="setting-label">設定${i + 1}</div>
        <div class="setting-bar-wrap">
          <div class="setting-bar ${colors[i]}" style="width:${pct}%"></div>
        </div>
        <div class="setting-pct">${pct}%</div>
        <div class="setting-count">(${counts[i]})</div>
      `;
      container.appendChild(row);
    }

    if (records.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:20px;">データなし</div>';
    }
  }

  function renderMachineRanking(records) {
    const container = document.getElementById('machine-ranking');
    if (!container) return;

    const counts = {};
    records.forEach(r => {
      if (r.machineName) counts[r.machineName] = (counts[r.machineName] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maxVal = sorted[0]?.[1] || 1;

    container.innerHTML = '';
    if (sorted.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:20px;">データなし</div>';
      return;
    }

    sorted.forEach(([name, count], idx) => {
      const item = document.createElement('div');
      item.className = 'ranking-item';
      const rankClass = idx < 3 ? `r${idx + 1}` : '';
      const pct = Math.round(count / maxVal * 100);
      item.innerHTML = `
        <div class="ranking-num ${rankClass}">${idx + 1}</div>
        <div class="ranking-name">${escapeHtml(name)}</div>
        <div class="ranking-bar-wrap"><div class="ranking-bar" style="width:${pct}%"></div></div>
        <div class="ranking-count">${count}件</div>
      `;
      container.appendChild(item);
    });
  }

  function renderRecentTable(records) {
    const tbody = document.getElementById('recent-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-note">データなし</td></tr>';
      return;
    }

    records.forEach(r => {
      const tr = document.createElement('tr');
      const top = getTopSetting(r);
      tr.innerHTML = `
        <td>${formatDateTime(r.timestamp)}</td>
        <td>${escapeHtml(r.hallName || '—')}</td>
        <td>${escapeHtml(r.machineName || '—')}</td>
        <td>${escapeHtml(String(r.taiNumber || '—'))}</td>
        <td>${r.totalSpins ? Number(r.totalSpins).toLocaleString() : '—'}</td>
        <td><span class="setting-badge s${top}">${top ? '設定' + top + '疑い' : '—'}</span></td>
        <td style="color:${r.diffCoins > 0 ? '#34d399' : '#f87171'}">${r.diffCoins != null ? (r.diffCoins > 0 ? '+' : '') + Number(r.diffCoins).toLocaleString() + '枚' : '—'}</td>
        <td>${escapeHtml(r.senderLabel || '匿名')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ─────────────────────────────────────
  // RECORDS VIEW
  // ─────────────────────────────────────
  function initFilters() {
    const search  = document.getElementById('filter-search');
    const machine = document.getElementById('filter-machine');
    const setting = document.getElementById('filter-setting');
    const date    = document.getElementById('filter-date');
    const clear   = document.getElementById('filter-clear');

    [search, machine, setting, date].forEach(el => {
      if (el) el.addEventListener('input', applyFilters);
    });
    clear?.addEventListener('click', () => {
      if (search)  search.value = '';
      if (machine) machine.value = '';
      if (setting) setting.value = '';
      if (date)    date.value = '';
      applyFilters();
    });

    // Sort headers
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = 'desc';
        }
        applyFilters();
      });
    });
  }

  function applyFilters() {
    const search  = document.getElementById('filter-search')?.value.toLowerCase() || '';
    const machine = document.getElementById('filter-machine')?.value || '';
    const setting = document.getElementById('filter-setting')?.value || '';
    const date    = document.getElementById('filter-date')?.value || '';

    let records = [...state.records];

    if (search) {
      records = records.filter(r =>
        (r.hallName || '').toLowerCase().includes(search) ||
        (r.machineName || '').toLowerCase().includes(search) ||
        (r.prefecture || '').includes(search)
      );
    }
    if (machine) {
      records = records.filter(r => r.machineName === machine);
    }
    if (setting) {
      records = records.filter(r => getTopSetting(r) === Number(setting));
    }
    if (date) {
      records = records.filter(r => r.timestamp?.startsWith(date));
    }

    // Sort
    records.sort((a, b) => {
      let va = a[state.sortKey], vb = b[state.sortKey];
      if (state.sortKey === 'timestamp') { va = new Date(va); vb = new Date(vb); }
      else { va = Number(va) || 0; vb = Number(vb) || 0; }
      return state.sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    state.filteredRecords = records;
    state.currentPage = 1;
    renderRecords();
  }

  function renderRecords() {
    // Populate machine filter
    const machineSelect = document.getElementById('filter-machine');
    if (machineSelect && machineSelect.options.length <= 1) {
      const names = [...new Set(state.records.map(r => r.machineName).filter(Boolean))].sort();
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        machineSelect.appendChild(opt);
      });
    }

    const records = state.filteredRecords;
    document.getElementById('records-count').textContent = records.length;

    // Paginate
    const totalPages = Math.ceil(records.length / PAGE_SIZE);
    const start = (state.currentPage - 1) * PAGE_SIZE;
    const paged = records.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('records-table-body');
    tbody.innerHTML = '';

    if (paged.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty-note">データなし</td></tr>';
    } else {
      paged.forEach(r => {
        const top = getTopSetting(r);
        const prob6 = r.settingProbs ? Math.round(r.settingProbs[5] * 100) : null;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDateTime(r.timestamp)}</td>
          <td><strong>${escapeHtml(r.hallName || '—')}</strong></td>
          <td>${escapeHtml(r.prefecture || '—')}</td>
          <td>${escapeHtml(r.machineName || '—')}</td>
          <td>${escapeHtml(String(r.taiNumber || '—'))}</td>
          <td>${r.totalSpins ? Number(r.totalSpins).toLocaleString() : '—'}</td>
          <td><span class="setting-badge s${top}">${top ? '設定' + top + '疑い' : '—'}</span></td>
          <td>${prob6 !== null ? prob6 + '%' : '—'}</td>
          <td style="color:${r.diffCoins > 0 ? '#34d399' : r.diffCoins < 0 ? '#f87171' : ''}">${r.diffCoins != null ? (r.diffCoins > 0 ? '+' : '') + Number(r.diffCoins).toLocaleString() : '—'}</td>
          <td>${r.settingConfirm ? `<span class="confirm-badge">${escapeHtml(r.settingConfirm)}</span>` : '—'}</td>
          <td>${escapeHtml(r.senderLabel || '匿名')}</td>
          <td><button class="action-btn" data-id="${r.id}">詳細</button></td>
        `;
        tr.querySelector('.action-btn').addEventListener('click', () => openModal(r));
        tbody.appendChild(tr);
      });
    }

    // Pagination
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const makeBtn = (label, page, isActive) => {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (isActive ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        state.currentPage = page;
        renderRecords();
        document.getElementById('view-records').scrollTop = 0;
      });
      container.appendChild(btn);
    };

    if (state.currentPage > 1) makeBtn('‹', state.currentPage - 1, false);
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.currentPage) <= 2) {
        makeBtn(i, i, i === state.currentPage);
      } else if (Math.abs(i - state.currentPage) === 3) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'padding:7px 8px;color:var(--text-muted);font-size:0.82rem;';
        container.appendChild(dots);
      }
    }
    if (state.currentPage < totalPages) makeBtn('›', state.currentPage + 1, false);
  }

  // ─────────────────────────────────────
  // HALLS VIEW
  // ─────────────────────────────────────
  function renderHalls() {
    const container = document.getElementById('halls-grid');
    if (!container) return;

    // Group by hall
    const hallMap = {};
    state.records.forEach(r => {
      const key = r.hallName || '不明';
      if (!hallMap[key]) {
        hallMap[key] = {
          name: key,
          prefecture: r.prefecture || '不明',
          records: [],
        };
      }
      hallMap[key].records.push(r);
    });

    const halls = Object.values(hallMap).sort((a, b) => b.records.length - a.records.length);

    container.innerHTML = '';
    if (halls.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px;">データなし</div>';
      return;
    }

    halls.forEach(hall => {
      const records = hall.records;
      const highCount = records.filter(r => getTopSetting(r) >= 4).length;
      const avgSpins = records.length > 0
        ? Math.round(records.reduce((s, r) => s + (r.totalSpins || 0), 0) / records.length)
        : 0;
      const lastDate = records[0]?.timestamp ? formatDate(records[0].timestamp) : '—';
      const machines = new Set(records.map(r => r.machineName).filter(Boolean)).size;
      const highPct = records.length > 0 ? Math.round(highCount / records.length * 100) : 0;

      const card = document.createElement('div');
      card.className = 'hall-card';
      card.innerHTML = `
        <div class="hall-card-header">
          <div>
            <div class="hall-name">🏢 ${escapeHtml(hall.name)}</div>
            <div class="hall-pref">${escapeHtml(hall.prefecture)}</div>
          </div>
          <div class="hall-count">${records.length}件</div>
        </div>
        <div class="hall-stats">
          <div class="hall-stat">
            <div class="hall-stat-label">高設定疑い率</div>
            <div class="hall-stat-value" style="color:${highPct >= 30 ? '#a78bfa' : 'var(--text)'}">${highPct}%</div>
          </div>
          <div class="hall-stat">
            <div class="hall-stat-label">平均回転数</div>
            <div class="hall-stat-value">${avgSpins.toLocaleString()}G</div>
          </div>
          <div class="hall-stat">
            <div class="hall-stat-label">機種数</div>
            <div class="hall-stat-value">${machines}種</div>
          </div>
          <div class="hall-stat">
            <div class="hall-stat-label">最終データ</div>
            <div class="hall-stat-value" style="font-size:0.82rem;">${lastDate}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ─────────────────────────────────────
  // MACHINES VIEW
  // ─────────────────────────────────────
  function renderMachines() {
    const container = document.getElementById('machines-grid');
    if (!container) return;

    const machineMap = {};
    state.records.forEach(r => {
      const key = r.machineName || '不明';
      if (!machineMap[key]) {
        machineMap[key] = { name: key, records: [] };
      }
      machineMap[key].records.push(r);
    });

    const machines = Object.values(machineMap).sort((a, b) => b.records.length - a.records.length);

    container.innerHTML = '';
    if (machines.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px;">データなし</div>';
      return;
    }

    machines.forEach(m => {
      const records = m.records;
      const avgTopSetting = records.length > 0
        ? (records.reduce((s, r) => s + getTopSetting(r), 0) / records.length).toFixed(1)
        : '—';
      const set6pct = records.length > 0
        ? Math.round(records.filter(r => getTopSetting(r) === 6).length / records.length * 100)
        : 0;
      const totalSpinsAvg = records.length > 0
        ? Math.round(records.reduce((s, r) => s + (r.totalSpins || 0), 0) / records.length)
        : 0;

      const card = document.createElement('div');
      card.className = 'machine-card';
      card.innerHTML = `
        <div class="machine-card-header">
          <div class="machine-icon">🎰</div>
          <div>
            <div class="machine-name">${escapeHtml(m.name)}</div>
            <div class="machine-type">データ数: ${records.length}件</div>
          </div>
        </div>
        <div class="machine-stats">
          <div class="machine-stat">
            <div class="machine-stat-val" style="color:#a78bfa">${avgTopSetting}</div>
            <div class="machine-stat-lbl">平均設定疑い</div>
          </div>
          <div class="machine-stat">
            <div class="machine-stat-val" style="color:#a78bfa">${set6pct}%</div>
            <div class="machine-stat-lbl">設定6疑い率</div>
          </div>
          <div class="machine-stat">
            <div class="machine-stat-val">${totalSpinsAvg.toLocaleString()}</div>
            <div class="machine-stat-lbl">平均回転数</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ─────────────────────────────────────
  // USERS VIEW
  // ─────────────────────────────────────
  function buildUserMap() {
    const userMap = {};
    let userIndex = 1; // 登場順に番号を振る

    // タイムスタンプ昇順で処理（最初に登場したユーザーが①）
    const sorted = [...state.records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sorted.forEach(r => {
      const uid = r.userId || '匿名';
      if (!userMap[uid]) {
        userMap[uid] = {
          userId:    uid,
          index:     userIndex++,
          records:   [],
          thumbs:    [],
        };
      }
      userMap[uid].records.push(r);
      if (r.imageThumb && userMap[uid].thumbs.length < 5) {
        userMap[uid].thumbs.push(r.imageThumb);
      }
    });

    return userMap;
  }

  function renderUsers() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    const searchQ = (document.getElementById('user-search')?.value || '').toLowerCase();
    const sortBy  = document.getElementById('user-sort')?.value || 'lastSeen';

    const userMap = buildUserMap();
    let users = Object.values(userMap);

    // 検索フィルタ
    if (searchQ) {
      users = users.filter(u =>
        u.userId.toLowerCase().includes(searchQ) ||
        u.records.some(r => (r.machineName || '').toLowerCase().includes(searchQ))
      );
    }

    // ソート
    if (sortBy === 'count')   users.sort((a, b) => b.records.length - a.records.length);
    if (sortBy === 'lastSeen') users.sort((a, b) => new Date(b.records[b.records.length-1]?.timestamp||0) - new Date(a.records[a.records.length-1]?.timestamp||0));
    if (sortBy === 'id')      users.sort((a, b) => a.index - b.index);

    grid.innerHTML = '';
    if (users.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px;">データなし<br><small style="font-size:0.8rem;margin-top:8px;display:block;">ユーザーが解析を実行するとここに表示されます</small></div>';
      return;
    }

    users.forEach(u => {
      const recs = u.records;
      // 最頻機種
      const machineCounts = {};
      recs.forEach(r => { const m = r.machineName||'不明'; machineCounts[m] = (machineCounts[m]||0)+1; });
      const favMachine = Object.entries(machineCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

      // 最終アクセス
      const lastRec = recs[recs.length - 1];
      const lastDate = lastRec?.timestamp ? formatDate(lastRec.timestamp) : '—';

      // 高設定疑い率
      const highCount = recs.filter(r => getTopSetting(r) >= 4).length;
      const highPct = recs.length > 0 ? Math.round(highCount / recs.length * 100) : 0;

      // 番号アバター（表示用①②…）
      const numEmojis = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
      const avatarLabel = u.index <= 10 ? numEmojis[u.index - 1] : `${u.index}`;

      // サムネイル
      const thumbsHtml = u.thumbs.length > 0
        ? u.thumbs.slice(0, 4).map(t => `<img class="user-thumb" src="${t}" alt="解析画像">`).join('')
        : '<span style="font-size:0.72rem;color:var(--text-muted);">画像なし</span>';

      const card = document.createElement('div');
      card.className = 'user-card';
      card.innerHTML = `
        <div class="user-card-header">
          <div class="user-avatar">${avatarLabel}</div>
          <div>
            <div class="user-id">${escapeHtml(u.userId)}</div>
            <div class="user-last-seen">最終: ${lastDate}</div>
          </div>
        </div>
        <div class="user-stats">
          <div class="user-stat">
            <div class="user-stat-val">${recs.length}</div>
            <div class="user-stat-lbl">解析数</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val">${Object.keys(machineCounts).length}</div>
            <div class="user-stat-lbl">機種数</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val">${highPct}%</div>
            <div class="user-stat-lbl">高設定率</div>
          </div>
        </div>
        <div class="user-fav-machine">🎰 よく打つ機種: <strong>${escapeHtml(favMachine)}</strong></div>
        <div class="user-thumb-strip">${thumbsHtml}</div>
      `;
      card.addEventListener('click', () => renderUserDetail(u));
      grid.appendChild(card);
    });

    // 検索・ソートイベント
    const searchEl = document.getElementById('user-search');
    const sortEl   = document.getElementById('user-sort');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => renderUsers());
      sortEl?.addEventListener('change', () => renderUsers());
    }
  }

  function renderUserDetail(user) {
    const panel = document.getElementById('user-detail-panel');
    const title = document.getElementById('user-detail-title');
    const body  = document.getElementById('user-detail-body');
    if (!panel || !title || !body) return;

    const numEmojis = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
    const avatar = user.index <= 10 ? numEmojis[user.index - 1] : `No.${user.index}`;
    title.textContent = `${avatar} ${user.userId}`;

    // 機種別集計
    const machineCounts = {};
    user.records.forEach(r => { const m = r.machineName||'不明'; machineCounts[m] = (machineCounts[m]||0)+1; });
    const machineRanking = Object.entries(machineCounts).sort((a,b)=>b[1]-a[1]);

    let html = `
      <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">よく打つ機種ランキング</div>
        ${machineRanking.slice(0,5).map(([m,n],i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="font-size:0.85rem;">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]||''} ${escapeHtml(m)}</span>
            <span style="font-size:0.82rem;color:#a78bfa;font-weight:700;">${n}回</span>
          </div>`).join('')}
      </div>

      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;font-weight:700;">📋 解析履歴（新しい順）</div>
    `;

    // 解析履歴（新しい順）
    const sortedRecs = [...user.records].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    sortedRecs.forEach(r => {
      const topSetting = getTopSetting(r);
      const prob6 = Array.isArray(r.settingProbs) ? (r.settingProbs[5] || 0) : 0;
      const diffStr = r.diffCoins != null
        ? `<span style="color:${r.diffCoins >= 0 ? '#34d399' : '#f87171'};">${r.diffCoins >= 0 ? '+' : ''}${Number(r.diffCoins).toLocaleString()}枚</span>`
        : '';

      const thumbHtml = r.imageThumb
        ? `<img class="user-history-thumb" src="${r.imageThumb}" alt="解析画像" onclick="this.style.transform='scale(1.5)';setTimeout(()=>this.style.transform='',600)">`
        : `<div class="user-history-thumb-placeholder">📷</div>`;

      html += `
        <div class="user-history-item">
          ${thumbHtml}
          <div class="user-history-info">
            <div class="user-history-date">${formatDate(r.timestamp)}</div>
            <div class="user-history-machine">${escapeHtml(r.machineName||'不明')}</div>
            <div class="user-history-meta">
              <span>設定<strong>${topSetting}</strong>疑い</span>
              <span>S6: ${Math.round(prob6*100)}%</span>
              ${r.totalSpins ? `<span>${Number(r.totalSpins).toLocaleString()}G</span>` : ''}
              ${diffStr}
              ${r.hallName ? `<span>🏢 ${escapeHtml(r.hallName)}</span>` : ''}
              ${r.settingConfirm ? `<span style="color:#a78bfa;">✨ ${escapeHtml(r.settingConfirm)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    body.innerHTML = html;
    panel.style.display = 'flex';

    // 閉じるボタン
    const closeBtn = document.getElementById('user-detail-close');
    closeBtn.onclick = () => { panel.style.display = 'none'; };
  }


  // ─────────────────────────────────────
  function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('detail-modal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('modal-delete-btn').addEventListener('click', () => {
      if (state.deleteTargetId) {
        deleteRecord(state.deleteTargetId);
        closeModal();
      }
    });
  }

  function openModal(record) {
    state.deleteTargetId = record.id;
    const body = document.getElementById('modal-body');

    const probs = record.settingProbs || [];
    const probRows = probs.map((p, i) =>
      `<div class="setting-row" style="margin-bottom:6px;">
        <div class="setting-label">設定${i + 1}</div>
        <div class="setting-bar-wrap">
          <div class="setting-bar bar-set${i + 1}" style="width:${Math.round(p * 100)}%"></div>
        </div>
        <div class="setting-pct">${Math.round(p * 100)}%</div>
      </div>`
    ).join('');

    const inputs = record.inputs || {};
    const inputRows = Object.entries(inputs)
      .filter(([k, v]) => v && !['settingConfirm', 'settingConfirmOverride'].includes(k))
      .map(([k, v]) => `<div class="detail-item"><div class="detail-label">${k}</div><div class="detail-value">${v}</div></div>`)
      .join('');

    body.innerHTML = `
      <div class="detail-section">📍 ホール情報</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">ホール名</div><div class="detail-value">${escapeHtml(record.hallName || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">都道府県</div><div class="detail-value">${escapeHtml(record.prefecture || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">台番号</div><div class="detail-value">${escapeHtml(String(record.taiNumber || '—'))}</div></div>
        <div class="detail-item"><div class="detail-label">日時</div><div class="detail-value">${formatDateTime(record.timestamp)}</div></div>
      </div>

      <div class="detail-section">🎰 台データ</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">機種名</div><div class="detail-value">${escapeHtml(record.machineName || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">総回転数</div><div class="detail-value">${record.totalSpins ? Number(record.totalSpins).toLocaleString() + 'G' : '—'}</div></div>
        <div class="detail-item"><div class="detail-label">差枚</div><div class="detail-value" style="color:${record.diffCoins > 0 ? '#34d399' : '#f87171'}">${record.diffCoins != null ? (record.diffCoins > 0 ? '+' : '') + Number(record.diffCoins).toLocaleString() + '枚' : '—'}</div></div>
        <div class="detail-item"><div class="detail-label">設定確定演出</div><div class="detail-value">${record.settingConfirm ? `<span class="confirm-badge">${escapeHtml(record.settingConfirm)}</span>` : 'なし'}</div></div>
      </div>

      <div class="detail-section">🤖 AI推定設定確率</div>
      ${probs.length > 0 ? `<div class="setting-dist" style="margin-bottom:16px;">${probRows}</div>` : '<p style="color:var(--text-muted);font-size:0.82rem;">データなし</p>'}

      ${inputRows ? `<div class="detail-section">📊 入力データ詳細</div><div class="detail-grid">${inputRows}</div>` : ''}

      <div class="detail-section">📱 送信情報</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">送信者ラベル</div><div class="detail-value">${escapeHtml(record.senderLabel || '匿名')}</div></div>
        <div class="detail-item"><div class="detail-label">レコードID</div><div class="detail-value" style="font-size:0.72rem;font-family:monospace;">${record.id || '—'}</div></div>
      </div>
    `;

    document.getElementById('detail-modal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
    state.deleteTargetId = null;
  }

  // ─────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────
  function deleteRecord(id) {
    state.records = state.records.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
    loadData();
    renderCurrentView();
    showToast('🗑️ データを削除しました');
  }

  // ─────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────
  function initSettings() {
    // Change password
    document.getElementById('change-pw-btn')?.addEventListener('click', () => {
      const curr = document.getElementById('current-pw').value;
      const next = document.getElementById('new-pw').value;
      const conf = document.getElementById('new-pw-confirm').value;
      const stored = localStorage.getItem(PW_KEY) || DEFAULT_PW;
      const msg = document.getElementById('pw-change-msg');

      if (curr !== stored) {
        showMsg(msg, '現在のパスワードが違います', 'err');
      } else if (next.length < 8) {
        showMsg(msg, 'パスワードは8文字以上にしてください', 'err');
      } else if (next !== conf) {
        showMsg(msg, 'パスワードが一致しません', 'err');
      } else {
        localStorage.setItem(PW_KEY, next);
        showMsg(msg, 'パスワードを変更しました ✓', 'ok');
        document.getElementById('current-pw').value = '';
        document.getElementById('new-pw').value = '';
        document.getElementById('new-pw-confirm').value = '';
      }
    });

    // Insert test data
    document.getElementById('insert-test-btn')?.addEventListener('click', () => {
      insertTestData();
      loadData();
      renderDashboard();
      showToast('🧪 テストデータを5件追加しました', 'ok');
    });

    // Clear data
    document.getElementById('clear-data-btn')?.addEventListener('click', () => {
      if (confirm('全データを削除しますか？')) {
        localStorage.removeItem(STORAGE_KEY);
        loadData();
        renderCurrentView();
        showToast('🗑️ 全データを削除しました');
      }
    });

    // Save Firebase config
    document.getElementById('save-firebase-btn')?.addEventListener('click', () => {
      const msg = document.getElementById('firebase-msg');
      const apiKey = document.getElementById('fb-api-key').value.trim();
      const projectId = document.getElementById('fb-project-id').value.trim();
      const collection = document.getElementById('fb-collection').value.trim() || 'hall_data';
      if (!apiKey || !projectId) {
        showMsg(msg, 'API KeyとProject IDは必須です', 'err');
        return;
      }
      localStorage.setItem('pachislot_firebase_config', JSON.stringify({ apiKey, projectId, collection }));
      showMsg(msg, '設定を保存しました。ページをリロードするとFirebaseが有効になります ✓', 'ok');
    });

    // Load saved Firebase config
    const fbConfig = localStorage.getItem('pachislot_firebase_config');
    if (fbConfig) {
      try {
        const c = JSON.parse(fbConfig);
        if (document.getElementById('fb-api-key')) document.getElementById('fb-api-key').value = c.apiKey || '';
        if (document.getElementById('fb-project-id')) document.getElementById('fb-project-id').value = c.projectId || '';
        if (document.getElementById('fb-collection')) document.getElementById('fb-collection').value = c.collection || 'hall_data';
      } catch (_) {}
    }
  }

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'settings-msg ' + type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
  }

  // ─────────────────────────────────────
  // TEST DATA
  // ─────────────────────────────────────
  function insertTestData() {
    const halls = ['メガガイア新宿店', 'P-WORLD渋谷', '楽園上野', 'マルハン横浜', 'アピナ仙台'];
    const prefs = ['東京都', '東京都', '東京都', '神奈川県', '宮城県'];
    const machines = ['バジョリラ！2', 'からくりサーカス', 'カバネリ開門決戦', '北斗の拳 修羅の国篇', '番長ZERO'];
    const confirms = [null, null, '設定6確定', null, '設定4以上'];

    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    for (let i = 0; i < 5; i++) {
      const probs = generateRandomProbs();
      existing.push({
        id: generateId(),
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        hallName: halls[i],
        prefecture: prefs[i],
        taiNumber: Math.floor(Math.random() * 200) + 1,
        machineName: machines[i],
        totalSpins: Math.floor(Math.random() * 5000) + 500,
        diffCoins: Math.floor(Math.random() * 3000) - 1000,
        settingConfirm: confirms[i],
        settingProbs: probs,
        inputs: {
          bell: Math.floor(Math.random() * 400) + 100,
          atFirstHit: Math.floor(Math.random() * 20) + 1,
        },
        senderLabel: '匿名',
      });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }

  function generateRandomProbs() {
    const raw = [Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random()];
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(v => v / total);
  }

  // ─────────────────────────────────────
  // CSV EXPORT
  // ─────────────────────────────────────
  function exportCSV() {
    if (state.records.length === 0) {
      showToast('エクスポートするデータがありません', 'err');
      return;
    }

    const headers = ['日時', 'ホール名', '都道府県', '台番号', '機種名', '総回転数', '推定設定', '設定6確率(%)', '差枚', '設定確定演出', '送信者'];
    const rows = state.records.map(r => {
      const top = getTopSetting(r);
      const prob6 = r.settingProbs ? Math.round(r.settingProbs[5] * 100) : '';
      return [
        r.timestamp || '',
        r.hallName || '',
        r.prefecture || '',
        r.taiNumber || '',
        r.machineName || '',
        r.totalSpins || '',
        top ? `設定${top}疑い` : '',
        prob6,
        r.diffCoins != null ? r.diffCoins : '',
        r.settingConfirm || '',
        r.senderLabel || '匿名',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pachislot_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 CSVをエクスポートしました', 'ok');
  }

  // ─────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────
  function getTopSetting(record) {
    if (!record.settingProbs || record.settingProbs.length !== 6) return 0;
    let maxIdx = 0;
    record.settingProbs.forEach((p, i) => { if (p > record.settingProbs[maxIdx]) maxIdx = i; });
    return maxIdx + 1;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function showToast(msg, type = '') {
    const el = document.getElementById('admin-toast');
    el.textContent = msg;
    el.className = 'admin-toast show ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

})();
