// =====================================================
// パチスロ設定推測AI - メインアプリケーション（特化版）
// =====================================================

(function () {
    'use strict';

    // ── State ──
    const state = {
        selectedMachine: null,
        machineData: null,
        inputs: {},
        investmentMode: 'yen', // 'yen' or 'coins'
        probabilityMode: {}, // key -> 'count' or 'prob'
        hallCondition: {
            specialDay: false,
            lineup: false,
            allDevices: false
        },
        results: null
    };

    // ── DOM Ready ──
    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initMachineSelect();
        initScreenshot();
        initMySlotBulk();
        initMySlotConfirmPanel();
        initHallCondition();
        initCustomMachine();
        initInvestmentToggle();
        showScreen('home');
    });

    // ── Navigation ──
    function initNavigation() {
        // Populate home machine chips
        populateHomeMachineChips();

        // Home machine search
        const homeSearch = document.getElementById('home-machine-search');
        if (homeSearch) {
            homeSearch.addEventListener('input', (e) => {
                populateHomeMachineChips(e.target.value.trim());
            });
        }

        // Hero start button
        const heroBtn = document.getElementById('hero-start-btn');
        if (heroBtn) {
            heroBtn.addEventListener('click', () => {
                if (!state.machineData) {
                    showToast('先に機種を選択してください');
                    const search = document.getElementById('home-machine-search');
                    if (search) search.focus();
                    return;
                }
                showScreen('myslot-bulk');
            });
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.screen;
                showScreen(target);
            });
        });

        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showScreen('home');
            });
        });

        document.querySelectorAll('.menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (!target) return;
                if ((target === 'input' || target === 'myslot-bulk' || target === 'screenshot') && !state.machineData) {
                    showToast('先に機種を選択してください');
                    const search = document.getElementById('home-machine-search');
                    if (search) search.focus();
                    return;
                }
                showScreen(target);
            });
        });
    }

    // ── Home Machine Chips ──
    function populateHomeMachineChips(filter) {
        const container = document.getElementById('home-machine-chips');
        if (!container) return;

        const machines = getMachineList();
        const filtered = filter
            ? machines.filter(name => {
                const m = MACHINE_DATABASE[name];
                const search = filter.toLowerCase();
                return name.toLowerCase().includes(search) ||
                       (m.alias && m.alias.some(a => a.toLowerCase().includes(search)));
            })
            : machines;

        // Show popular first (AT machines), max 20
        const sorted = filtered.sort((a, b) => {
            const ma = MACHINE_DATABASE[a], mb = MACHINE_DATABASE[b];
            if (ma.type === 'AT' && mb.type !== 'AT') return -1;
            if (ma.type !== 'AT' && mb.type === 'AT') return 1;
            return 0;
        }).slice(0, 20);

        container.innerHTML = '';
        sorted.forEach(name => {
            const m = MACHINE_DATABASE[name];
            // buttonを使う（iOSでclickが確実に発火する）
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'machine-chip' + (state.machineData && state.machineData.name === name ? ' selected' : '');
            chip.innerHTML = `${name}<span class="chip-type">${m.type}</span>`;
            // clickとtouchendの両方をバインド（iOS対応）
            const onSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.querySelectorAll('.machine-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                selectMachine(name);
            };
            chip.addEventListener('click', onSelect);
            chip.addEventListener('touchend', onSelect, { passive: false });
            container.appendChild(chip);
        });
    }

    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) {
            screen.classList.add('active');
            screen.scrollIntoView({ top: 0, behavior: 'auto' });
            window.scrollTo(0, 0);
        }
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.toggle('active', n.dataset.screen === id);
        });
    }

    // ── Investment Toggle (円 ↔ 枚) ──
    function initInvestmentToggle() {
        // Will be initialized when input form is built
    }

    // ── Machine Select ──
    function initMachineSelect() {
        refreshMachineChips();
        const searchInput = document.getElementById('machine-search');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            const container = document.getElementById('machine-chips');
            if (!query) {
                container.querySelectorAll('.machine-chip').forEach(c => c.style.display = '');
                return;
            }
            const machine = findMachine(query);
            container.querySelectorAll('.machine-chip').forEach(c => {
                if (machine && c.textContent === machine.name) {
                    c.style.display = '';
                    selectMachine(machine.name);
                } else if (c.textContent.includes(query)) {
                    c.style.display = '';
                } else {
                    c.style.display = 'none';
                }
            });
        });
    }

    function refreshMachineChips() {
        const list = getMachineList();
        const container = document.getElementById('machine-chips');
        container.innerHTML = '';
        list.forEach(name => {
            const chip = document.createElement('div');
            chip.className = 'machine-chip';
            chip.textContent = name;
            chip.addEventListener('click', () => selectMachine(name));
            container.appendChild(chip);
        });
        const countEl = document.getElementById('machine-count');
        if (countEl) countEl.textContent = list.length + '機種';
    }

    function selectMachine(name) {
        const machine = findMachine(name);
        if (!machine) return;

        state.selectedMachine = name;
        state.machineData = machine;
        state.inputs = { totalSpins: 0, currentGame: 0 };

        // Update chips
        document.querySelectorAll('.machine-chip').forEach(c => {
            c.classList.toggle('selected', c.textContent === machine.name);
        });

        // Update info panel
        const panel = document.getElementById('machine-info-panel');
        panel.classList.add('active');
        panel.innerHTML = `
      <div class="machine-info-row">
        <span class="label">機種名</span>
        <span class="value">${machine.name}</span>
      </div>
      <div class="machine-info-row">
        <span class="label">タイプ</span>
        <span class="value">${machine.type}</span>
      </div>
      <div class="machine-info-row">
        <span class="label">天井</span>
        <span class="value">${machine.ceiling}G</span>
      </div>
      <div class="machine-info-row">
        <span class="label">機械割 (設定1)</span>
        <span class="value">${machine.payoutRate[1]}%</span>
      </div>
      <div class="machine-info-row">
        <span class="label">機械割 (設定6)</span>
        <span class="value">${machine.payoutRate[6]}%</span>
      </div>
      ${(machine.customFields === KARAKURI_FIELDS || machine.customFields === KABANERI_KAIMON_FIELDS) ? '<div class="machine-info-row"><span class="label">対応</span><span class="value" style="color:var(--accent-primary)">★ 特化版</span></div>' : ''}
    `;

        // Update machine name display in input screen
        const machineDisplay = document.getElementById('selected-machine-display');
        if (machineDisplay) {
            machineDisplay.textContent = machine.name;
        }

        // ★ Build dynamic input form based on machine
        buildDynamicInputForm(machine);

        // ★ Update home screen elements
        const badge = document.getElementById('home-selected-badge');
        if (badge) {
            badge.style.display = '';
            badge.textContent = '✓ ' + machine.name;
        }
        const heroBtn = document.getElementById('hero-start-btn');
        if (heroBtn) {
            heroBtn.textContent = `📱 ${machine.name} を写真で判別`;
        }
        const myslotMachineName = document.getElementById('myslot-machine-name');
        if (myslotMachineName) myslotMachineName.textContent = machine.name;

        // Update chip selection state without full re-render
        document.querySelectorAll('#home-machine-chips .machine-chip').forEach(c => {
            c.classList.toggle('selected', c.textContent.startsWith(machine.name));
        });

        showToast(`${machine.name} を選択しました`);
    }

    // ═══════════════════════════════════════════════════
    // ★ 動的入力フォーム生成
    // ═══════════════════════════════════════════════════
    function buildDynamicInputForm(machine) {
        const container = document.getElementById('dynamic-fields-container');
        if (!container) return;
        container.innerHTML = '';

        const fields = machine.customFields || GENERIC_AT_FIELDS;

        fields.forEach(group => {
            const card = document.createElement('div');
            card.className = 'card';

            let html = `<div class="card-title"><span class="icon">${group.icon}</span>${group.group}</div>`;

            // 2列レイアウト
            const fieldPairs = [];
            let currentPair = [];
            group.fields.forEach(field => {
                currentPair.push(field);
                if (currentPair.length === 2) {
                    fieldPairs.push(currentPair);
                    currentPair = [];
                }
            });
            if (currentPair.length > 0) fieldPairs.push(currentPair);

            fieldPairs.forEach(pair => {
                if (pair.length === 2) {
                    html += '<div class="form-row">';
                }
                pair.forEach(field => {
                    if (field.type === 'probability') {
                        html += buildProbabilityField(field);
                    } else if (field.type === 'number') {
                        html += buildNumberField(field);
                    }
                });
                if (pair.length === 2) {
                    html += '</div>';
                }
            });

            card.innerHTML = html;
            container.appendChild(card);

            // Add help tooltips
            card.querySelectorAll('.field-help-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const helpText = btn.dataset.help;
                    showToast(helpText);
                });
            });
        });

        // Initialize probability toggles
        container.querySelectorAll('.prob-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const currentMode = state.probabilityMode[key] || 'count';
                const newMode = currentMode === 'count' ? 'prob' : 'count';
                state.probabilityMode[key] = newMode;

                // update button text
                btn.textContent = newMode === 'count' ? '回数' : '確率';
                btn.classList.toggle('prob-mode', newMode === 'prob');

                // update input placeholder
                const input = container.querySelector(`[data-dkey="${key}"]`);
                if (input) {
                    input.placeholder = newMode === 'count' ? '0' : '1/0.0';
                    input.value = '';
                }
            });
        });

        // Initialize dynamic form change listeners
        container.querySelectorAll('.form-input[data-dkey]').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.dkey;
                if (key) {
                    state.inputs[key] = parseFloat(input.value) || 0;
                }
            });
        });

        // Attach analyze button
        const analyzeBtn = document.getElementById('btn-analyze');
        if (analyzeBtn) {
            // Remove old listeners by cloning
            const newBtn = analyzeBtn.cloneNode(true);
            analyzeBtn.parentNode.replaceChild(newBtn, analyzeBtn);
            newBtn.addEventListener('click', () => {
                if (!state.machineData) {
                    showToast('先に機種を選択してください');
                    showScreen('home');
                    return;
                }
                collectAllInputs();
                const results = runAnalysis();
                state.results = results;
                renderResults(results);
                showScreen('results');
            });
        }
    }

    function buildNumberField(field) {
        const helpBtn = field.help ? `<button class="field-help-btn" data-help="${escapeHtml(field.help)}">?</button>` : '';
        return `
        <div class="form-group">
            <label class="form-label">${field.label} ${helpBtn}</label>
            <input type="number" class="form-input" data-dkey="${field.key}" placeholder="${field.placeholder}" inputmode="numeric">
        </div>`;
    }

    function buildProbabilityField(field) {
        const helpBtn = field.help ? `<button class="field-help-btn" data-help="${escapeHtml(field.help)}">?</button>` : '';
        state.probabilityMode[field.key] = 'count';
        return `
        <div class="form-group">
            <label class="form-label">
                ${field.label} ${helpBtn}
                <button class="prob-toggle-btn" data-key="${field.key}">回数</button>
            </label>
            <input type="number" class="form-input" data-dkey="${field.key}" placeholder="0" inputmode="decimal" step="any">
        </div>`;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function collectAllInputs() {
        // Base fields
        const totalSpinsEl = document.getElementById('input-total-spins');
        const currentGameEl = document.getElementById('input-current-game');
        state.inputs.totalSpins = parseFloat(totalSpinsEl?.value) || 0;
        state.inputs.currentGame = parseFloat(currentGameEl?.value) || 0;

        // Investment
        const investEl = document.getElementById('input-investment');
        const revenueEl = document.getElementById('input-revenue');
        const diffCoinsEl = document.getElementById('input-diff-coins');

        if (investEl) {
            const rawInvest = parseFloat(investEl.value) || 0;
            if (state.investmentMode === 'coins') {
                state.inputs.investmentCoins = rawInvest;
                state.inputs.investment = rawInvest * 20;
            } else {
                state.inputs.investment = rawInvest;
                state.inputs.investmentCoins = rawInvest / 20;
            }
        }
        if (revenueEl) {
            const rawRevenue = parseFloat(revenueEl.value) || 0;
            if (state.investmentMode === 'coins') {
                state.inputs.revenueCoins = rawRevenue;
                state.inputs.revenue = rawRevenue * 20;
            } else {
                state.inputs.revenue = rawRevenue;
                state.inputs.revenueCoins = rawRevenue / 20;
            }
        }
        if (diffCoinsEl) {
            state.inputs.diffCoins = parseFloat(diffCoinsEl.value) || 0;
        }

        // Dynamic fields
        document.querySelectorAll('.form-input[data-dkey]').forEach(input => {
            const key = input.dataset.dkey;
            if (key) {
                let val = parseFloat(input.value) || 0;
                // If probability mode, convert
                if (state.probabilityMode[key] === 'prob' && val > 0) {
                    // User entered probability like 1/7.5 => convert to count
                    // val is the denominator, count = totalSpins / val
                    if (state.inputs.totalSpins > 0) {
                        val = Math.round(state.inputs.totalSpins / val);
                    }
                }
                state.inputs[key] = val;
            }
        });

        // Hall condition
        document.querySelectorAll('.hall-tag').forEach(tag => {
            const key = tag.dataset.hall;
            if (key) state.hallCondition[key] = tag.classList.contains('active');
        });

        // Setting confirm chips
        const activeConfirm = document.querySelector('.chip[data-confirm].active');
        state.inputs.settingConfirm = activeConfirm ? activeConfirm.dataset.confirm : null;
    }

    // ═══════════════════════════════════════════════════
    // ★ 分析エンジン
    // ═══════════════════════════════════════════════════
    function runAnalysis() {
        const machine = state.machineData;
        const inp = state.inputs;
        const hall = state.hallCondition;

        // 機種特化推定 or 汎用推定
        let settingProbs;
        if (machine.customEstimation === 'karakuriEstimation') {
            settingProbs = karakuriEstimation(machine, inp);
        } else if (machine.customEstimation === 'kabaneriKaimonEstimation') {
            settingProbs = kabaneriKaimonEstimation(machine, inp);
        } else {
            settingProbs = genericBayesianEstimation(machine, inp);
        }

        const confidence = calcConfidence(machine, inp);
        const expectedValue = calcExpectedValue(machine, settingProbs, inp);
        const hourlyWage = calcHourlyWage(expectedValue, inp);
        const quitTiming = calcQuitTiming(machine, settingProbs, inp);
        const highSettingConf = calcHighSettingConfidence(settingProbs, hall);

        return { settingProbs, confidence, expectedValue, hourlyWage, quitTiming, highSettingConf };
    }

    // ═══════════════════════════════════════════════════
    // ★ からくりサーカス専用ベイズ推定
    // ═══════════════════════════════════════════════════
    function karakuriEstimation(machine, inp) {
        let priors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];

        // Setting confirmation
        if (inp.settingConfirm && machine.settingConfirm[inp.settingConfirm]) {
            const allowed = machine.settingConfirm[inp.settingConfirm];
            priors = priors.map((p, i) => allowed.includes(i + 1) ? p : 0);
            const sum = priors.reduce((a, b) => a + b, 0);
            if (sum > 0) priors = priors.map(p => p / sum);
        }

        const totalSpins = inp.totalSpins || 1;
        let likelihoods = [1, 1, 1, 1, 1, 1];

        for (let s = 1; s <= 6; s++) {
            let likelihood = 1;

            // 1. CZ確率（重み: 中）
            if (inp.czCount > 0 && machine.czProb) {
                const expectedProb = machine.czProb[s];
                likelihood *= poissonLikelihood(inp.czCount, expectedProb * totalSpins);
            }

            // 2. AT初当たり確率（重み: 高）
            if (inp.atFirstHitCount > 0 && machine.atFirstHitProb) {
                const expectedProb = machine.atFirstHitProb[s];
                likelihood *= poissonLikelihood(inp.atFirstHitCount, expectedProb * totalSpins);
            }

            // 3. ★ からくりレア役→幕間チャンス当選率（重み: 最高、設定差3倍）
            if (inp.karakuriRareCount > 0 && inp.makuaiFromRare >= 0 && machine.makuaiFromRareRate) {
                const rate = machine.makuaiFromRareRate[s];
                const n = inp.karakuriRareCount;
                const k = inp.makuaiFromRare || 0;
                // Binomial likelihood
                likelihood *= binomialLikelihood(k, n, rate);
            }

            // 4. ★ AT直撃回数（モードC、重み: 高）
            if (inp.atDirectHit > 0 && machine.atDirectHitProb) {
                const expectedProb = machine.atDirectHitProb[s];
                likelihood *= poissonLikelihood(inp.atDirectHit, expectedProb * totalSpins);
            }

            // 5. AT終了画面（設定確定系）
            if (inp.endScreenFrancine > 0) {
                // フランシーヌ = 設定6濃厚
                if (s === 6) likelihood *= Math.pow(50, inp.endScreenFrancine);
                else likelihood *= Math.pow(0.01, inp.endScreenFrancine);
            }
            if (inp.endScreenShiroganeKatsuNarumi > 0) {
                // しろがね・勝・鳴海 = 設定4以上
                if (s >= 4) likelihood *= Math.pow(5, inp.endScreenShiroganeKatsuNarumi);
                else likelihood *= Math.pow(0.05, inp.endScreenShiroganeKatsuNarumi);
            }
            if (inp.endScreenAshibanaGuy > 0) {
                // 阿紫花&ギイ = 設定2以上
                if (s >= 2) likelihood *= Math.pow(3, inp.endScreenAshibanaGuy);
                else likelihood *= Math.pow(0.1, inp.endScreenAshibanaGuy);
            }

            // 6. AT開始ステージ（奇偶示唆）
            if (machine.stageOddRate && (inp.stageNarumi > 0 || inp.stageKatsu > 0)) {
                const totalStages = (inp.stageNarumi || 0) + (inp.stageKatsu || 0);
                if (totalStages > 0) {
                    const oddRate = machine.stageOddRate[s];
                    const evenRate = machine.stageEvenRate[s];
                    if (inp.stageNarumi > 0) {
                        likelihood *= Math.pow(oddRate, inp.stageNarumi);
                    }
                    if (inp.stageKatsu > 0) {
                        likelihood *= Math.pow(evenRate, inp.stageKatsu);
                    }
                }
            }

            // 7. 同一ステージ連続（高設定示唆）
            if (inp.stageSameRepeat > 0 && machine.sameStageRepeatRate) {
                const rate = machine.sameStageRepeatRate[s];
                likelihood *= Math.pow(rate, inp.stageSameRepeat);
            }

            // 8. オリンピア +4 （設定4以上）
            if (inp.olympiaPlus4 > 0) {
                if (s >= 4) likelihood *= Math.pow(10, inp.olympiaPlus4);
                else likelihood *= Math.pow(0.01, inp.olympiaPlus4);
            }

            // 9. オリンピア +6 （設定6濃厚）
            if (inp.olympiaPlus6 > 0) {
                if (s === 6) likelihood *= Math.pow(50, inp.olympiaPlus6);
                else likelihood *= Math.pow(0.01, inp.olympiaPlus6);
            }

            // 10. EDランプ 紫（設定4以上）
            if (inp.endingLampPurple > 0) {
                if (s >= 4) likelihood *= Math.pow(10, inp.endingLampPurple);
                else likelihood *= Math.pow(0.01, inp.endingLampPurple);
            }

            // 11. EDランプ 虹（設定6濃厚）
            if (inp.endingLampRainbow > 0) {
                if (s === 6) likelihood *= Math.pow(50, inp.endingLampRainbow);
                else likelihood *= Math.pow(0.01, inp.endingLampRainbow);
            }

            // 12. EDランプ 緑（高設定示唆、マイルド）
            if (inp.endingLampGreen > 0 && machine.endingLampGreenRate) {
                const rate = machine.endingLampGreenRate[s];
                likelihood *= Math.pow(rate, inp.endingLampGreen);
            }

            likelihoods[s - 1] = likelihood;
        }

        // Posterior
        let posteriors = priors.map((p, i) => p * likelihoods[i]);
        const totalPost = posteriors.reduce((a, b) => a + b, 0);

        if (totalPost > 0) {
            posteriors = posteriors.map(p => p / totalPost);
        } else {
            posteriors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
        }

        return posteriors;
    }

    // ═══════════════════════════════════════════════════
    // ★ 設定確定要素 強制オーバーライド（全推定共通）
    // ═══════════════════════════════════════════════════
    /**
     * 設定確定要素がある場合、ベイズ推定の前に確率を固定する。
     * 統計的推定で揺らいでいた問題の根本解決。
     * 例: 虹トロフィー → 設定6 = 99%に固定
     */
    function applySettingConfirmOverride(inp) {
        // inp.settingConfirmOverride: 'set6' | 'set56' | 'set456' | 'set246' | 'set2plus' | null
        const override = inp.settingConfirmOverride || inp.settingConfirm;
        if (!override) return null;

        // 対応テーブル: 許容設定 → 各設定の重み（合計1になるよう正規化）
        const overrideMap = {
            'set6':    [0, 0, 0, 0, 0, 1],          // 設定6確定
            'set56':   [0, 0, 0, 0, 0.4, 0.6],       // 設定5以上確定
            'set456':  [0, 0, 0, 0.2, 0.35, 0.45],   // 設定4以上確定
            'set246':  [0, 0.2, 0, 0.3, 0, 0.5],     // 設定2・4・6確定
            'set2plus': [0, 0.15, 0.15, 0.2, 0.2, 0.3], // 設定2以上確定
            // settingConfirm文字列からのマッピング
            '設定6確定':  [0, 0, 0, 0, 0, 1],
            '設定5以上':  [0, 0, 0, 0, 0.4, 0.6],
            '設定4以上':  [0, 0, 0, 0.25, 0.35, 0.4],
            '設定2以上':  [0, 0.15, 0.15, 0.2, 0.2, 0.3],
        };

        return overrideMap[override] || null;
    }

    // ═══════════════════════════════════════════════════
    // 汎用ベイズ推定
    // ═══════════════════════════════════════════════════
    function genericBayesianEstimation(machine, inp) {
        // ─── ★ 設定確定オーバーライドチェック（最優先） ───
        const confirmed = applySettingConfirmOverride(inp);
        if (confirmed) {
            // 確定要素あり：ベイズ統計を「補正」として使い
            // 確定要素の重みを圧倒的に大きくして実質的に固定する
            let priors = confirmed.map(w => w + 1e-9);
            const priorSum = priors.reduce((a, b) => a + b, 0);
            priors = priors.map(p => p / priorSum);

            const totalSpins = inp.totalSpins || 1;
            let likelihoods = [1, 1, 1, 1, 1, 1];
            for (let s = 1; s <= 6; s++) {
                let likelihood = 1;
                if (inp.bell > 0 && machine.bellProb)
                    likelihood *= poissonLikelihood(inp.bell, machine.bellProb[s] * totalSpins);
                if (inp.atFirstHit > 0 && machine.atFirstHitProb)
                    likelihood *= poissonLikelihood(inp.atFirstHit, machine.atFirstHitProb[s] * totalSpins);
                likelihoods[s - 1] = likelihood;
            }

            // オーバーライド重みを1000乗して統計を圧倒させる
            let posteriors = priors.map((p, i) => Math.pow(p, 3) * likelihoods[i]);
            const totalPost = posteriors.reduce((a, b) => a + b, 0);
            if (totalPost > 0) posteriors = posteriors.map(p => p / totalPost);
            else posteriors = confirmed;
            return posteriors;
        }

        // ─── 通常のベイズ推定 ───
        let priors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];

        if (inp.settingConfirm && machine.settingConfirm && machine.settingConfirm[inp.settingConfirm]) {
            const allowed = machine.settingConfirm[inp.settingConfirm];
            priors = priors.map((p, i) => allowed.includes(i + 1) ? p : 0);
            const sum = priors.reduce((a, b) => a + b, 0);
            if (sum > 0) priors = priors.map(p => p / sum);
        }

        const totalSpins = inp.totalSpins || 1;
        let likelihoods = [1, 1, 1, 1, 1, 1];

        for (let s = 1; s <= 6; s++) {
            let likelihood = 1;

            if (inp.bell > 0 && machine.bellProb)
                likelihood *= poissonLikelihood(inp.bell, machine.bellProb[s] * totalSpins);
            if (inp.weakCherry > 0 && machine.cherryProb)
                likelihood *= poissonLikelihood(inp.weakCherry, machine.cherryProb[s] * totalSpins);
            if (inp.watermelon > 0 && machine.watermelonProb)
                likelihood *= poissonLikelihood(inp.watermelon, machine.watermelonProb[s] * totalSpins);
            if (inp.chance > 0 && machine.chanceProb)
                likelihood *= poissonLikelihood(inp.chance, machine.chanceProb[s] * totalSpins);
            if (inp.atFirstHit > 0 && machine.atFirstHitProb)
                likelihood *= poissonLikelihood(inp.atFirstHit, machine.atFirstHitProb[s] * totalSpins);
            if (inp.czEntry > 0 && machine.czProb)
                likelihood *= poissonLikelihood(inp.czEntry, machine.czProb[s] * totalSpins);
            if (inp.czEntry > 0 && inp.czSuccess > 0 && machine.czSuccessRate) {
                const expectedRate = machine.czSuccessRate[s];
                likelihood *= Math.pow(expectedRate, inp.czSuccess) * Math.pow(1 - expectedRate, inp.czEntry - inp.czSuccess);
            }

            // ★ 設定示唆演出（機種汎用・インライン）
            if (inp.inlineConfirm6 > 0) {
                // 設定6確定演出（例: 虹トロフィー等）
                if (s === 6) likelihood *= Math.pow(1000, inp.inlineConfirm6);
                else         likelihood *= Math.pow(0.001, inp.inlineConfirm6);
            }
            if (inp.inlineConfirm56 > 0) {
                // 設定5以上確定
                if (s >= 5) likelihood *= Math.pow(50, inp.inlineConfirm56);
                else        likelihood *= Math.pow(0.02, inp.inlineConfirm56);
            }
            if (inp.inlineConfirm456 > 0) {
                // 設定4以上確定
                if (s >= 4) likelihood *= Math.pow(20, inp.inlineConfirm456);
                else        likelihood *= Math.pow(0.05, inp.inlineConfirm456);
            }
            if (inp.inlineConfirm246 > 0) {
                // 設定2・4・6（偶数確定）
                if ([2, 4, 6].includes(s)) likelihood *= Math.pow(15, inp.inlineConfirm246);
                else                       likelihood *= Math.pow(0.067, inp.inlineConfirm246);
            }
            if (inp.inlineHighSuggest > 0) {
                // 高設定示唆（強め）
                if (s >= 4) likelihood *= Math.pow(5, inp.inlineHighSuggest);
                else        likelihood *= Math.pow(0.3, inp.inlineHighSuggest);
            }

            likelihoods[s - 1] = likelihood;
        }

        let posteriors = priors.map((p, i) => p * likelihoods[i]);
        const totalPost = posteriors.reduce((a, b) => a + b, 0);

        if (totalPost > 0) {
            posteriors = posteriors.map(p => p / totalPost);
        } else {
            posteriors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
        }

        return posteriors;
    }

    // ── 二項分布の尤度 ──
    function binomialLikelihood(k, n, p) {
        if (p <= 0) return k === 0 ? 1 : 0;
        if (p >= 1) return k === n ? 1 : 0;
        if (n <= 0) return 1;
        if (k > n) k = n;
        // log binomial
        const logL = logCombination(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
        return Math.exp(logL);
    }

    function logCombination(n, k) {
        if (k > n) return -Infinity;
        if (k === 0 || k === n) return 0;
        let result = 0;
        for (let i = 0; i < k; i++) {
            result += Math.log(n - i) - Math.log(i + 1);
        }
        return result;
    }

    function poissonLikelihood(observed, expected) {
        if (expected <= 0) return 1;
        const logL = observed * Math.log(expected) - expected - logFactorial(observed);
        return Math.exp(logL);
    }

    function logFactorial(n) {
        if (n <= 1) return 0;
        let result = 0;
        for (let i = 2; i <= n; i++) {
            result += Math.log(i);
        }
        return result;
    }

    // ── Confidence ──
    function calcConfidence(machine, inp) {
        const totalSpins = inp.totalSpins || 1;
        const result = {};

        // Sample size base factor
        const sampleFactor = Math.min(1, totalSpins / 3000) * 60;

        if (machine.customEstimation === 'karakuriEstimation') {
            // からくり専用
            result.czAt = 0;
            let count = 0;
            if (inp.czCount > 0) { result.czAt += sampleFactor + 20; count++; }
            if (inp.atFirstHitCount > 0) { result.czAt += sampleFactor + 20; count++; }
            result.czAt = count > 0 ? Math.min(100, result.czAt / count) : 0;

            result.makuai = 0;
            if (inp.karakuriRareCount > 0) {
                result.makuai = Math.min(100, sampleFactor + Math.min(40, inp.karakuriRareCount * 3));
            }

            result.directHit = 0;
            if (inp.atDirectHit > 0) {
                result.directHit = Math.min(100, sampleFactor + 25);
            }

            result.performance = 0;
            let perfCount = 0;
            ['endScreenFrancine', 'endScreenShiroganeKatsuNarumi', 'endScreenAshibanaGuy',
                'olympiaPlus4', 'olympiaPlus6', 'endingLampPurple', 'endingLampRainbow', 'endingLampGreen'].forEach(k => {
                    if (inp[k] > 0) { result.performance += 90; perfCount++; }
                });
            result.performance = perfCount > 0 ? Math.min(100, result.performance / perfCount) : 0;

        } else {
            // 汎用
            let koyakuConf = 0, koyakuCount = 0;
            if (inp.bell > 0) { koyakuConf += calcSingleConfidence(inp.bell, machine.bellProb, totalSpins); koyakuCount++; }
            if (inp.weakCherry > 0) { koyakuConf += calcSingleConfidence(inp.weakCherry, machine.cherryProb, totalSpins); koyakuCount++; }
            if (inp.watermelon > 0) { koyakuConf += calcSingleConfidence(inp.watermelon, machine.watermelonProb, totalSpins); koyakuCount++; }
            if (inp.chance > 0) { koyakuConf += calcSingleConfidence(inp.chance, machine.chanceProb, totalSpins); koyakuCount++; }
            result.koyaku = koyakuCount > 0 ? Math.min(100, koyakuConf / koyakuCount) : 0;

            result.cz = inp.czEntry > 0 ? calcSingleConfidence(inp.czEntry, machine.czProb, totalSpins) : 0;
            result.at = inp.atFirstHit > 0 ? calcSingleConfidence(inp.atFirstHit, machine.atFirstHitProb, totalSpins) : 0;
            result.firstHit = result.at;
        }

        return result;
    }

    function calcSingleConfidence(observed, probTable, totalSpins) {
        if (!probTable) return 0;
        const observedProb = observed / totalSpins;
        const probs = [];
        for (let s = 1; s <= 6; s++) probs.push(probTable[s]);
        const range = Math.max(...probs) - Math.min(...probs);
        if (range === 0) return 0;
        const sampleFactor = Math.min(1, totalSpins / 3000);
        const distinctness = Math.abs(observedProb - (probs[0] + probs[5]) / 2) / range;
        return Math.min(100, Math.round((sampleFactor * 60 + distinctness * 40)));
    }

    // ── Expected Value ──
    function calcExpectedValue(machine, settingProbs, inp) {
        let weightedPayout = 0;
        for (let s = 1; s <= 6; s++) {
            weightedPayout += settingProbs[s - 1] * machine.payoutRate[s];
        }

        const totalSpins = inp.totalSpins || 1;
        const coinsPerSpin = 3;
        const totalCoinsIn = totalSpins * coinsPerSpin;
        const expectedReturn = totalCoinsIn * (weightedPayout / 100);
        const expectedDiffCoins = expectedReturn - totalCoinsIn;

        let ceilingBonus = 0;
        if (inp.currentGame > 0 && machine.ceiling) {
            const remaining = machine.ceiling - inp.currentGame;
            if (remaining > 0 && remaining < 300) {
                ceilingBonus = machine.ceilingBenefit * (1 - remaining / machine.ceiling);
            }
        }

        return {
            payoutRate: weightedPayout,
            expectedDiffCoins: Math.round(expectedDiffCoins + ceilingBonus),
            ceilingBonus: Math.round(ceilingBonus)
        };
    }

    // ── Hourly Wage ──
    function calcHourlyWage(expectedValue, inp) {
        const spinsPerHour = 800;
        const coinsPerSpin = 3;
        const hourlyDiff = (expectedValue.payoutRate / 100 - 1) * coinsPerSpin * spinsPerHour;
        const hourlyWage = Math.round(hourlyDiff * 20);
        const totalSpins = inp.totalSpins || 1;
        const hoursPlayed = totalSpins / spinsPerHour;

        return { hourlyWage, hoursPlayed: Math.round(hoursPlayed * 10) / 10 };
    }

    // ── Quit Timing ──
    function calcQuitTiming(machine, settingProbs, inp) {
        const currentGame = inp.currentGame || 0;
        const highSettingProb = settingProbs[3] + settingProbs[4] + settingProbs[5];

        let inZone = false;
        if (machine.zones) {
            for (const zone of machine.zones) {
                if (Math.abs(currentGame - zone) <= 50) { inZone = true; break; }
            }
        }

        const ceilingProximity = machine.ceiling ? (currentGame / machine.ceiling) : 0;
        const nearCeiling = ceilingProximity > 0.7;

        let recommendation, reason, optimalQuitGame;

        if (nearCeiling) {
            recommendation = 'continue';
            reason = `天井まで残り${machine.ceiling - currentGame}G。続行推奨。`;
            optimalQuitGame = machine.ceiling;
        } else if (highSettingProb > 0.5) {
            recommendation = 'continue';
            reason = `高設定期待度${(highSettingProb * 100).toFixed(0)}%。続行推奨。`;
            optimalQuitGame = null;
        } else if (highSettingProb > 0.25 || inZone) {
            recommendation = 'maybe';
            reason = inZone ? 'ゾーン付近のため状況次第。' : `高設定期待度${(highSettingProb * 100).toFixed(0)}%。状況次第。`;
            optimalQuitGame = currentGame;
        } else {
            recommendation = 'quit';
            reason = '高設定期待度 低。ヤメ推奨。';
            optimalQuitGame = currentGame;
        }

        return { recommendation, reason, optimalQuitGame };
    }

    // ── High Setting Confidence ──
    function calcHighSettingConfidence(settingProbs, hallCondition) {
        let highProb = settingProbs[3] + settingProbs[4] + settingProbs[5];
        if (hallCondition.specialDay) highProb = Math.min(1, highProb * 1.15);
        if (hallCondition.lineup) highProb = Math.min(1, highProb * 1.05);
        if (hallCondition.allDevices) highProb = Math.min(1, highProb * 1.2);

        let label, level;
        if (highProb >= 0.6) { label = '激高'; level = 'very-high'; }
        else if (highProb >= 0.4) { label = '高'; level = 'high'; }
        else if (highProb >= 0.2) { label = '普通'; level = 'medium'; }
        else { label = '低'; level = 'low'; }

        return { probability: highProb, label, level };
    }

    // ═══════════════════════════════════════════════════
    // ★ 結果表示
    // ═══════════════════════════════════════════════════
    function renderResults(results) {
        const container = document.getElementById('results-content');
        if (!container) return;

        const machine = state.machineData;
        const inp = state.inputs;
        const isKarakuri = machine.customEstimation === 'karakuriEstimation';
        const isKabaneri = machine.customEstimation === 'kabaneriKaimonEstimation';
        const isSpecialized = isKarakuri || isKabaneri;

        let html = '';

        // Machine name header
        html += `<div class="card glow">
      <div class="card-title"><span class="icon">🎰</span>${machine.name}${isSpecialized ? ' <span style="color:var(--accent-primary);font-size:0.7em;">★特化版</span>' : ''}</div>
      <div class="detail-row">
        <span class="label">総回転数</span>
        <span class="value">${(inp.totalSpins || 0).toLocaleString()}G</span>
      </div>`;

        if (isKarakuri) {
            if (inp.atFirstHitCount > 0) html += `<div class="detail-row"><span class="label">AT初当たり</span><span class="value">${inp.atFirstHitCount}回 (1/${inp.totalSpins > 0 ? Math.round(inp.totalSpins / inp.atFirstHitCount) : '-'})</span></div>`;
            if (inp.czCount > 0) html += `<div class="detail-row"><span class="label">CZ</span><span class="value">${inp.czCount}回 (1/${inp.totalSpins > 0 ? Math.round(inp.totalSpins / inp.czCount) : '-'})</span></div>`;
            if (inp.makuaiFromRare > 0) html += `<div class="detail-row"><span class="label">幕間チャンス（レア役）</span><span class="value">${inp.makuaiFromRare}/${inp.karakuriRareCount}回</span></div>`;
            if (inp.atDirectHit > 0) html += `<div class="detail-row"><span class="label">AT直撃</span><span class="value">${inp.atDirectHit}回</span></div>`;
        } else if (isKabaneri) {
            if (inp.atFirstHit > 0) html += `<div class="detail-row"><span class="label">AT初当たり</span><span class="value">${inp.atFirstHit}回 (1/${inp.totalSpins > 0 ? Math.round(inp.totalSpins / inp.atFirstHit) : '-'})</span></div>`;
            html += `<div class="detail-row"><span class="label">BIG / REG</span><span class="value">${inp.big || 0} / ${inp.reg || 0}</span></div>`;
            if (inp.czEntry > 0) html += `<div class="detail-row"><span class="label">CZ</span><span class="value">${inp.czEntry}回 (1/${inp.totalSpins > 0 ? Math.round(inp.totalSpins / inp.czEntry) : '-'})</span></div>`;
            if (inp.bell > 0) html += `<div class="detail-row"><span class="label">ベル確率</span><span class="value">1/${inp.totalSpins > 0 ? (inp.totalSpins / inp.bell).toFixed(2) : '-'}</span></div>`;
        } else {
            html += `<div class="detail-row"><span class="label">BIG / REG / AT</span><span class="value">${inp.big || 0} / ${inp.reg || 0} / ${inp.at || 0}</span></div>`;
        }
        html += `</div>`;

        // Setting Probabilities
        html += `<div class="card">
      <div class="card-title"><span class="icon">📊</span>設定期待度</div>`;

        for (let s = 1; s <= 6; s++) {
            const pct = (results.settingProbs[s - 1] * 100).toFixed(1);
            const width = Math.max(2, results.settingProbs[s - 1] * 100);
            html += `
        <div class="setting-bar-container">
          <div class="setting-bar-label">
            <span class="setting-num">設定${s}</span>
            <span class="setting-pct" style="color: ${getSettingColor(s)}">${pct}%</span>
          </div>
          <div class="setting-bar">
            <div class="setting-bar-fill s${s}" style="width: ${width}%"></div>
          </div>
        </div>`;
        }

        html += `<div style="text-align:center; margin-top:16px;">
      <span class="confidence-badge ${results.highSettingConf.level}">
        高設定期待度: ${results.highSettingConf.label}
      </span>
    </div></div>`;

        // ★ AI寸評カード
        const commentary = generateAICommentary(machine, inp, results);
        html += `<div class="card commentary-card">
      <div class="card-title"><span class="icon">🤖</span>AI寸評</div>
      <div class="commentary-verdict ${commentary.verdictClass}">
        ${commentary.verdict}
      </div>
      <p class="commentary-text">${commentary.text}</p>
      ${commentary.bullets.length > 0 ? `<ul class="commentary-bullets">${commentary.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
      <p class="commentary-action">${commentary.action}</p>
    </div>`;

        // Confidence Breakdown
        html += `<div class="card">
      <div class="card-title"><span class="icon">🔍</span>信頼度分析</div>`;

        let confItems;
        if (isKarakuri) {
            confItems = [
                { label: 'CZ・AT確率', value: results.confidence.czAt },
                { label: '幕間チャンス', value: results.confidence.makuai },
                { label: 'AT直撃', value: results.confidence.directHit },
                { label: '演出示唆', value: results.confidence.performance }
            ];
        } else {
            confItems = [
                { label: '小役', value: results.confidence.koyaku },
                { label: 'CZ', value: results.confidence.cz },
                { label: 'AT', value: results.confidence.at },
                { label: '初当たり', value: results.confidence.firstHit || 0 }
            ];
        }

        confItems.forEach(item => {
            html += `<div class="conf-item">
        <span class="conf-label">${item.label}</span>
        <div class="conf-bar-wrap">
          <div class="conf-bar" style="width:${Math.round(item.value)}%"></div>
        </div>
        <span class="conf-value">${Math.round(item.value)}%</span>
      </div>`;
        });
        html += `</div>`;

        // Expected Value
        html += `<div class="card">
      <div class="card-title"><span class="icon">💰</span>期待値</div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-label">期待差枚</div>
          <div class="stat-value ${results.expectedValue.expectedDiffCoins >= 0 ? 'positive' : 'negative'}">
            ${results.expectedValue.expectedDiffCoins >= 0 ? '+' : ''}${results.expectedValue.expectedDiffCoins.toLocaleString()}
          </div>
          <div class="stat-unit">枚</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">機械割推定</div>
          <div class="stat-value neutral">${results.expectedValue.payoutRate.toFixed(1)}</div>
          <div class="stat-unit">%</div>
        </div>
      </div>
    </div>`;

        // Hourly Wage
        html += `<div class="card">
      <div class="card-title"><span class="icon">⏱</span>時給換算</div>
      <div class="stat-grid">
        <div class="stat-item full">
          <div class="stat-label">時給目安</div>
          <div class="stat-value ${results.hourlyWage.hourlyWage >= 0 ? 'gold' : 'negative'}">
            ¥${results.hourlyWage.hourlyWage.toLocaleString()}
          </div>
          <div class="stat-unit">円/時</div>
        </div>
      </div>
    </div>`;

        // Quit Timing
        html += `<div class="card">
      <div class="card-title"><span class="icon">🚪</span>ヤメ時推定</div>
      <div style="text-align:center; margin: 16px 0;">
        <span class="quit-badge ${results.quitTiming.recommendation}">
          ${getQuitLabel(results.quitTiming.recommendation)}
        </span>
      </div>
      <p style="font-size:0.82rem; color:var(--text-secondary); text-align:center;">
        ${results.quitTiming.reason}
      </p>
      ${results.quitTiming.optimalQuitGame ? `
        <div class="stat-grid" style="margin-top:12px;">
          <div class="stat-item full">
            <div class="stat-label">最適ヤメゲーム数</div>
            <div class="stat-value neutral">${results.quitTiming.optimalQuitGame}</div>
            <div class="stat-unit">G</div>
          </div>
        </div>` : ''}
    </div>`;

        // Investment Summary
        if (inp.investment > 0 || inp.revenue > 0) {
            const profit = (inp.revenue || 0) - (inp.investment || 0);
            html += `<div class="card">
        <div class="card-title"><span class="icon">💳</span>収支</div>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">投資</div>
            <div class="stat-value negative">¥${(inp.investment || 0).toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">回収</div>
            <div class="stat-value positive">¥${(inp.revenue || 0).toLocaleString()}</div>
          </div>
          <div class="stat-item full">
            <div class="stat-label">収支</div>
            <div class="stat-value ${profit >= 0 ? 'positive' : 'negative'}">
              ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}
            </div>
          </div>
        </div>
      </div>`;
        }

        container.innerHTML = html;

        // Animate bars
        requestAnimationFrame(() => {
            container.querySelectorAll('.setting-bar-fill').forEach(bar => {
                const w = bar.style.width;
                bar.style.width = '0%';
                requestAnimationFrame(() => { bar.style.width = w; });
            });
            container.querySelectorAll('.conf-bar').forEach(bar => {
                const w = bar.style.width;
                bar.style.width = '0%';
                requestAnimationFrame(() => { bar.style.width = w; });
            });
        });
    }

    // ═══════════════════════════════════════════════════
    // ★ AI寸評生成
    // ═══════════════════════════════════════════════════
    function generateAICommentary(machine, inp, results) {
        const probs = results.settingProbs;
        const topSetting = probs.indexOf(Math.max(...probs)) + 1;
        const topPct = Math.round(Math.max(...probs) * 100);
        const set6Pct = Math.round(probs[5] * 100);
        const set56Pct = Math.round((probs[4] + probs[5]) * 100);
        const set456Pct = Math.round((probs[3] + probs[4] + probs[5]) * 100);
        const totalSpins = inp.totalSpins || 0;
        const qt = results.quitTiming;

        // 根拠リスト（入力されたデータから）
        const bullets = [];
        const confirmEvents = ['inlineConfirm6','inlineConfirm56','inlineConfirm456','inlineConfirm246','inlineHighSuggest'];
        const confirmLabels = {
            inlineConfirm6: '🌈 設定6確定演出（虹トロフィー等）の確認',
            inlineConfirm56: '💜 設定5以上確定演出の確認',
            inlineConfirm456: '💙 設定4以上確定演出の確認',
            inlineConfirm246: '💚 偶数設定確定演出の確認',
            inlineHighSuggest: '⭐ 高設定示唆演出（強）の確認'
        };
        const hasConfirm = confirmEvents.some(k => inp[k] > 0);
        if (hasConfirm) {
            const key = confirmEvents.find(k => inp[k] > 0);
            bullets.push(confirmLabels[key]);
        }

        if (totalSpins > 0) {
            if (inp.atFirstHit > 0 && machine.atFirstHitProb) {
                const actual = Math.round(totalSpins / inp.atFirstHit);
                const s1 = Math.round(1 / machine.atFirstHitProb[1]);
                const s6 = Math.round(1 / machine.atFirstHitProb[6]);
                const judge = actual <= s6 * 1.1 ? '設定6水準' : actual <= (s1 + s6) / 2 ? '高設定寄り' : actual >= s1 * 0.9 ? '設定1水準' : '中間';
                bullets.push(`AT初当たり 1/${actual}G（設定1基準:1/${s1}G、設定6基準:1/${s6}G）→ ${judge}`);
            }
            if (inp.bell > 0 && machine.bellProb) {
                const actual = (totalSpins / inp.bell).toFixed(1);
                const s6val = (1 / machine.bellProb[6]).toFixed(1);
                const s1val = (1 / machine.bellProb[1]).toFixed(1);
                const judge = parseFloat(actual) <= parseFloat(s6val) * 1.05 ? '設定6水準' :
                              parseFloat(actual) >= parseFloat(s1val) * 0.95 ? '設定1水準' : '中間寄り';
                bullets.push(`ベル確率 1/${actual}（設定1:1/${s1val}、設定6:1/${s6val}）→ ${judge}`);
            }
            if (inp.czEntry > 0 && machine.czProb) {
                const actual = Math.round(totalSpins / inp.czEntry);
                bullets.push(`CZ突入 ${inp.czEntry}回（1/${actual}G）`);
            }
            if (totalSpins < 300) {
                bullets.push(`⚠ 総回転数 ${totalSpins}G は少なめ。統計精度は低い段階`);
            }
        }

        // 判定テキスト
        let verdict, verdictClass, text, action;

        if (hasConfirm) {
            const confirmKey = confirmEvents.find(k => inp[k] > 0);
            if (confirmKey === 'inlineConfirm6') {
                verdict = '🌈 設定6確定';
                verdictClass = 'verdict-s6';
                text = `設定6確定演出を確認しています。AIの推定結果よりもこの情報が最優先です。設定6の機械割は${machine.payoutRate[6]}%であり、理論上は最高の期待値が見込めます。`;
                action = `【結論】設定6確定。閉店まで絶対に続行してください。天井恩恵は関係なく、純粋に高い機械割で打ち続けることが正解です。`;
            } else if (confirmKey === 'inlineConfirm56') {
                verdict = '💜 設定5or6確定';
                verdictClass = 'verdict-high';
                text = `設定5以上確定演出を確認しています。設定5の機械割${machine.payoutRate[5]}%以上が保証された状態です。`;
                action = `【結論】設定5以上確定。迷わず続行。よほどの事情がない限り閉店まで打ちきるべき台です。`;
            } else {
                verdict = '💙 高設定確定';
                verdictClass = 'verdict-high';
                text = `高設定確定演出を確認しています。設定4以上の機械割（${machine.payoutRate[4]}%以上）が期待できます。`;
                action = `【結論】高設定確定。続行推奨です。ボーナス後のヤメは損失になる可能性が高いです。`;
            }
        } else if (topPct >= 65 && topSetting >= 5) {
            verdict = `🔥 設定${topSetting}濃厚（${topPct}%）`;
            verdictClass = 'verdict-s6';
            text = `各種データの総合判定で設定${topSetting}の可能性が${topPct}%と非常に高い水準です。設定5・6合計で${set56Pct}%と高設定が濃厚です。`;
            action = `【結論】続行推奨。データが設定${topSetting}を強く示しています。${qt.reason}`;
        } else if (set456Pct >= 60) {
            verdict = `⭐ 高設定期待（設定4以上:${set456Pct}%）`;
            verdictClass = 'verdict-high';
            text = `設定4以上の合算期待度が${set456Pct}%です。高設定被りの可能性が高い状態です。最有力は設定${topSetting}（${topPct}%）です。`;
            action = `【結論】${qt.recommendation === 'continue' ? '続行推奨。' : '状況次第。'}${qt.reason}　投資額と比較して続行を判断してください。`;
        } else if (set456Pct >= 35) {
            verdict = `🟡 高設定可能性あり（設定4以上:${set456Pct}%）`;
            verdictClass = 'verdict-medium';
            if (totalSpins < 500) {
                text = `まだ${totalSpins}Gと回転数が少ないため推定精度が低めです。現時点では設定${topSetting}が最有力（${topPct}%）ですが、確定的な判断は早計です。`;
            } else {
                text = `${totalSpins}Gのデータでは設定${topSetting}（${topPct}%）が最有力ですが、高設定（4以上）と低設定の分離ができていない状態です。`;
            }
            action = `【結論】${qt.recommendation === 'continue' ? '天井・ゾーン状況を踏まえ続行を検討。' : '低設定の可能性も${100 - set456Pct}%あり、追い投資は要注意。'}　${qt.reason}`;
        } else {
            verdict = `⚠ 高設定否定的（設定4以上:${set456Pct}%）`;
            verdictClass = 'verdict-low';
            text = `現在のデータでは設定${topSetting}（${topPct}%）が最有力ですが、${100-set456Pct}%の確率で設定3以下です。高設定の根拠が乏しい状態です。`;
            action = `【結論】${qt.recommendation === 'quit' ? 'ヤメ推奨。' : qt.reason}　同じ設定が翌日も入る可能性を踏まえて判断してください。`;
        }

        return { verdict, verdictClass, text, bullets, action };
    }

    function getSettingColor(s) {
        const colors = { 1: '#e17055', 2: '#fdcb6e', 3: '#ffeaa7', 4: '#74b9ff', 5: '#00cec9', 6: '#f9ca24' };
        return colors[s] || '#fff';
    }

    function getQuitLabel(rec) {
        switch (rec) {
            case 'continue': return '🟢 続行';
            case 'maybe': return '🟡 状況次第';
            case 'quit': return '🔴 ヤメ推奨';
            default: return rec;
        }
    }

    // ── Screenshot / OCR ──
    function initScreenshot() {
        const fileInput = document.getElementById('screenshot-input');
        const preview = document.getElementById('upload-preview');
        const previewImg = document.getElementById('preview-img');
        const removeBtn = document.getElementById('remove-screenshot');
        const ocrLoading = document.getElementById('ocr-loading');
        const ocrResult = document.getElementById('ocr-result');

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                previewImg.src = ev.target.result;
                preview.style.display = 'block';
                ocrLoading.classList.add('active');
                ocrResult.style.display = 'none';

                try {
                    const results = await performOCR(ev.target.result);
                    applyOCRResults(results);
                    ocrResult.style.display = 'block';
                    showToast('OCR解析完了！');
                } catch (err) {
                    showToast('OCR解析に失敗しました');
                    console.error(err);
                } finally {
                    ocrLoading.classList.remove('active');
                }
            };
            reader.readAsDataURL(file);
        });

        removeBtn.addEventListener('click', () => {
            preview.style.display = 'none';
            fileInput.value = '';
            ocrResult.style.display = 'none';
        });
    }

    async function performOCR(imageDataUrl) {
        const progressEl = document.getElementById('ocr-progress-value');
        if (progressEl) progressEl.textContent = '0';
        try {
            const result = await Tesseract.recognize(imageDataUrl, 'jpn+eng', {
                logger: m => {
                    if (m.status === 'recognizing text' && progressEl) {
                        progressEl.textContent = Math.floor(m.progress * 100);
                    }
                }
            });
            return parseOCRText(result.data.text);
        } catch (err) {
            console.error('Tesseract OCR error:', err);
            return parseOCRText('');
        }
    }

    function parseOCRText(text) {
        const results = { totalSpins: 0, big: 0, reg: 0, at: 0, currentGame: 0, diffCoins: 0, rawText: text };
        if (!text) return results;

        const t = text.replace(/[Oo]/g, '0').replace(/[lIi|]/g, '1').replace(/[Ss]/g, '5').replace(/[,、]/g, '').replace(/\s+/g, ' ');

        const spinPatterns = [/(?:総回転|回転数|総ゲーム|G数|ゲーム数|TOTAL|total|合計)[^\d]*(\d{1,6})/i, /(\d{1,6})\s*(?:回転|G$|ゲーム)/, /(?:回転数|G数)\s*[:：]\s*(\d{1,6})/];
        for (const pat of spinPatterns) { const m = t.match(pat); if (m && parseInt(m[1]) > 50) { results.totalSpins = parseInt(m[1]); break; } }

        const bigPatterns = [/BIG[^\d]*(\d{1,4})/i, /(?:ビッグ|ビック)[^\d]*(\d{1,4})/];
        for (const pat of bigPatterns) { const m = t.match(pat); if (m) { results.big = parseInt(m[1]); break; } }

        const regPatterns = [/REG[^\d]*(\d{1,4})/i, /(?:レギュラー|レグ)[^\d]*(\d{1,4})/];
        for (const pat of regPatterns) { const m = t.match(pat); if (m) { results.reg = parseInt(m[1]); break; } }

        const atPatterns = [/(?:AT|ART|エーティー)[^\d]*(\d{1,4})/i, /(?:初当|初当たり|AT回数|ART回数)[^\d]*(\d{1,4})/];
        for (const pat of atPatterns) { const m = t.match(pat); if (m) { results.at = parseInt(m[1]); break; } }

        const diffPatterns = [/(?:差枚|差玉|DIFF|差枚数)[^\d-]*([+-]?\d{1,6})/i, /([+-]\d{1,6})\s*(?:枚|玉)/];
        for (const pat of diffPatterns) { const m = t.match(pat); if (m) { results.diffCoins = parseInt(m[1]); break; } }

        const currentPatterns = [/(?:現在|当日|ハマリ|はまり|最終)[^\d]*(\d{1,5})\s*G/i, /(?:現在ゲーム数|現在G数)[^\d]*(\d{1,5})/];
        for (const pat of currentPatterns) { const m = t.match(pat); if (m) { results.currentGame = parseInt(m[1]); break; } }

        if (results.totalSpins === 0) {
            const numbers = t.match(/\d{3,6}/g);
            if (numbers && numbers.length > 0) {
                const sorted = numbers.map(Number).sort((a, b) => b - a);
                if (sorted[0] > 100) results.totalSpins = sorted[0];
            }
        }

        return results;
    }

    function applyOCRResults(results) {
        const fields = { 'totalSpins': 'input-total-spins', 'currentGame': 'input-current-game' };
        let html = '<div class="card-title"><span class="icon">📊</span>OCR検出結果</div>';
        let foundAny = false;
        for (const [key, inputId] of Object.entries(fields)) {
            const val = results[key] || 0;
            if (val > 0) {
                foundAny = true;
                const input = document.getElementById(inputId);
                if (input) { input.value = val; state.inputs[key] = val; }
                html += `<div class="detail-row"><span class="label">${key === 'totalSpins' ? '総回転数' : '現在G数'}</span><span class="value">${val.toLocaleString()}</span></div>`;
            }
        }
        if (results.diffCoins) {
            html += `<div class="detail-row"><span class="label">差枚</span><span class="value" style="color:${results.diffCoins >= 0 ? 'var(--success)' : 'var(--danger)'}"></${results.diffCoins >= 0 ? '+' : ''}${results.diffCoins.toLocaleString()}</span></div>`;
            foundAny = true;
        }
        if (!foundAny) {
            html += '<p style="font-size:0.82rem;color:var(--text-secondary);padding:10px 0;">数値を検出できませんでした。</p>';
        }
        if (results.rawText) {
            html += '<div class="section-divider"></div><div class="card-title"><span class="icon">📝</span>読み取りテキスト</div>';
            html += `<p style="font-size:0.72rem;color:var(--text-muted);word-break:break-all;max-height:100px;overflow-y:auto;padding:8px;background:var(--bg-input);border-radius:8px;">${results.rawText.replace(/\n/g, '<br>')}</p>`;
        }
        html += '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:10px;">※ 値が正確でない場合は入力画面で修正してください</p>';
        const ocrResult = document.getElementById('ocr-result');
        ocrResult.innerHTML = html;
    }

    // ── Hall Condition ──
    function initHallCondition() {
        document.querySelectorAll('.hall-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                const key = tag.dataset.hall;
                if (key) state.hallCondition[key] = tag.classList.contains('active');
            });
        });
    }

    // ── Setting Confirm ──
    function initSettingConfirmChips() {
        document.querySelectorAll('.chip[data-confirm]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip[data-confirm]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.inputs.settingConfirm = chip.dataset.confirm;
            });
        });
    }

    // ── マイスロ 設定示唆イベント確認パネル ──
    function initMySlotConfirmPanel() {
        const grid = document.getElementById('confirm-event-grid');
        if (!grid) return;

        grid.querySelectorAll('.confirm-event-btn').forEach(btn => {
            const onTap = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const key = btn.dataset.confirmKey;
                const label = btn.dataset.label;

                // 全ボタンのselectedをリセット
                grid.querySelectorAll('.confirm-event-btn').forEach(b => b.classList.remove('selected'));

                if (key) {
                    btn.classList.add('selected');
                    // state.inputsに反映（全inlineConfirmキーをリセット後に選択を設定）
                    ['inlineConfirm6','inlineConfirm56','inlineConfirm456','inlineConfirm246','inlineHighSuggest'].forEach(k => {
                        state.inputs[k] = 0;
                    });
                    state.inputs[key] = 1;

                    const display = document.getElementById('confirm-selected-display');
                    const labelEl = document.getElementById('confirm-selected-label');
                    if (display && labelEl) {
                        display.style.display = '';
                        labelEl.textContent = label;
                    }
                } else {
                    // リセット
                    ['inlineConfirm6','inlineConfirm56','inlineConfirm456','inlineConfirm246','inlineHighSuggest'].forEach(k => {
                        state.inputs[k] = 0;
                    });
                    const display = document.getElementById('confirm-selected-display');
                    if (display) display.style.display = 'none';
                }
            };
            btn.addEventListener('click', onTap);
            btn.addEventListener('touchend', onTap, { passive: false });
        });
    }

    // マイスロ解析完了後にパネルを表示する関数（initMySlotBulkから呼ぶ）
    function showMySlotConfirmPanel() {
        const panel = document.getElementById('myslot-confirm-panel');
        if (panel) {
            panel.style.display = '';
            // 前回の選択をリセット
            const grid = document.getElementById('confirm-event-grid');
            if (grid) grid.querySelectorAll('.confirm-event-btn').forEach(b => b.classList.remove('selected'));
            const display = document.getElementById('confirm-selected-display');
            if (display) display.style.display = 'none';
            ['inlineConfirm6','inlineConfirm56','inlineConfirm456','inlineConfirm246','inlineHighSuggest'].forEach(k => {
                state.inputs[k] = 0;
            });
        }
    }

    // ── Toast ──
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ── Custom Machine ──
    function initCustomMachine() {
        const btn = document.getElementById('btn-save-custom');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const name = document.getElementById('custom-name').value.trim();
            if (!name) { showToast('機種名を入力してください'); return; }
            const type = document.getElementById('custom-type').value;
            const ceiling = parseInt(document.getElementById('custom-ceiling').value) || 999;
            const p1 = parseFloat(document.getElementById('custom-payout1').value) || 97.0;
            const p6 = parseFloat(document.getElementById('custom-payout6').value) || 115.0;
            const h1 = parseFloat(document.getElementById('custom-hit1').value) || 400;
            const h6 = parseFloat(document.getElementById('custom-hit6').value) || 200;
            const b1 = parseFloat(document.getElementById('custom-bell1').value) || 7.5;
            const b6 = parseFloat(document.getElementById('custom-bell6').value) || 5.9;
            const machine = {
                name, alias: [], type, ceiling, ceilingBenefit: Math.round(ceiling * 1.8),
                payoutRate: gp(p1, p6), bellProb: gpi(b1, b6), cherryProb: gpi(37, 28),
                watermelonProb: gpi(56, 41), chanceProb: gpi(185, 128),
                atFirstHitProb: gpi(h1, h6), czProb: gpi(Math.round(h1 * 0.38), Math.round(h6 * 0.42)),
                czSuccessRate: gp(0.29, 0.51), zones: type === 'AT' ? [200, 400, 600, 800] : [],
                settingConfirm: SC, customFields: type === 'AT' ? GENERIC_AT_FIELDS : GENERIC_A_TYPE_FIELDS
            };
            saveCustomMachine(machine);
            refreshMachineChips();
            selectMachine(name);
            showToast(`${name} を登録しました！`);
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('machine-select').classList.add('active');
            window.scrollTo(0, 0);
            ['custom-name', 'custom-ceiling', 'custom-payout1', 'custom-payout6', 'custom-hit1', 'custom-hit6', 'custom-bell1', 'custom-bell6'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        });
    }

    // ═══════════════════════════════════════════════════
    // ★ マイスロ一括解析
    // ═══════════════════════════════════════════════════
    function initMySlotBulk() {
        const mySlotFiles = [];
        const fileInput = document.getElementById('myslot-file-input');
        const addFileInput = document.getElementById('myslot-add-file-input');
        const thumbsContainer = document.getElementById('myslot-thumbnails');
        const addMoreBtn = document.getElementById('myslot-add-more');
        const analyzeBtn = document.getElementById('btn-myslot-analyze');
        const applyBtn = document.getElementById('btn-myslot-apply');
        let mergedResults = null;

        if (!fileInput) return;

        function addFiles(files) {
            for (const file of files) {
                if (mySlotFiles.length >= 10) break;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    mySlotFiles.push({ file, dataUrl: ev.target.result, status: 'pending' });
                    renderThumbnails();
                    if (analyzeBtn) analyzeBtn.style.display = '';
                    if (addMoreBtn) addMoreBtn.style.display = '';
                };
                reader.readAsDataURL(file);
            }
        }

        fileInput.addEventListener('change', (e) => {
            addFiles(e.target.files);
            fileInput.value = '';
        });

        if (addFileInput) {
            addFileInput.addEventListener('change', (e) => {
                addFiles(e.target.files);
                addFileInput.value = '';
            });
        }

        function renderThumbnails() {
            thumbsContainer.innerHTML = '';
            mySlotFiles.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = `myslot-thumb ${item.status}`;
                div.innerHTML = `
                    <img src="${item.dataUrl}" alt="Screenshot ${idx + 1}">
                    <button class="thumb-remove" data-idx="${idx}">&times;</button>
                    <span class="thumb-index">${idx + 1}</span>
                    <span class="thumb-status">${item.status === 'processed' ? '✅' : item.status === 'processing' ? '⏳' : item.status === 'error' ? '❌' : ''}</span>
                `;
                thumbsContainer.appendChild(div);
            });

            // Remove buttons
            thumbsContainer.querySelectorAll('.thumb-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    mySlotFiles.splice(idx, 1);
                    renderThumbnails();
                    if (mySlotFiles.length === 0) {
                        if (analyzeBtn) analyzeBtn.style.display = 'none';
                        if (addMoreBtn) addMoreBtn.style.display = 'none';
                        if (applyBtn) applyBtn.style.display = 'none';
                        document.getElementById('myslot-results').style.display = 'none';
                    }
                });
            });
        }

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                if (mySlotFiles.length === 0) {
                    showToast('画像をアップロードしてください');
                    return;
                }
                if (!state.machineData || !state.machineData.mySlotConfig) {
                    showToast('マイスロ対応機種を選択してください');
                    return;
                }

                analyzeBtn.style.display = 'none';
                const progressCard = document.getElementById('myslot-ocr-progress');
                const progressFill = document.getElementById('myslot-progress-fill');
                const progressCurrent = document.getElementById('myslot-progress-current');
                const progressTotal = document.getElementById('myslot-progress-total');
                const progressStatus = document.getElementById('myslot-progress-status');

                progressCard.style.display = '';
                progressTotal.textContent = mySlotFiles.length;
                progressFill.style.width = '0%';

                const allResults = [];

                for (let i = 0; i < mySlotFiles.length; i++) {
                    const item = mySlotFiles[i];
                    item.status = 'processing';
                    renderThumbnails();
                    progressCurrent.textContent = i + 1;
                    progressStatus.textContent = `${i + 1}枚目を解析中...`;
                    progressFill.style.width = `${((i) / mySlotFiles.length) * 100}%`;

                    try {
                        const ocrText = await runTesseractOCR(item.dataUrl);
                        const parsed = parseMySlotText(ocrText, state.machineData.mySlotConfig);
                        allResults.push(parsed);
                        item.status = 'processed';
                    } catch (err) {
                        console.error('MySlot OCR error:', err);
                        item.status = 'error';
                    }
                    renderThumbnails();
                }

                progressFill.style.width = '100%';
                progressStatus.textContent = '解析完了！';

                // マージ
                mergedResults = mergeMySlotResults(allResults);
                displayMySlotResults(mergedResults);
                // ★ 設定示唆イベント確認パネルを表示
                showMySlotConfirmPanel();

                setTimeout(() => { progressCard.style.display = 'none'; }, 1500);
                if (applyBtn) applyBtn.style.display = '';

                showToast(`${mySlotFiles.length}枚の解析が完了しました！`);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (!mergedResults) return;
                applyMySlotToForm(mergedResults);
                showScreen('input');
                showToast('マイスロデータを入力フォームに反映しました');
            });
        }
    }

    // Tesseract OCR helper returning just text
    async function runTesseractOCR(imageDataUrl) {
        const result = await Tesseract.recognize(imageDataUrl, 'jpn+eng', {
            logger: () => {}
        });
        return result.data.text || '';
    }

    // ── マイスロテキストパーサー ──
    function parseMySlotText(rawText, mySlotConfig) {
        const parsed = {};
        if (!rawText || !mySlotConfig || !mySlotConfig.dataMap) return parsed;

        // OCR text cleanup
        const t = rawText
            .replace(/[Oo]/g, '0')
            .replace(/[lIi|]/g, '1')
            .replace(/[Ss]/g, '5')
            .replace(/[,、]/g, '')
            .replace(/\s+/g, ' ');

        for (const item of mySlotConfig.dataMap) {
            for (const pat of item.patterns) {
                const m = t.match(pat);
                if (m && m[1]) {
                    let val = m[1].replace(/[,.]/g, match => match === '.' ? '.' : '');
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal) && numVal > 0) {
                        parsed[item.key] = numVal;
                        break;
                    }
                }
            }
        }

        parsed._rawText = rawText;
        return parsed;
    }

    // ── 複数スクショ結果マージ ──
    function mergeMySlotResults(allResults) {
        const merged = {};
        const maxKeys = ['totalSpins']; // These take the max value
        const sumKeys = ['atFirstHit', 'big', 'reg', 'czEntry', 'czSuccess', 'bonusATDirect',
                         'endScreenHigh', 'endScreenConfirm456', 'endScreenConfirm6'];
        const probKeys = ['bell', 'weakCherry', 'watermelon', 'chance']; // 確率は最新（最後の有効値）を取る
        const lastKeys = ['diffCoins']; // 最後の有効値

        for (const key of maxKeys) {
            let maxVal = 0;
            for (const r of allResults) {
                if (r[key] && r[key] > maxVal) maxVal = r[key];
            }
            if (maxVal > 0) merged[key] = maxVal;
        }

        for (const key of sumKeys) {
            let sum = 0;
            let found = false;
            for (const r of allResults) {
                if (r[key]) { sum += r[key]; found = true; }
            }
            // ただし、同じ値が全スクショに出ていたら合計ではなくその値（マイスロは累計表示のため）
            if (found) {
                const uniqueVals = [...new Set(allResults.filter(r => r[key]).map(r => r[key]))];
                if (uniqueVals.length === 1) {
                    merged[key] = uniqueVals[0]; // 全部同じ→累計値
                } else {
                    // 値が違う→最大値を取る（マイスロの累計は更新される場合がある）
                    merged[key] = Math.max(...allResults.filter(r => r[key]).map(r => r[key]));
                }
            }
        }

        for (const key of probKeys) {
            // 確率は最後に見つかった有効な値を使う
            for (let i = allResults.length - 1; i >= 0; i--) {
                if (allResults[i][key]) {
                    merged[key] = allResults[i][key];
                    break;
                }
            }
        }

        for (const key of lastKeys) {
            for (let i = allResults.length - 1; i >= 0; i--) {
                if (allResults[i][key] !== undefined) {
                    merged[key] = allResults[i][key];
                    break;
                }
            }
        }

        return merged;
    }

    // ── マイスロ結果表示 ──
    function displayMySlotResults(merged) {
        const container = document.getElementById('myslot-results-content');
        const resultsCard = document.getElementById('myslot-results');
        if (!container || !resultsCard) return;

        const machine = state.machineData;
        const config = machine.mySlotConfig;
        let html = '';

        const labelMap = {};
        if (config && config.dataMap) {
            config.dataMap.forEach(d => { labelMap[d.key] = d.label; });
        }

        const orderedKeys = ['totalSpins', 'atFirstHit', 'big', 'reg', 'czEntry', 'czSuccess',
                             'bell', 'weakCherry', 'watermelon', 'chance', 'bonusATDirect', 'diffCoins'];

        for (const key of orderedKeys) {
            if (merged[key] !== undefined) {
                const label = labelMap[key] || key;
                let displayVal = '';
                // 確率系は 1/X で表示
                if (['bell', 'weakCherry', 'watermelon', 'chance'].includes(key) && merged[key] > 1) {
                    displayVal = `1/${merged[key].toFixed(1)}`;
                } else if (key === 'totalSpins') {
                    displayVal = merged[key].toLocaleString() + ' G';
                } else if (key === 'diffCoins') {
                    const val = merged[key];
                    displayVal = `${val >= 0 ? '+' : ''}${val.toLocaleString()} 枚`;
                } else {
                    displayVal = merged[key].toString();
                }

                html += `<div class="myslot-result-item">
                    <span class="result-label">${label}</span>
                    <span class="result-value${key === 'totalSpins' ? ' highlight' : ''}">${displayVal}</span>
                </div>`;
            }
        }

        if (!html) {
            html = '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:16px;">データを検出できませんでした。画像の向きや品質を確認してください。</p>';
        }

        container.innerHTML = html;
        resultsCard.style.display = '';
    }

    // ── マイスロ結果をフォームに反映 ──
    function applyMySlotToForm(merged) {
        // 総回転数
        if (merged.totalSpins) {
            const el = document.getElementById('input-total-spins');
            if (el) { el.value = merged.totalSpins; state.inputs.totalSpins = merged.totalSpins; }
        }

        // 差枚
        if (merged.diffCoins !== undefined) {
            const el = document.getElementById('input-diff-coins');
            if (el) { el.value = merged.diffCoins; state.inputs.diffCoins = merged.diffCoins; }
        }

        // 動的フィールドに反映
        const dynamicKeys = ['atFirstHit', 'big', 'reg', 'czEntry', 'czSuccess',
                            'bell', 'weakCherry', 'watermelon', 'chance', 'bonusATDirect'];

        for (const key of dynamicKeys) {
            if (merged[key] !== undefined) {
                const input = document.querySelector(`[data-dkey="${key}"]`);
                if (input) {
                    // 確率形式 (1/X) の場合は、回数に変換
                    if (['bell', 'weakCherry', 'watermelon', 'chance'].includes(key) && merged[key] > 1) {
                        // マイスロの確率は分母なので、回数に変換
                        if (merged.totalSpins) {
                            const count = Math.round(merged.totalSpins / merged[key]);
                            input.value = count;
                            state.inputs[key] = count;
                        } else {
                            input.value = merged[key];
                            state.inputs[key] = merged[key];
                        }
                    } else {
                        input.value = merged[key];
                        state.inputs[key] = merged[key];
                    }
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // ★ カバネリ開門決戦専用ベイズ推定
    // ═══════════════════════════════════════════════════
    function kabaneriKaimonEstimation(machine, inp) {
        let priors = [1/6, 1/6, 1/6, 1/6, 1/6, 1/6];

        // Setting confirmation
        if (inp.settingConfirm && machine.settingConfirm[inp.settingConfirm]) {
            const allowed = machine.settingConfirm[inp.settingConfirm];
            priors = priors.map((p, i) => allowed.includes(i + 1) ? p : 0);
            const sum = priors.reduce((a, b) => a + b, 0);
            if (sum > 0) priors = priors.map(p => p / sum);
        }

        const totalSpins = inp.totalSpins || 1;
        let likelihoods = [1, 1, 1, 1, 1, 1];

        for (let s = 1; s <= 6; s++) {
            let likelihood = 1;

            // AT初当たり確率
            if (inp.atFirstHit > 0 && machine.atFirstHitProb) {
                likelihood *= poissonLikelihood(inp.atFirstHit, machine.atFirstHitProb[s] * totalSpins);
            }

            // CZ確率
            if (inp.czEntry > 0 && machine.czProb) {
                likelihood *= poissonLikelihood(inp.czEntry, machine.czProb[s] * totalSpins);
            }

            // CZ成功率
            if (inp.czEntry > 0 && inp.czSuccess > 0 && machine.czSuccessRate) {
                const rate = machine.czSuccessRate[s];
                likelihood *= Math.pow(rate, inp.czSuccess) * Math.pow(1 - rate, inp.czEntry - inp.czSuccess);
            }

            // ベル確率
            if (inp.bell > 0 && machine.bellProb) {
                likelihood *= poissonLikelihood(inp.bell, machine.bellProb[s] * totalSpins);
            }

            // 弱チェリー確率
            if (inp.weakCherry > 0 && machine.cherryProb) {
                likelihood *= poissonLikelihood(inp.weakCherry, machine.cherryProb[s] * totalSpins);
            }

            // スイカ確率
            if (inp.watermelon > 0 && machine.watermelonProb) {
                likelihood *= poissonLikelihood(inp.watermelon, machine.watermelonProb[s] * totalSpins);
            }

            // チャンス目
            if (inp.chance > 0 && machine.chanceProb) {
                likelihood *= poissonLikelihood(inp.chance, machine.chanceProb[s] * totalSpins);
            }

            // ボーナス中AT直撃
            if (inp.bonusATDirect > 0 && machine.bonusATDirectProb) {
                const prob = machine.bonusATDirectProb[s];
                // ボーナス回数を母数として使用
                const bonusCount = (inp.big || 0) + (inp.reg || 0);
                if (bonusCount > 0) {
                    likelihood *= binomialLikelihood(inp.bonusATDirect, bonusCount, prob);
                } else {
                    // ボーナス回数不明の場合はポアソンで近似
                    likelihood *= poissonLikelihood(inp.bonusATDirect, prob * totalSpins / 100);
                }
            }

            // 終了画面 - 高設定示唆
            if (inp.endScreenHigh > 0) {
                const rates = { 1: 0.05, 2: 0.08, 3: 0.12, 4: 0.18, 5: 0.25, 6: 0.35 };
                likelihood *= Math.pow(rates[s], inp.endScreenHigh);
            }

            // 終了画面 - 設定4以上確定
            if (inp.endScreenConfirm456 > 0) {
                if (s >= 4) likelihood *= Math.pow(10, inp.endScreenConfirm456);
                else likelihood *= Math.pow(0.01, inp.endScreenConfirm456);
            }

            // 終了画面 - 設定6確定
            if (inp.endScreenConfirm6 > 0) {
                if (s === 6) likelihood *= Math.pow(50, inp.endScreenConfirm6);
                else likelihood *= Math.pow(0.01, inp.endScreenConfirm6);
            }

            likelihoods[s - 1] = likelihood;
        }

        // Posterior
        let posteriors = priors.map((p, i) => p * likelihoods[i]);
        const totalPost = posteriors.reduce((a, b) => a + b, 0);

        if (totalPost > 0) {
            posteriors = posteriors.map(p => p / totalPost);
        } else {
            posteriors = [1/6, 1/6, 1/6, 1/6, 1/6, 1/6];
        }

        return posteriors;
    }

    // ── PWA Registration ──
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    }

})();
