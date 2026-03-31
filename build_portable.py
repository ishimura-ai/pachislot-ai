#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_portable.py
machines.js + app.js + style.css + index.html を読み込み
pachislot-ai-portable.html として1ファイルに結合するビルドスクリプト。

使い方:
    python build_portable.py

機種DBや計算エンジンを変更した後、このスクリプトを実行すれば
ポータブルHTMLが自動的に最新状態になります。
"""

import os
import re
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def read(filename, encoding='utf-8'):
    with open(os.path.join(BASE_DIR, filename), encoding=encoding) as f:
        return f.read()

def write(filename, content, encoding='utf-8'):
    with open(os.path.join(BASE_DIR, filename), 'w', encoding=encoding, newline='\n') as f:
        f.write(content)
    print(f"  ✓ {filename} ({len(content.encode('utf-8'))//1024} KB)")

# ─── 1. ソースファイル読み込み ───────────────────────────────────────
print("=== パチスロAI ポータブルHTMLビルド ===")
print(f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

css_src     = read('style.css')
machines_src = read('machines.js')
app_src     = read('app.js')
index_src   = read('index.html')

# ─── 2. app.js から Service Worker 登録を除去 ─────────────────────────
# Service Worker登録はポータブル版では不要
app_portable = app_src.replace(
    "if ('serviceWorker' in navigator)",
    "if (false /* SW disabled in portable build */ && 'serviceWorker' in navigator)"
)

# ─── 3. index.html から外部参照を削除してインライン化 ──────────────────
html = index_src

# <link rel="stylesheet" href="style.css"> を削除
html = re.sub(r'<link[^>]+href=["\']style\.css["\'][^>]*>', '', html)
# <link rel="manifest" ...> を削除
html = re.sub(r'<link[^>]+manifest[^>]*>', '', html)
# <script src="machines.js" ...></script> を削除
html = re.sub(r'<script[^>]+src=["\']machines\.js["\'][^>]*>\s*</script>', '', html)
# <script src="app.js" ...></script> を削除
html = re.sub(r'<script[^>]+src=["\']app\.js["\'][^>]*>\s*</script>', '', html)
# Service Worker登録スクリプトを削除
html = re.sub(r"<script>\s*if\s*\('serviceWorker'[^<]*</script>", '', html, flags=re.DOTALL)

# ─── 4. <head> に CSS を埋め込む ───────────────────────────────────────
css_block = '\n  <style>\n' + css_src + '\n  </style>\n'
html = html.replace('</head>', css_block + '</head>', 1)

# ─── 5. </body> の直前にスクリプトを埋め込む ─────────────────────────
build_info = (
    "/* ========================================================\n"
    "   パチスロ設定推測AI - ポータブル版\n"
    f"   Built: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
    "   このファイルは build_portable.py で自動生成されます。\n"
    "   直接編集しないでください。machines.js / app.js を編集してください。\n"
    "   ======================================================== */\n"
)

scripts_block = (
    '\n  <script>\n'
    + build_info
    + '\n// ===== machines.js (インライン) =====\n'
    + machines_src
    + '\n  </script>\n  <script>\n'
    + '// ===== app.js (インライン) =====\n'
    + app_portable
    + '\n  </script>\n'
)

html = html.replace('</body>', scripts_block + '\n</body>', 1)

# ─── 6. タイトル更新 ──────────────────────────────────────────────────
html = re.sub(r'<title>.*?</title>', '<title>パチスロ設定推測AI</title>', html)


# ─── 7. 出力 ──────────────────────────────────────────────────────────
print("出力:")
write('pachislot-ai-portable.html', html)

# ─── 8. 検証 ──────────────────────────────────────────────────────────
print()
print("検証:")
checks = [
    ('MACHINE_DATABASE',         ('機種DBあり',              True)),
    ('logPoissonLL',             ('対数空間エンジンあり',     True)),
    ('genericBayesianEstimation',('ベイズ推定あり',           True)),
    ('calcExpectedValue',        ('期待値計算あり',           True)),
    ('renderResults',            ('レンダリングあり',         True)),
    ('collectAllInputs',         ('フォーム収集あり',         True)),
    ('Lゴッドイーター',          ('ゴッドイーター機種あり',   True)),
    ('秘宝伝',                   ('秘宝伝機種あり',           True)),
    ('スマスロ東京リベンジャーズ',('東リベ機種あり',          True)),
    ('マイジャグラーV',          ('マイジャグラーVあり',      True)),
]
all_ok = True
for keyword, (label, should_exist) in checks:
    found = keyword in html
    ok = found == should_exist
    mark = '✓' if ok else '✗'
    print(f'  {mark} {label}')
    if not ok:
        all_ok = False

print()
if all_ok:
    print("✅ ビルド成功！")
else:
    print("⚠️  一部の検証が失敗しました。ソースを確認してください。")

print(f"   {datetime.now().strftime('%H:%M:%S')} 完了")
