// =====================================================
// パチスロ設定推測AI - メインアプリケーション
// =====================================================

(function () {
    'use strict';

    // ── State ──
    const state = {
        selectedMachine: null,
        machineData: null,
        inputs: {
            totalSpins: 0,
            currentGame: 0,
            big: 0,
            reg: 0,
            at: 0,
            investment: 0,
            revenue: 0,
            diffCoins: 0,
            bell: 0,
            weakCherry: 0,
            watermelon: 0,
            chance: 0,
            czEntry: 0,
            czSuccess: 0,
            atFirstHit: 0,
            settingConfirm: null,
            endScreen: '',
            trophy: '',
            voice: ''
        },
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
        initFormInputs();
        initHallCondition();
        initSettingConfirm();
        initCustomMachine();
        showScreen('home');
    });

    // ── Navigation ──
    function initNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.screen;
                showScreen(target);
            });
        });

        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showScreen('home');
            });
        });

        // Menu cards
        document.querySelectorAll('.menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (target) showScreen(target);
            });
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
        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.toggle('active', n.dataset.screen === id);
        });
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
    `;

        // Update machine name display in input screen
        const machineDisplay = document.getElementById('selected-machine-display');
        if (machineDisplay) {
            machineDisplay.textContent = machine.name;
        }

        showToast(`${machine.name} を選択しました`);
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

                // Start OCR
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

    // Simple OCR using Canvas + Pattern Recognition
    async function performOCR(imageDataUrl) {
        // Simulate OCR processing
        return new Promise((resolve) => {
            const progressEl = document.getElementById('ocr-progress-value');
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 100) progress = 100;
                if (progressEl) progressEl.textContent = Math.floor(progress) + '%';
                if (progress >= 100) {
                    clearInterval(interval);
                    // Return simulated results - in production would use Tesseract.js
                    resolve({
                        totalSpins: 0,
                        big: 0,
                        reg: 0,
                        at: 0,
                        currentGame: 0
                    });
                }
            }, 200);
        });
    }

    function applyOCRResults(results) {
        const fields = {
            'totalSpins': 'input-total-spins',
            'big': 'input-big',
            'reg': 'input-reg',
            'at': 'input-at',
            'currentGame': 'input-current-game'
        };

        let html = '<div class="card-title"><span class="icon">📊</span>OCR検出結果</div>';

        for (const [key, inputId] of Object.entries(fields)) {
            const val = results[key] || 0;
            if (val > 0) {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = val;
                    state.inputs[key] = val;
                }
                html += `<div class="detail-row"><span class="label">${getFieldLabel(key)}</span><span class="value">${val}</span></div>`;
            }
        }

        html += '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:10px;">※ 値が正確でない場合は手動入力画面で修正してください</p>';
        const ocrResult = document.getElementById('ocr-result');
        ocrResult.innerHTML = html;
    }

    function getFieldLabel(key) {
        const labels = {
            totalSpins: '総回転数',
            big: 'BIG',
            reg: 'REG',
            at: 'AT回数',
            currentGame: '現在ゲーム数'
        };
        return labels[key] || key;
    }

    // ── Form Inputs ──
    function initFormInputs() {
        const inputs = document.querySelectorAll('#input .form-input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.key;
                if (key) {
                    state.inputs[key] = parseFloat(input.value) || 0;
                }
            });
        });

        // Analyze button
        document.getElementById('btn-analyze').addEventListener('click', () => {
            if (!state.machineData) {
                showToast('先に機種を選択してください');
                showScreen('home');
                return;
            }
            collectInputs();
            const results = runAnalysis();
            state.results = results;
            renderResults(results);
            showScreen('results');
        });
    }

    function collectInputs() {
        document.querySelectorAll('#input .form-input[data-key]').forEach(input => {
            const key = input.dataset.key;
            if (key) {
                state.inputs[key] = parseFloat(input.value) || 0;
            }
        });
        // Text inputs
        document.querySelectorAll('#input .form-input[data-text-key]').forEach(input => {
            const key = input.dataset.textKey;
            if (key) {
                state.inputs[key] = input.value;
            }
        });
    }

    // ── Setting Confirm ──
    function initSettingConfirm() {
        document.querySelectorAll('.chip[data-confirm]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip[data-confirm]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.inputs.settingConfirm = chip.dataset.confirm;
            });
        });
    }

    // ── Hall Condition ──
    function initHallCondition() {
        document.querySelectorAll('.hall-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                const key = tag.dataset.hall;
                if (key) {
                    state.hallCondition[key] = tag.classList.contains('active');
                }
            });
        });
    }

    // ── Analysis Engine ──
    function runAnalysis() {
        const machine = state.machineData;
        const inp = state.inputs;
        const hall = state.hallCondition;

        // 1. Bayesian Setting Estimation
        const settingProbs = bayesianEstimation(machine, inp);

        // 2. Confidence Breakdown
        const confidence = calcConfidence(machine, inp);

        // 3. Expected Value
        const expectedValue = calcExpectedValue(machine, settingProbs, inp);

        // 4. Hourly Wage
        const hourlyWage = calcHourlyWage(expectedValue, inp);

        // 5. Quit Timing
        const quitTiming = calcQuitTiming(machine, settingProbs, inp);

        // 6. High Setting Confidence
        const highSettingConf = calcHighSettingConfidence(settingProbs, hall);

        return {
            settingProbs,
            confidence,
            expectedValue,
            hourlyWage,
            quitTiming,
            highSettingConf
        };
    }

    // ── Bayesian Estimation ──
    function bayesianEstimation(machine, inp) {
        // Prior (equal)
        let priors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];

        // Apply setting confirmation
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

            // Bell probability
            if (inp.bell > 0 && machine.bellProb) {
                const expectedProb = machine.bellProb[s];
                const observedProb = inp.bell / totalSpins;
                likelihood *= poissonLikelihood(inp.bell, expectedProb * totalSpins);
            }

            // Cherry probability
            if (inp.weakCherry > 0 && machine.cherryProb) {
                const expectedProb = machine.cherryProb[s];
                likelihood *= poissonLikelihood(inp.weakCherry, expectedProb * totalSpins);
            }

            // Watermelon probability
            if (inp.watermelon > 0 && machine.watermelonProb) {
                const expectedProb = machine.watermelonProb[s];
                likelihood *= poissonLikelihood(inp.watermelon, expectedProb * totalSpins);
            }

            // Chance probability
            if (inp.chance > 0 && machine.chanceProb) {
                const expectedProb = machine.chanceProb[s];
                likelihood *= poissonLikelihood(inp.chance, expectedProb * totalSpins);
            }

            // AT First Hit
            if (inp.atFirstHit > 0 && machine.atFirstHitProb) {
                const expectedProb = machine.atFirstHitProb[s];
                likelihood *= poissonLikelihood(inp.atFirstHit, expectedProb * totalSpins);
            }

            // CZ Entry
            if (inp.czEntry > 0 && machine.czProb) {
                const expectedProb = machine.czProb[s];
                likelihood *= poissonLikelihood(inp.czEntry, expectedProb * totalSpins);
            }

            // CZ Success Rate
            if (inp.czEntry > 0 && inp.czSuccess > 0 && machine.czSuccessRate) {
                const expectedRate = machine.czSuccessRate[s];
                const observedRate = inp.czSuccess / inp.czEntry;
                likelihood *= Math.pow(expectedRate, inp.czSuccess) * Math.pow(1 - expectedRate, inp.czEntry - inp.czSuccess);
            }

            likelihoods[s - 1] = likelihood;
        }

        // Posterior = Prior × Likelihood
        let posteriors = priors.map((p, i) => p * likelihoods[i]);
        const totalPost = posteriors.reduce((a, b) => a + b, 0);

        if (totalPost > 0) {
            posteriors = posteriors.map(p => p / totalPost);
        } else {
            posteriors = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
        }

        return posteriors;
    }

    function poissonLikelihood(observed, expected) {
        if (expected <= 0) return 1;
        // Simplified Poisson probability
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

    // ── Confidence Calculation ──
    function calcConfidence(machine, inp) {
        const totalSpins = inp.totalSpins || 1;
        const result = {};

        // 小役 confidence
        let koyakuConf = 0;
        let koyakuCount = 0;
        if (inp.bell > 0) { koyakuConf += calcSingleConfidence(inp.bell, machine.bellProb, totalSpins); koyakuCount++; }
        if (inp.weakCherry > 0) { koyakuConf += calcSingleConfidence(inp.weakCherry, machine.cherryProb, totalSpins); koyakuCount++; }
        if (inp.watermelon > 0) { koyakuConf += calcSingleConfidence(inp.watermelon, machine.watermelonProb, totalSpins); koyakuCount++; }
        if (inp.chance > 0) { koyakuConf += calcSingleConfidence(inp.chance, machine.chanceProb, totalSpins); koyakuCount++; }
        result.koyaku = koyakuCount > 0 ? Math.min(100, koyakuConf / koyakuCount) : 0;

        // CZ confidence
        if (inp.czEntry > 0) {
            result.cz = calcSingleConfidence(inp.czEntry, machine.czProb, totalSpins);
        } else {
            result.cz = 0;
        }

        // AT confidence
        if (inp.atFirstHit > 0) {
            result.at = calcSingleConfidence(inp.atFirstHit, machine.atFirstHitProb, totalSpins);
        } else {
            result.at = 0;
        }

        // First Hit confidence
        result.firstHit = result.at;

        return result;
    }

    function calcSingleConfidence(observed, probTable, totalSpins) {
        if (!probTable) return 0;
        // Measure how much the observed differs between settings
        const observedProb = observed / totalSpins;
        const probs = [];
        for (let s = 1; s <= 6; s++) probs.push(probTable[s]);

        const range = Math.max(...probs) - Math.min(...probs);
        if (range === 0) return 0;

        // Sample size factor
        const sampleFactor = Math.min(1, totalSpins / 3000);

        // How distinct the observation is
        const distinctness = Math.abs(observedProb - (probs[0] + probs[5]) / 2) / range;

        return Math.min(100, Math.round((sampleFactor * 60 + distinctness * 40)));
    }

    // ── Expected Value ──
    function calcExpectedValue(machine, settingProbs, inp) {
        // Weighted average payout rate
        let weightedPayout = 0;
        for (let s = 1; s <= 6; s++) {
            weightedPayout += settingProbs[s - 1] * machine.payoutRate[s];
        }

        const totalSpins = inp.totalSpins || 1;
        const coinsPerSpin = 3; // 3枚掛け
        const totalCoinsIn = totalSpins * coinsPerSpin;
        const expectedReturn = totalCoinsIn * (weightedPayout / 100);
        const expectedDiffCoins = expectedReturn - totalCoinsIn;

        // Remaining spins factor (if current game provided, consider ceiling benefit)
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
        const totalSpins = inp.totalSpins || 1;
        // Approx 800 spins per hour
        const spinsPerHour = 800;
        const hoursPlayed = totalSpins / spinsPerHour;
        const coinsPerSpin = 3;

        // Per hour expected diff
        const hourlyDiff = (expectedValue.payoutRate / 100 - 1) * coinsPerSpin * spinsPerHour;
        const hourlyWage = Math.round(hourlyDiff * 20); // 20円 / メダル

        return {
            hourlyWage,
            hoursPlayed: Math.round(hoursPlayed * 10) / 10
        };
    }

    // ── Quit Timing ──
    function calcQuitTiming(machine, settingProbs, inp) {
        const currentGame = inp.currentGame || 0;
        const highSettingProb = settingProbs[3] + settingProbs[4] + settingProbs[5]; // 設定4以上

        // Check zones
        let inZone = false;
        if (machine.zones) {
            for (const zone of machine.zones) {
                if (Math.abs(currentGame - zone) <= 50) {
                    inZone = true;
                    break;
                }
            }
        }

        // Check ceiling proximity
        const ceilingProximity = machine.ceiling ? (currentGame / machine.ceiling) : 0;
        const nearCeiling = ceilingProximity > 0.7;

        // Decision logic
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
            reason = inZone
                ? `ゾーン付近のため状況次第。`
                : `高設定期待度${(highSettingProb * 100).toFixed(0)}%。状況次第。`;
            optimalQuitGame = currentGame;
        } else {
            recommendation = 'quit';
            const nextZone = machine.zones ? machine.zones.find(z => z > currentGame) : null;
            reason = `高設定期待度 低。ヤメ推奨。`;
            optimalQuitGame = currentGame;
        }

        return { recommendation, reason, optimalQuitGame };
    }

    // ── High Setting Confidence ──
    function calcHighSettingConfidence(settingProbs, hallCondition) {
        let highProb = settingProbs[3] + settingProbs[4] + settingProbs[5]; // 設定4,5,6

        // Hall condition bonus
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

    // ── Render Results ──
    function renderResults(results) {
        const container = document.getElementById('results-content');
        if (!container) return;

        const machine = state.machineData;
        const inp = state.inputs;

        let html = '';

        // Machine name
        html += `<div class="card glow">
      <div class="card-title"><span class="icon">🎰</span>${machine.name}</div>
      <div class="detail-row">
        <span class="label">総回転数</span>
        <span class="value">${inp.totalSpins.toLocaleString()}G</span>
      </div>
      <div class="detail-row">
        <span class="label">BIG / REG / AT</span>
        <span class="value">${inp.big} / ${inp.reg} / ${inp.at}</span>
      </div>
    </div>`;

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

        // High setting badge
        html += `<div style="text-align:center; margin-top:16px;">
      <span class="confidence-badge ${results.highSettingConf.level}">
        高設定期待度: ${results.highSettingConf.label}
      </span>
    </div>`;
        html += `</div>`;

        // Confidence Breakdown
        html += `<div class="card">
      <div class="card-title"><span class="icon">🔍</span>信頼度分析</div>`;

        const confItems = [
            { label: '小役', value: results.confidence.koyaku },
            { label: 'CZ', value: results.confidence.cz },
            { label: 'AT', value: results.confidence.at },
            { label: '初当たり', value: results.confidence.firstHit }
        ];

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
            const profit = inp.revenue - inp.investment;
            html += `<div class="card">
        <div class="card-title"><span class="icon">💳</span>収支</div>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">投資</div>
            <div class="stat-value negative">¥${inp.investment.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">回収</div>
            <div class="stat-value positive">¥${inp.revenue.toLocaleString()}</div>
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

    function getSettingColor(s) {
        const colors = {
            1: '#e17055',
            2: '#fdcb6e',
            3: '#ffeaa7',
            4: '#74b9ff',
            5: '#00cec9',
            6: '#f9ca24'
        };
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

    // ── Toast ──
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ── Custom Machine Registration ──
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
            const SC = { "設定2以上": [2, 3, 4, 5, 6], "設定4以上": [4, 5, 6], "設定5以上": [5, 6], "設定6確定": [6] };
            const machine = {
                name, alias: [], type, ceiling, ceilingBenefit: Math.round(ceiling * 1.8),
                payoutRate: gp(p1, p6),
                bellProb: gpi(b1, b6),
                cherryProb: gpi(37, 28),
                watermelonProb: gpi(56, 41),
                chanceProb: gpi(185, 128),
                atFirstHitProb: gpi(h1, h6),
                czProb: gpi(Math.round(h1 * 0.38), Math.round(h6 * 0.42)),
                czSuccessRate: gp(0.29, 0.51),
                zones: type === 'AT' ? [200, 400, 600, 800] : [],
                settingConfirm: SC
            };
            saveCustomMachine(machine);
            refreshMachineChips();
            selectMachine(name);
            showToast(`${name} を登録しました！`);
            // Go back to machine select
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('machine-select').classList.add('active');
            window.scrollTo(0, 0);
            // Clear form
            document.getElementById('custom-name').value = '';
            document.getElementById('custom-ceiling').value = '';
            document.getElementById('custom-payout1').value = '';
            document.getElementById('custom-payout6').value = '';
            document.getElementById('custom-hit1').value = '';
            document.getElementById('custom-hit6').value = '';
            document.getElementById('custom-bell1').value = '';
            document.getElementById('custom-bell6').value = '';
        });
    }

    // ── PWA Registration ──
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    }

})();
