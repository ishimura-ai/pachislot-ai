// =====================================================
// パチスロ機種データベース（機種特化設定推測対応版）
// =====================================================
function gp(s1, s6) { const d = (s6 - s1) / 5; return { 1: s1, 2: +(s1 + d).toFixed(4), 3: +(s1 + d * 2).toFixed(4), 4: +(s1 + d * 3).toFixed(4), 5: +(s1 + d * 4).toFixed(4), 6: s6 }; }
function gpi(s1, s6) { return { 1: 1 / s1, 2: 1 / +(s1 - (s1 - s6) / 5).toFixed(1), 3: 1 / +(s1 - (s1 - s6) / 5 * 2).toFixed(1), 4: 1 / +(s1 - (s1 - s6) / 5 * 3).toFixed(1), 5: 1 / +(s1 - (s1 - s6) / 5 * 4).toFixed(1), 6: 1 / s6 }; }
const SC = { "設定2以上": [2, 3, 4, 5, 6], "設定4以上": [4, 5, 6], "設定5以上": [5, 6], "設定6確定": [6] };

// ═══════════════════════════════════════════════════════
// 機種特化フィールド定義
// type: 'number' = 数値入力, 'select' = ドロップダウン
// type: 'multi-select' = 複数選択, 'count-pair' = カウント対
// type: 'probability' = 確率入力（回数 or 確率切替）
// weight: ベイズ推定での重み付け (0-10, 高いほど影響大)
// ═══════════════════════════════════════════════════════

const KARAKURI_FIELDS = [
    {
        group: "AT・CZ",
        icon: "🎯",
        fields: [
            {
                key: "atFirstHitCount",
                label: "AT初当たり回数",
                type: "number",
                placeholder: "0",
                weight: 7,
                help: "ATに当選した合計回数",
                probTable: { 1: 1/564, 2: 1/543, 3: 1/506, 4: 1/469, 5: 1/451, 6: 1/447 }
            },
            {
                key: "czCount",
                label: "CZ突入回数",
                type: "number",
                placeholder: "0",
                weight: 5,
                help: "CZ（機械仕掛けの神等）に突入した合計回数",
                probTable: { 1: 1/333, 2: 1/320, 3: 1/306, 4: 1/292, 5: 1/277, 6: 1/275 }
            }
        ]
    },
    {
        group: "からくりレア役・幕間チャンス",
        icon: "🎪",
        fields: [
            {
                key: "karakuriRareCount",
                label: "からくりレア役 発生回数",
                type: "number",
                placeholder: "0",
                weight: 0,
                help: "からくりレア役が発動した合計回数（幕間チャンス抽選の母数）"
            },
            {
                key: "makuaiFromRare",
                label: "幕間チャンス当選回数（レア役契機）",
                type: "number",
                placeholder: "0",
                weight: 10,
                help: "通常時のからくりレア役から幕間チャンスに当選した回数。設定差最大のポイント！",
                // からくりレア役に対する当選率（これは条件付き確率として使う）
                conditionalProbTable: { 1: 0.033, 2: 0.042, 3: 0.055, 4: 0.068, 5: 0.085, 6: 0.10 }
            }
        ]
    },
    {
        group: "AT直撃・モードC",
        icon: "⚡",
        fields: [
            {
                key: "atDirectHit",
                label: "AT直撃回数",
                type: "number",
                placeholder: "0",
                weight: 8,
                help: "CZを経由せずATに直撃した回数（モードC当選含む）",
                probTable: { 1: 1/2700, 2: 1/2400, 3: 1/2100, 4: 1/1800, 5: 1/1600, 6: 1/1500 }
            }
        ]
    },
    {
        group: "AT終了画面",
        icon: "🖼️",
        fields: [
            {
                key: "endScreenFrancine",
                label: "フランシーヌ（設定6濃厚）",
                type: "number",
                placeholder: "0回",
                weight: 10,
                help: "AT終了画面にフランシーヌが出現した回数",
                settingConfirm: [6]
            },
            {
                key: "endScreenShiroganeKatsuNarumi",
                label: "しろがね・勝・鳴海（設定4以上）",
                type: "number",
                placeholder: "0回",
                weight: 9,
                help: "AT終了画面にしろがね・勝・鳴海が出現した回数",
                settingConfirm: [4, 5, 6]
            },
            {
                key: "endScreenAshibanaGuy",
                label: "阿紫花&ギイ（設定2以上）",
                type: "number",
                placeholder: "0回",
                weight: 8,
                help: "AT終了画面に阿紫花&ギイが出現した回数",
                settingConfirm: [2, 3, 4, 5, 6]
            }
        ]
    },
    {
        group: "AT開始ステージ",
        icon: "🎭",
        fields: [
            {
                key: "stageNarumi",
                label: "鳴海ステージ（奇数示唆）",
                type: "number",
                placeholder: "0回",
                weight: 4,
                help: "AT開始時に鳴海ステージだった回数",
                oddEvenHint: "odd"
            },
            {
                key: "stageKatsu",
                label: "勝ステージ（偶数示唆）",
                type: "number",
                placeholder: "0回",
                weight: 4,
                help: "AT開始時に勝ステージだった回数",
                oddEvenHint: "even"
            },
            {
                key: "stageSameRepeat",
                label: "同一ステージ連続（高設定示唆）",
                type: "number",
                placeholder: "0回",
                weight: 6,
                help: "激情ジャッジ成功後にステージが変化せず同一ステージが連続した回数"
            }
        ]
    },
    {
        group: "演出示唆",
        icon: "✨",
        fields: [
            {
                key: "olympiaPlus4",
                label: "オリンピア +4 上乗せ（設定4以上）",
                type: "number",
                placeholder: "0回",
                weight: 9,
                help: "踊れ！オリンピア中に+4が表示された回数",
                settingConfirm: [4, 5, 6]
            },
            {
                key: "olympiaPlus6",
                label: "オリンピア +6 上乗せ（設定6濃厚）",
                type: "number",
                placeholder: "0回",
                weight: 10,
                help: "踊れ！オリンピア中に+6が表示された回数",
                settingConfirm: [6]
            },
            {
                key: "endingLampGreen",
                label: "EDランプ 緑（高設定示唆）",
                type: "number",
                placeholder: "0回",
                weight: 6,
                help: "エンディング中レア役時に緑ランプが光った回数"
            },
            {
                key: "endingLampPurple",
                label: "EDランプ 紫（設定4以上）",
                type: "number",
                placeholder: "0回",
                weight: 9,
                help: "エンディング中レア役時に紫ランプが光った回数",
                settingConfirm: [4, 5, 6]
            },
            {
                key: "endingLampRainbow",
                label: "EDランプ 虹（設定6濃厚）",
                type: "number",
                placeholder: "0回",
                weight: 10,
                help: "エンディング中レア役時に虹ランプが光った回数",
                settingConfirm: [6]
            }
        ]
    }
];

// ═══════════════════════════════════════════════════════
// ★ カバネリ開門決戦 専用フィールド定義
// ═══════════════════════════════════════════════════════
const KABANERI_KAIMON_FIELDS = [
    {
        group: "AT・ボーナス",
        icon: "🎯",
        fields: [
            {
                key: "atFirstHit",
                label: "AT初当たり回数",
                type: "number",
                placeholder: "0",
                weight: 8,
                help: "ATに当選した合計回数（マイスロ: AT回数）",
                probTable: { 1: 1/360, 2: 1/340, 3: 1/310, 4: 1/280, 5: 1/255, 6: 1/230 }
            },
            {
                key: "big",
                label: "BIG回数",
                type: "number",
                placeholder: "0",
                weight: 3,
                help: "BIG当選回数"
            },
            {
                key: "reg",
                label: "REG回数",
                type: "number",
                placeholder: "0",
                weight: 3,
                help: "REG当選回数"
            }
        ]
    },
    {
        group: "CZ",
        icon: "⚡",
        fields: [
            {
                key: "czEntry",
                label: "CZ突入回数",
                type: "number",
                placeholder: "0",
                weight: 6,
                help: "CZ（開門チャレンジ等）に突入した合計回数",
                probTable: { 1: 1/135, 2: 1/125, 3: 1/115, 4: 1/105, 5: 1/95, 6: 1/85 }
            },
            {
                key: "czSuccess",
                label: "CZ成功回数",
                type: "number",
                placeholder: "0",
                weight: 5,
                help: "CZからATに当選した回数"
            }
        ]
    },
    {
        group: "小役確率",
        icon: "🍒",
        fields: [
            {
                key: "bell",
                label: "ベル",
                type: "probability",
                placeholder: "0",
                weight: 6,
                help: "共通ベル回数（マイスロ: ベル確率から算出可）",
                probTable: { 1: 1/7.25, 2: 1/7.05, 3: 1/6.85, 4: 1/6.55, 5: 1/6.25, 6: 1/5.72 }
            },
            {
                key: "weakCherry",
                label: "弱チェリー",
                type: "probability",
                placeholder: "0",
                weight: 5,
                help: "弱チェリー回数（マイスロ: チェリー確率）",
                probTable: { 1: 1/35.8, 2: 1/34.0, 3: 1/32.2, 4: 1/30.2, 5: 1/28.5, 6: 1/26.8 }
            },
            {
                key: "watermelon",
                label: "スイカ",
                type: "probability",
                placeholder: "0",
                weight: 4,
                help: "スイカ回数",
                probTable: { 1: 1/53.5, 2: 1/51.0, 3: 1/48.5, 4: 1/46.0, 5: 1/43.0, 6: 1/39.5 }
            },
            {
                key: "chance",
                label: "チャンス目",
                type: "probability",
                placeholder: "0",
                weight: 4,
                help: "チャンス目回数",
                probTable: { 1: 1/172, 2: 1/162, 3: 1/152, 4: 1/142, 5: 1/132, 6: 1/118 }
            }
        ]
    },
    {
        group: "駿城ボーナス中",
        icon: "🏯",
        fields: [
            {
                key: "bonusATDirect",
                label: "ボーナス中AT直撃",
                type: "number",
                placeholder: "0",
                weight: 7,
                help: "駿城ボーナス中にAT直撃した回数（高設定ほど発生しやすい）",
                probTable: { 1: 1/50, 2: 1/40, 3: 1/33, 4: 1/25, 5: 1/20, 6: 1/15 }
            }
        ]
    },
    {
        group: "終了画面・示唆演出",
        icon: "🖼️",
        fields: [
            {
                key: "endScreenHigh",
                label: "高設定示唆画面",
                type: "number",
                placeholder: "0回",
                weight: 8,
                help: "AT終了画面で高設定を示唆する画面が出た回数"
            },
            {
                key: "endScreenConfirm456",
                label: "設定4以上確定画面",
                type: "number",
                placeholder: "0回",
                weight: 9,
                help: "AT終了画面で設定4以上が確定する画面が出た回数",
                settingConfirm: [4, 5, 6]
            },
            {
                key: "endScreenConfirm6",
                label: "設定6確定画面",
                type: "number",
                placeholder: "0回",
                weight: 10,
                help: "AT終了画面で設定6が確定する画面が出た回数",
                settingConfirm: [6]
            }
        ]
    }
];

// ═══════════════════════════════════════════════════════
// 汎用機種用のフィールド定義
// ═══════════════════════════════════════════════════════
const GENERIC_AT_FIELDS = [
    {
        group: "ボーナス・AT",
        icon: "🎯",
        fields: [
            { key: "big", label: "BIG", type: "number", placeholder: "0", weight: 3 },
            { key: "reg", label: "REG", type: "number", placeholder: "0", weight: 3 },
            { key: "at", label: "AT", type: "number", placeholder: "0", weight: 3 },
            { key: "atFirstHit", label: "AT初当たり回数", type: "number", placeholder: "0", weight: 6 }
        ]
    },
    {
        group: "小役カウント",
        icon: "🍒",
        fields: [
            { key: "bell", label: "ベル", type: "probability", placeholder: "0", weight: 5, help: "回数 or 確率を入力" },
            { key: "weakCherry", label: "弱チェリー", type: "probability", placeholder: "0", weight: 4 },
            { key: "watermelon", label: "スイカ", type: "probability", placeholder: "0", weight: 4 },
            { key: "chance", label: "チャンス目", type: "probability", placeholder: "0", weight: 4 }
        ]
    },
    {
        group: "CZ",
        icon: "⚡",
        fields: [
            { key: "czEntry", label: "CZ突入", type: "number", placeholder: "0", weight: 5 },
            { key: "czSuccess", label: "CZ成功", type: "number", placeholder: "0", weight: 4 }
        ]
    }
];

const GENERIC_A_TYPE_FIELDS = [
    {
        group: "ボーナス",
        icon: "🎯",
        fields: [
            { key: "big", label: "BIG", type: "number", placeholder: "0", weight: 7 },
            { key: "reg", label: "REG", type: "number", placeholder: "0", weight: 7 }
        ]
    },
    {
        group: "小役カウント",
        icon: "🍒",
        fields: [
            { key: "bell", label: "ベル", type: "probability", placeholder: "0", weight: 5 },
            { key: "weakCherry", label: "弱チェリー", type: "probability", placeholder: "0", weight: 6 }
        ]
    }
];


const MACHINE_DATABASE = {
    // ═══════════════════════════════════════
    // ★ からくりサーカス（特化版）
    // ═══════════════════════════════════════
    "からくりサーカス": {
        name: "からくりサーカス",
        alias: ["からくり", "カラクリ"],
        type: "AT",
        ceiling: 999,
        ceilingBenefit: 1800,
        payoutRate: { 1: 97.5, 2: 99.0, 3: 101.5, 4: 105.0, 5: 109.0, 6: 114.9 },
        // からくりは小役（ベル等）に設定差がないが、下記の専用確率テーブルを使用
        atFirstHitProb: { 1: 1/564, 2: 1/543, 3: 1/506, 4: 1/469, 5: 1/451, 6: 1/447 },
        czProb: { 1: 1/333, 2: 1/320, 3: 1/306, 4: 1/292, 5: 1/277, 6: 1/275 },
        // AT直撃（モードC含む）
        atDirectHitProb: { 1: 1/2700, 2: 1/2400, 3: 1/2100, 4: 1/1800, 5: 1/1600, 6: 1/1500 },
        // からくりレア役→幕間チャンス当選率（条件付き確率）
        makuaiFromRareRate: { 1: 0.033, 2: 0.042, 3: 0.055, 4: 0.068, 5: 0.085, 6: 0.10 },
        // 奇偶ステージ選択率
        stageOddRate: { 1: 0.55, 2: 0.40, 3: 0.55, 4: 0.40, 5: 0.55, 6: 0.50 },
        stageEvenRate: { 1: 0.40, 2: 0.55, 3: 0.40, 4: 0.55, 5: 0.40, 6: 0.45 },
        sameStageRepeatRate: { 1: 0.03, 2: 0.04, 3: 0.05, 4: 0.07, 5: 0.10, 6: 0.15 },
        // ED中ランプ出現率
        endingLampGreenRate: { 1: 0.01, 2: 0.02, 3: 0.03, 4: 0.05, 5: 0.08, 6: 0.12 },
        zones: [200, 400, 600, 800],
        settingConfirm: SC,
        // ★ 機種特化フィールド定義
        customFields: KARAKURI_FIELDS,
        // ★ 機種特化ベイズ推定関数名
        customEstimation: "karakuriEstimation"
    },

    // ═══════════════════════════════════════
    // 🆕 2025-2026年 最新台（汎用フィールド使用）
    // ═══════════════════════════════════════
    "スマスロ化物語": { name: "スマスロ化物語", alias: ["化物語", "物語", "バケモノガタリ"], type: "AT", ceiling: 800, ceilingBenefit: 1800, payoutRate: { 1: 98.0, 2: 99.5, 3: 101.8, 4: 105.5, 5: 110.2, 6: 116.0 }, bellProb: gpi(7.20, 5.70), cherryProb: gpi(35.5, 26.5), watermelonProb: gpi(53, 39), chanceProb: gpi(170, 115), atFirstHitProb: gpi(350, 170), czProb: gpi(130, 70), czSuccessRate: gp(0.33, 0.56), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "L北斗の拳 転生": { name: "L北斗の拳 転生", alias: ["北斗転生", "転生", "北斗転生2"], type: "AT", ceiling: 999, ceilingBenefit: 2200, payoutRate: { 1: 97.5, 2: 99.0, 3: 101.2, 4: 105.0, 5: 109.5, 6: 115.5 }, bellProb: gpi(7.40, 5.80), cherryProb: gpi(36.5, 27), watermelonProb: gpi(55, 40), chanceProb: gpi(178, 120), atFirstHitProb: gpi(400, 195), czProb: gpi(148, 80), czSuccessRate: gp(0.30, 0.52), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "Lカバネリ 開門決戦": {
        name: "Lカバネリ 開門決戦",
        alias: ["カバネリ開門", "開門決戦", "カバネリ2"],
        type: "AT",
        ceiling: 800,
        ceilingBenefit: 1900,
        payoutRate: { 1: 97.8, 2: 99.4, 3: 101.7, 4: 105.5, 5: 110.0, 6: 116.2 },
        bellProb: gpi(7.25, 5.72),
        cherryProb: gpi(35.8, 26.8),
        watermelonProb: gpi(53.5, 39.5),
        chanceProb: gpi(172, 118),
        atFirstHitProb: gpi(360, 230),
        czProb: gpi(135, 85),
        czSuccessRate: gp(0.32, 0.55),
        bonusATDirectProb: { 1: 1/50, 2: 1/40, 3: 1/33, 4: 1/25, 5: 1/20, 6: 1/15 },
        zones: [200, 400, 600],
        settingConfirm: SC,
        customFields: KABANERI_KAIMON_FIELDS,
        customEstimation: "kabaneriKaimonEstimation",
        // ★ マイスロOCR設定
        mySlotConfig: {
            enabled: true,
            machineName: "カバネリ 開門決戦",
            maker: "sammy",
            // マイスロで取得できるデータ項目とOCR用パターン
            dataMap: [
                { key: "totalSpins",  label: "総回転数",     patterns: [/(?:総回転|TOTAL|合計|回転数|G数|ゲーム数)[^\d]*(\d[\d,.]{0,8})/i, /(\d[\d,.]{2,6})\s*(?:回転|G\b|ゲーム)/] },
                { key: "atFirstHit",  label: "AT回数",       patterns: [/(?:AT|ART|AT回数|AT初当)[^\d]*(\d{1,4})/i, /(?:初当[たり]*)[^\d]*(\d{1,4})/] },
                { key: "big",         label: "BIG",          patterns: [/BIG[^\d]*(\d{1,4})/i] },
                { key: "reg",         label: "REG",          patterns: [/REG[^\d]*(\d{1,4})/i] },
                { key: "czEntry",     label: "CZ",           patterns: [/(?:CZ|チャンスゾーン)[^\d]*(\d{1,4})/i] },
                { key: "bell",        label: "ベル",         patterns: [/(?:ベル|bell)[^\d]*1[/／](\d+\.?\d*)/i, /(?:ベル|bell)[^\d]*(\d{1,5})/i] },
                { key: "weakCherry",  label: "弱チェリー",   patterns: [/(?:弱チェ|弱チェリー|チェリー)[^\d]*1[/／](\d+\.?\d*)/i, /(?:弱チェ|弱チェリー)[^\d]*(\d{1,5})/i] },
                { key: "watermelon",  label: "スイカ",       patterns: [/(?:スイカ|すいか)[^\d]*1[/／](\d+\.?\d*)/i, /(?:スイカ|すいか)[^\d]*(\d{1,5})/i] },
                { key: "chance",      label: "チャンス目",   patterns: [/(?:チャンス目|チャンス|chance)[^\d]*1[/／](\d+\.?\d*)/i, /(?:チャンス目)[^\d]*(\d{1,5})/i] },
                { key: "diffCoins",   label: "差枚",         patterns: [/(?:差枚|差玉|DIFF)[^\d-]*([+-]?\d[\d,.]{0,6})/i, /([+-]\d[\d,.]{0,6})\s*(?:枚|玉)/] }
            ]
        }
    },
    "L呪術廻戦": { name: "L呪術廻戦", alias: ["呪術", "呪術廻戦", "じゅじゅつ"], type: "AT", ceiling: 999, ceilingBenefit: 2100, payoutRate: { 1: 97.2, 2: 98.8, 3: 101.0, 4: 105.0, 5: 109.8, 6: 116.0 }, bellProb: gpi(7.50, 5.85), cherryProb: gpi(37, 27.5), watermelonProb: gpi(55.5, 40.5), chanceProb: gpi(185, 125), atFirstHitProb: gpi(410, 200), czProb: gpi(150, 82), czSuccessRate: gp(0.29, 0.52), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "L鬼滅の刃": { name: "L鬼滅の刃", alias: ["鬼滅", "きめつ", "鬼滅の刃"], type: "AT", ceiling: 999, ceilingBenefit: 2200, payoutRate: { 1: 97.0, 2: 98.5, 3: 100.8, 4: 104.8, 5: 109.5, 6: 116.5 }, bellProb: gpi(7.55, 5.88), cherryProb: gpi(37.5, 27.5), watermelonProb: gpi(56, 41), chanceProb: gpi(188, 126), atFirstHitProb: gpi(420, 205), czProb: gpi(155, 84), czSuccessRate: gp(0.28, 0.51), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "Lチェンソーマン": { name: "Lチェンソーマン", alias: ["チェンソー", "チェンソーマン", "CSM"], type: "AT", ceiling: 999, ceilingBenefit: 2000, payoutRate: { 1: 97.3, 2: 98.9, 3: 101.2, 4: 105.2, 5: 109.8, 6: 115.8 }, bellProb: gpi(7.45, 5.82), cherryProb: gpi(37, 27), watermelonProb: gpi(55, 40), chanceProb: gpi(182, 123), atFirstHitProb: gpi(405, 198), czProb: gpi(148, 80), czSuccessRate: gp(0.30, 0.53), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "L推しの子": { name: "L推しの子", alias: ["推しの子", "おしのこ"], type: "AT", ceiling: 800, ceilingBenefit: 1700, payoutRate: { 1: 97.8, 2: 99.5, 3: 101.8, 4: 105.3, 5: 109.5, 6: 115.2 }, bellProb: gpi(7.30, 5.78), cherryProb: gpi(36, 26.8), watermelonProb: gpi(54, 40), chanceProb: gpi(175, 120), atFirstHitProb: gpi(370, 182), czProb: gpi(138, 75), czSuccessRate: gp(0.32, 0.55), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "Lワンパンマン": { name: "Lワンパンマン", alias: ["ワンパン", "ワンパンマン"], type: "AT", ceiling: 999, ceilingBenefit: 1900, payoutRate: { 1: 97.5, 2: 99.2, 3: 101.5, 4: 105.2, 5: 109.5, 6: 115.5 }, bellProb: gpi(7.40, 5.82), cherryProb: gpi(36.5, 27), watermelonProb: gpi(55, 40.5), chanceProb: gpi(180, 122), atFirstHitProb: gpi(395, 195), czProb: gpi(145, 79), czSuccessRate: gp(0.31, 0.53), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "スマスロ刃牙": { name: "スマスロ刃牙", alias: ["刃牙", "バキ"], type: "AT", ceiling: 999, ceilingBenefit: 1800, payoutRate: { 1: 97.6, 2: 99.3, 3: 101.5, 4: 105.0, 5: 109.2, 6: 115.0 }, bellProb: gpi(7.42, 5.85), cherryProb: gpi(36.8, 27.2), watermelonProb: gpi(55.2, 40.8), chanceProb: gpi(182, 124), atFirstHitProb: gpi(398, 198), czProb: gpi(146, 80), czSuccessRate: gp(0.30, 0.53), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "Lガンダムシード": { name: "Lガンダムシード", alias: ["ガンダムSEED", "SEED", "シード"], type: "AT", ceiling: 999, ceilingBenefit: 2000, payoutRate: { 1: 97.3, 2: 98.9, 3: 101.2, 4: 105.0, 5: 109.5, 6: 115.5 }, bellProb: gpi(7.48, 5.85), cherryProb: gpi(37, 27.2), watermelonProb: gpi(55.5, 40.5), chanceProb: gpi(184, 125), atFirstHitProb: gpi(405, 200), czProb: gpi(150, 82), czSuccessRate: gp(0.29, 0.52), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },

    // ═══════════════════════════════════════
    // 定番・人気機種
    // ═══════════════════════════════════════
    "スマスロ北斗の拳": { name: "スマスロ北斗の拳", alias: ["北斗", "北斗の拳", "スマスロ北斗"], type: "AT", ceiling: 1268, ceilingBenefit: 2400, payoutRate: { 1: 97.9, 2: 99.2, 3: 101.3, 4: 104.8, 5: 108.4, 6: 114.1 }, bellProb: gpi(7.30, 5.90), cherryProb: gpi(36, 30), watermelonProb: gpi(55, 42), chanceProb: gpi(180, 140), atFirstHitProb: gpi(430, 250), czProb: gpi(160, 95), czSuccessRate: gp(0.30, 0.48), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "ヴァルヴレイヴ": { name: "ヴァルヴレイヴ", alias: ["ヴヴヴ", "VVV", "革命機"], type: "AT", ceiling: 999, ceilingBenefit: 2000, payoutRate: { 1: 97.0, 2: 98.8, 3: 101.0, 4: 105.5, 5: 110.0, 6: 116.0 }, bellProb: gpi(7.80, 5.90), cherryProb: gpi(40, 28), watermelonProb: gpi(60, 42), chanceProb: gpi(200, 135), atFirstHitProb: gpi(450, 230), czProb: gpi(170, 95), czSuccessRate: gp(0.25, 0.48), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "モンキーターン": { name: "モンキーターン", alias: ["モンキー"], type: "AT", ceiling: 800, ceilingBenefit: 1500, payoutRate: { 1: 97.8, 2: 99.5, 3: 101.8, 4: 105.2, 5: 109.5, 6: 114.5 }, bellProb: gpi(7.40, 6.00), cherryProb: gpi(37, 27.5), watermelonProb: gpi(56, 41), chanceProb: gpi(185, 125), atFirstHitProb: gpi(380, 190), czProb: gpi(145, 80), czSuccessRate: gp(0.30, 0.52), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "甲鉄城のカバネリ": { name: "甲鉄城のカバネリ", alias: ["カバネリ"], type: "AT", ceiling: 999, ceilingBenefit: 1900, payoutRate: { 1: 97.8, 2: 99.4, 3: 101.6, 4: 105.3, 5: 109.8, 6: 115.5 }, bellProb: gpi(7.35, 5.85), cherryProb: gpi(36.5, 27), watermelonProb: gpi(54, 40), chanceProb: gpi(175, 120), atFirstHitProb: gpi(390, 195), czProb: gpi(142, 78), czSuccessRate: gp(0.31, 0.53), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "バジリスク絆2": { name: "バジリスク絆2", alias: ["バジリスク", "絆2", "絆"], type: "AT", ceiling: 800, ceilingBenefit: 1600, payoutRate: { 1: 97.4, 2: 99.0, 3: 101.2, 4: 104.8, 5: 108.5, 6: 114.2 }, bellProb: gpi(7.55, 6.05), cherryProb: gpi(38.5, 29), watermelonProb: gpi(57, 43), chanceProb: gpi(192, 135), atFirstHitProb: gpi(410, 210), czProb: gpi(152, 86), czSuccessRate: gp(0.28, 0.49), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "Re:ゼロ": { name: "Re:ゼロ", alias: ["リゼロ", "レゼロ", "re:zero"], type: "AT", ceiling: 999, ceilingBenefit: 2000, payoutRate: { 1: 97.0, 2: 98.5, 3: 100.8, 4: 104.5, 5: 109.0, 6: 115.8 }, bellProb: gpi(7.70, 5.95), cherryProb: gpi(39.5, 28.5), watermelonProb: gpi(59, 42), chanceProb: gpi(198, 130), atFirstHitProb: gpi(440, 220), czProb: gpi(165, 90), czSuccessRate: gp(0.26, 0.48), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "コードギアス": { name: "コードギアス", alias: ["ギアス", "コドギア"], type: "AT", ceiling: 999, ceilingBenefit: 1800, payoutRate: { 1: 97.6, 2: 99.2, 3: 101.4, 4: 105.0, 5: 109.3, 6: 115.0 }, bellProb: gpi(7.45, 5.90), cherryProb: gpi(37, 27.5), watermelonProb: gpi(55, 40.5), chanceProb: gpi(182, 125), atFirstHitProb: gpi(395, 200), czProb: gpi(148, 82), czSuccessRate: gp(0.30, 0.52), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "押忍!番長ZERO": { name: "押忍!番長ZERO", alias: ["番長ZERO", "番長", "番長0"], type: "AT", ceiling: 800, ceilingBenefit: 1500, payoutRate: { 1: 97.7, 2: 99.3, 3: 101.5, 4: 105.0, 5: 109.2, 6: 114.8 }, bellProb: gpi(7.40, 5.90), cherryProb: gpi(36.5, 27), watermelonProb: gpi(54, 40), chanceProb: gpi(178, 122), atFirstHitProb: gpi(370, 185), czProb: gpi(140, 78), czSuccessRate: gp(0.32, 0.54), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "魔法少女まどか☆マギカ": { name: "魔法少女まどか☆マギカ", alias: ["まどマギ", "まどか", "マギカ"], type: "AT", ceiling: 999, ceilingBenefit: 2000, payoutRate: { 1: 97.2, 2: 98.8, 3: 101.0, 4: 104.8, 5: 109.2, 6: 115.5 }, bellProb: gpi(7.60, 5.90), cherryProb: gpi(39, 28), watermelonProb: gpi(58, 41), chanceProb: gpi(195, 128), atFirstHitProb: gpi(430, 215), czProb: gpi(160, 88), czSuccessRate: gp(0.27, 0.50), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "沖ドキ!GOLD": { name: "沖ドキ!GOLD", alias: ["沖ドキ", "沖ドキゴールド"], type: "AT", ceiling: 999, ceilingBenefit: 1600, payoutRate: { 1: 97.8, 2: 99.5, 3: 101.8, 4: 105.2, 5: 109.0, 6: 114.5 }, bellProb: gpi(7.38, 5.88), cherryProb: gpi(36, 26.5), watermelonProb: gpi(53, 39), chanceProb: gpi(175, 120), atFirstHitProb: gpi(370, 185), czProb: gpi(138, 76), czSuccessRate: gp(0.32, 0.55), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "転生したらスライムだった件": { name: "転生したらスライムだった件", alias: ["転スラ", "スライム"], type: "AT", ceiling: 999, ceilingBenefit: 1800, payoutRate: { 1: 97.3, 2: 99.0, 3: 101.3, 4: 104.9, 5: 109.2, 6: 115.0 }, bellProb: gpi(7.55, 5.95), cherryProb: gpi(38, 28), watermelonProb: gpi(56.5, 41), chanceProb: gpi(188, 126), atFirstHitProb: gpi(405, 205), czProb: gpi(152, 84), czSuccessRate: gp(0.28, 0.50), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "ソードアートオンライン": { name: "ソードアートオンライン", alias: ["SAO"], type: "AT", ceiling: 999, ceilingBenefit: 1800, payoutRate: { 1: 97.4, 2: 99.1, 3: 101.4, 4: 105.0, 5: 109.1, 6: 115.1 }, bellProb: gpi(7.50, 5.92), cherryProb: gpi(37.5, 27.5), watermelonProb: gpi(55.5, 40.5), chanceProb: gpi(184, 125), atFirstHitProb: gpi(400, 200), czProb: gpi(148, 82), czSuccessRate: gp(0.30, 0.52), zones: [200, 400, 600, 800], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },
    "L新・番長4": { name: "L新・番長4", alias: ["番長4", "新番長"], type: "AT", ceiling: 800, ceilingBenefit: 1700, payoutRate: { 1: 97.8, 2: 99.5, 3: 101.8, 4: 105.5, 5: 109.8, 6: 115.5 }, bellProb: gpi(7.28, 5.75), cherryProb: gpi(35.8, 26.5), watermelonProb: gpi(53.5, 39.5), chanceProb: gpi(172, 118), atFirstHitProb: gpi(358, 175), czProb: gpi(132, 72), czSuccessRate: gp(0.33, 0.56), zones: [200, 400, 600], settingConfirm: SC, customFields: GENERIC_AT_FIELDS },

    // ═══════════════════════════════════════
    // Aタイプ
    // ═══════════════════════════════════════
    "マイジャグラーV": { name: "マイジャグラーV", alias: ["マイジャグ", "ジャグラー", "マイジャグラー"], type: "Aタイプ", ceiling: 0, ceilingBenefit: 0, payoutRate: { 1: 97.0, 2: 98.7, 3: 100.9, 4: 104.1, 5: 106.6, 6: 109.4 }, bellProb: gpi(7.30, 5.80), cherryProb: gpi(36.0, 33.0), watermelonProb: gpi(55, 55), chanceProb: gpi(180, 180), atFirstHitProb: gpi(290, 130), czProb: gpi(999, 999), czSuccessRate: gp(0, 0), zones: [], settingConfirm: SC, customFields: GENERIC_A_TYPE_FIELDS },
    "ファンキージャグラー2": { name: "ファンキージャグラー2", alias: ["ファンキー", "ファンジャグ"], type: "Aタイプ", ceiling: 0, ceilingBenefit: 0, payoutRate: { 1: 97.0, 2: 98.5, 3: 100.5, 4: 103.5, 5: 106.5, 6: 109.0 }, bellProb: gpi(7.35, 5.85), cherryProb: gpi(36.5, 33.5), watermelonProb: gpi(55, 55), chanceProb: gpi(180, 180), atFirstHitProb: gpi(295, 132), czProb: gpi(999, 999), czSuccessRate: gp(0, 0), zones: [], settingConfirm: SC, customFields: GENERIC_A_TYPE_FIELDS },
    "ハナビ": { name: "ハナビ", alias: ["花火"], type: "Aタイプ", ceiling: 0, ceilingBenefit: 0, payoutRate: { 1: 97.5, 2: 99.0, 3: 101.0, 4: 104.0, 5: 107.0, 6: 110.0 }, bellProb: gpi(7.30, 5.80), cherryProb: gpi(35.0, 32.0), watermelonProb: gpi(55, 55), chanceProb: gpi(180, 180), atFirstHitProb: gpi(280, 125), czProb: gpi(999, 999), czSuccessRate: gp(0, 0), zones: [], settingConfirm: SC, customFields: GENERIC_A_TYPE_FIELDS },
    "ディスクアップ2": { name: "ディスクアップ2", alias: ["ディスクアップ", "ディスク"], type: "Aタイプ", ceiling: 0, ceilingBenefit: 0, payoutRate: { 1: 97.8, 2: 99.4, 3: 101.5, 4: 104.5, 5: 107.5, 6: 110.5 }, bellProb: gpi(7.28, 5.78), cherryProb: gpi(35.5, 32.5), watermelonProb: gpi(55, 55), chanceProb: gpi(180, 180), atFirstHitProb: gpi(275, 122), czProb: gpi(999, 999), czSuccessRate: gp(0, 0), zones: [], settingConfirm: SC, customFields: GENERIC_A_TYPE_FIELDS }
};

// ═══════════════════════════════════════════════════════
// ★ 全AT機種に汎用マイスロ/写真解析を自動付与
// ═══════════════════════════════════════════════════════
const GENERIC_MYSLOT_CONFIG = {
    enabled: true,
    machineName: "",
    maker: "generic",
    dataMap: [
        { key: "totalSpins",  label: "総回転数",     patterns: [/(?:総回転|TOTAL|合計|回転数|G数|ゲーム数)[^\d]*(\d[\d,.]{0,8})/i, /(\d[\d,.]{2,6})\s*(?:回転|G\b|ゲーム)/] },
        { key: "atFirstHit",  label: "AT回数",       patterns: [/(?:AT|ART|AT回数|AT初当)[^\d]*(\d{1,4})/i, /(?:初当[たり]*)[^\d]*(\d{1,4})/] },
        { key: "big",         label: "BIG",          patterns: [/BIG[^\d]*(\d{1,4})/i, /(?:ビッグ|ビック)[^\d]*(\d{1,4})/] },
        { key: "reg",         label: "REG",          patterns: [/REG[^\d]*(\d{1,4})/i, /(?:レギュラー|レグ)[^\d]*(\d{1,4})/] },
        { key: "czEntry",     label: "CZ",           patterns: [/(?:CZ|チャンスゾーン|チャレンジ)[^\d]*(\d{1,4})/i] },
        { key: "bell",        label: "ベル",         patterns: [/(?:ベル|bell)[^\d]*1[/／](\d+\.?\d*)/i, /(?:ベル|bell)[^\d]*(\d{1,5})/i] },
        { key: "weakCherry",  label: "弱チェリー",   patterns: [/(?:弱チェ|弱チェリー|チェリー)[^\d]*1[/／](\d+\.?\d*)/i, /(?:弱チェ|弱チェリー|チェリー)[^\d]*(\d{1,5})/i] },
        { key: "watermelon",  label: "スイカ",       patterns: [/(?:スイカ|すいか)[^\d]*1[/／](\d+\.?\d*)/i, /(?:スイカ|すいか)[^\d]*(\d{1,5})/i] },
        { key: "chance",      label: "チャンス目",   patterns: [/(?:チャンス目|チャンス|chance)[^\d]*1[/／](\d+\.?\d*)/i, /(?:チャンス目|チャンス)[^\d]*(\d{1,5})/i] },
        { key: "diffCoins",   label: "差枚",         patterns: [/(?:差枚|差玉|DIFF|収支)[^\d-]*([+-]?\d[\d,.]{0,6})/i, /([+-]\d[\d,.]{0,6})\s*(?:枚|玉|円)/] }
    ]
};

function initMySlotForAllMachines() {
    for (const key in MACHINE_DATABASE) {
        const m = MACHINE_DATABASE[key];
        if (m.type === 'AT' && !m.mySlotConfig) {
            m.mySlotConfig = {
                ...GENERIC_MYSLOT_CONFIG,
                machineName: m.name,
                enabled: true
            };
        }
    }
}
initMySlotForAllMachines();

// ── カスタム機種の読み込み ──
function loadCustomMachines() {
    try {
        const saved = localStorage.getItem('customMachines');
        if (saved) {
            const customs = JSON.parse(saved);
            for (const key in customs) {
                MACHINE_DATABASE[key] = customs[key];
            }
        }
    } catch (e) { console.warn('カスタム機種読込失敗', e); }
}
loadCustomMachines();

// ── カスタム機種の保存 ──
function saveCustomMachine(machine) {
    MACHINE_DATABASE[machine.name] = machine;
    try {
        const saved = localStorage.getItem('customMachines');
        const customs = saved ? JSON.parse(saved) : {};
        customs[machine.name] = machine;
        localStorage.setItem('customMachines', JSON.stringify(customs));
    } catch (e) { console.warn('カスタム機種保存失敗', e); }
}

function deleteCustomMachine(name) {
    delete MACHINE_DATABASE[name];
    try {
        const saved = localStorage.getItem('customMachines');
        if (saved) {
            const customs = JSON.parse(saved);
            delete customs[name];
            localStorage.setItem('customMachines', JSON.stringify(customs));
        }
    } catch (e) { }
}

function findMachine(query) {
    query = query.trim();
    if (MACHINE_DATABASE[query]) return MACHINE_DATABASE[query];
    for (const key in MACHINE_DATABASE) {
        const m = MACHINE_DATABASE[key];
        if (m.alias && m.alias.some(a => a === query)) return m;
    }
    for (const key in MACHINE_DATABASE) {
        if (key.includes(query)) return MACHINE_DATABASE[key];
        const m = MACHINE_DATABASE[key];
        if (m.alias && m.alias.some(a => a.includes(query) || query.includes(a))) return m;
    }
    return null;
}

function getMachineList() {
    return Object.keys(MACHINE_DATABASE);
}
