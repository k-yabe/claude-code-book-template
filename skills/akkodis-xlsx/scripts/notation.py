"""AKKODiS 表記ルールの自動補正モジュール。

`brand/notation-rules.md` で定義されているルールのうち、機械的に置換可能なものを
プログラムで自動修正する。Claude が見落としても、生成スクリプトの最終段でこの関数を
通せば必ず正しい表記に揃う。

判定が難しいもの（同音異義語の使い分け、文脈依存のひらがな化など）は対象外で、
そういった項目は Claude 側のレビューに任せる。

使い方:
    from notation import correct
    text = correct("Akkodisで、御社にご提案させて頂きます。")
    # → "AKKODiSで、御社にご提案させていただきます。"
"""

from __future__ import annotations

import re
from typing import Iterable, Tuple

# (pattern, replacement) のペア。順序が重要。
# 機械的に「常に正しい」置換のみを記載する（文脈依存のものは含めない）。
_SUBSTITUTIONS: list[Tuple[str, str]] = [
    # ── 固有名詞（B. AKKODiSブランドガイドライン）──────────────────────
    # AKKODiS 固有名詞: 大文字小文字を厳密に
    (r"(?<![A-Za-z])Akkodis(?![A-Za-z])", "AKKODiS"),
    (r"(?<![A-Za-z])AKKODIS(?![A-Za-z])", "AKKODiS"),
    (r"(?<![A-Za-z])akkodis(?![A-Za-z])", "AKKODiS"),
    # AKKODiS innovation Lab. の i は小文字
    (r"AKKODiS\s+Innovation\s+Lab\.?", "AKKODiS innovation Lab."),
    # ── Microsoft 表記（C）──────────────────────────────────────────
    # 注: \b は日本語との境界では効かないため、ASCII 限定の lookahead/behind を使う
    (r"(?<![A-Za-z])microsoft(?![A-Za-z])", "Microsoft"),
    (r"(?<![A-Za-z])MicrosoftPowerPlatform(?![A-Za-z])", "Microsoft Power Platform"),
    (r"(?<![A-Za-z])PowerPlatform(?![A-Za-z])", "Power Platform"),
    (r"(?<![A-Za-z])PowerAutomate(?![A-Za-z])", "Power Automate"),
    (r"(?<![A-Za-z])PowerApps(?![A-Za-z])", "Power Apps"),
    (r"(?<![A-Za-z])PowerBI(?![A-Za-z])", "Power BI"),
    (r"(?<![A-Za-z])CopilotStudio(?![A-Za-z])", "Copilot Studio"),
    (r"(?<![A-Za-z])copilot(?![A-Za-z])", "Copilot"),
    (r"(?<![A-Za-z])Microsoft365\s+Copilot(?![A-Za-z])", "Microsoft 365 Copilot"),
    (r"(?<![A-Za-z])Sharepoint(?![A-Za-z])", "SharePoint"),
    (r"(?<![A-Za-z])Clip\s+champ(?![A-Za-z])", "Clipchamp"),
    (r"(?<![A-Za-z])Power\s+point(?![A-Za-z])", "PowerPoint"),
    (r"(?<![A-Za-z])Power\s+Point(?![A-Za-z])", "PowerPoint"),
    (r"(?<![A-Za-z])One\s+Note(?![A-Za-z])", "OneNote"),
    (r"(?<![A-Za-z])onenote(?![A-Za-z])", "OneNote"),
    (r"(?<![A-Za-z])Azure\s+AD(?![A-Za-z])", "Entra ID"),
    # ── IOWN®（D）── 単体「IOWN」の後ろに何も続かないものは ®。複合語はそのまま ──
    # 「IOWN®構想」「IOWN®ソリューション」のような誤りも修正
    (
        r"IOWN®(構想|推進室|構想基礎研修|ソリューション|プロジェクト|プラットフォーム)",
        r"IOWN\1",
    ),
    # IOWN GLOBAL FORUM は ™
    (r"IOWN\s+GLOBAL\s+FORUM(?!™)", "IOWN GLOBAL FORUM™"),
    # IOWN 単体: 後ろがアルファベット/®/付属語複合語の構成要素でなければ ® を付ける
    # 付属語: 構想 / 推進室 / ソリューション / プロジェクト / プラットフォーム / 基礎研修 等
    (
        r"IOWN(?![®A-Za-z]|構想|推進室|ソリューション|プロジェクト|プラットフォーム|基礎研修)",
        "IOWN®",
    ),
    # ── 接続詞・副詞のひらがな化（A 第1章・第8章のうち機械的に安全なもの）──
    (r"(?<![一最])及び", "および"),
    (r"並びに", "ならびに"),
    (r"若しくは", "もしくは"),
    (r"但し", "ただし"),
    (r"(?<![。、])従って", "したがって"),
    (r"何故", "なぜ"),
    (r"何故なら", "なぜなら"),
    (r"例えば", "たとえば"),
    (r"勿論", "もちろん"),
    (r"兎に角", "とにかく"),
    (r"流石", "さすが"),
    (r"様々", "さまざま"),
    (r"暫く", "しばらく"),
    (r"既に", "すでに"),
    (r"全て(?![がのは])", "すべて"),  # 「全て」を「すべて」へ（後続の助詞に注意）
    (r"折角", "せっかく"),
    (r"沢山", "たくさん"),
    (r"丁度", "ちょうど"),
    (r"何処", "どこ"),
    (r"中々", "なかなか"),
    (r"殆ど", "ほとんど"),
    (r"益々", "ますます"),
    (r"皆様", "皆さま"),
    (r"是非", "ぜひ"),
    (r"概ね", "おおむね"),
    (r"早速", "さっそく"),
    (r"大抵", "たいてい"),
    (r"勿体ない", "もったいない"),
    (r"予め", "あらかじめ"),
    (r"或いは", "あるいは"),
    (r"挨拶", "あいさつ"),
    (r"曖昧", "あいまい"),
    (r"何卒", "なにとぞ"),
    (r"宜しく", "よろしく"),
    (r"宜しい", "よろしい"),
    # ── 形式名詞・補助動詞のひらがな化（A 第7章のうち安全なもの）─────
    (r"頂きます", "いただきます"),
    (r"頂いて", "いただいて"),
    (r"頂いた", "いただいた"),
    (r"頂ける", "いただける"),
    (r"頂きたい", "いただきたい"),
    (r"頂く", "いただく"),
    (r"下さい(?![ま])", "ください"),
    (r"致します", "いたします"),
    (r"致しました", "いたしました"),
    (r"致す", "いたす"),
    # ── 送り仮名（A 第3章のうち頻出かつ安全なもの）──────────────────
    (r"行なう", "行う"),
    (r"行ないます", "行います"),
    (r"行なった", "行った"),
    (r"表わす", "表す"),
    (r"打合せ", "打ち合わせ"),
    (r"打ち合せ", "打ち合わせ"),
    (r"問合せ", "問い合わせ"),
    (r"問合わせ", "問い合わせ"),
    (r"取扱い", "取り扱い"),
    (r"取組み", "取り組み"),
    (r"申込み(?!書)", "申し込み"),
    (r"差支え", "差し支え"),
    # ── 重複表現（A 第10章のうち代表例）──────────────────────────
    (r"まず最初に", "まず"),
    (r"一番最初", "最初"),
    (r"頭痛が痛い", "頭が痛い"),
    (r"今の現状", "現状"),
    (r"あらかじめ予約", "予約"),
    (r"まだ未定", "未定"),
    (r"まだ未完成", "未完成"),
    # ── 敬語の二重敬語（A 第15章）──────────────────────────────
    (r"おっしゃられ", "おっしゃ"),
    (r"ご覧になられ", "ご覧になっ"),
    (r"お越しになられ", "お越しになっ"),
    (r"拝見させていただき", "拝見し"),
    (r"伺わせていただき", "伺い"),
    (r"とんでもございません", "とんでもないことです"),
    (r"すいません", "すみません"),
    (r"ご確認してください", "ご確認ください"),
    # ── 句読点・記号（A 第18章のうち安全なもの）──────────────────
    (r"\.\.\.", "……"),  # 半角3点 → 三点リーダー2連
    (r"。。。", "……"),
    (r"・・・", "……"),
    # ── 数字（A 第19章のうち安全なもの）─────────────────────────
    # 全角数字 → 半角（業務文書ではほぼ常に正しい）
    *[(chr(0xFF10 + i), str(i)) for i in range(10)],
]


def correct(text: str) -> str:
    """テキストに自動補正を適用する。`text` が空なら空を返す。"""
    if not text:
        return text
    out = text
    for pattern, repl in _SUBSTITUTIONS:
        out = re.sub(pattern, repl, out)
    return out


def correct_lines(lines: Iterable[str]) -> list[str]:
    """行のイテラブルを補正する。"""
    return [correct(line) for line in lines]


def diff_summary(before: str, after: str) -> list[str]:
    """補正前後の差分を「before → after」のリストで返す（デバッグ用）。"""
    if before == after:
        return []
    diffs = []
    # 簡易: 各置換ルールでのマッチ数
    for pattern, repl in _SUBSTITUTIONS:
        matches = re.findall(pattern, before)
        if matches:
            for m in matches:
                m_str = m if isinstance(m, str) else "".join(m) if m else ""
                diffs.append(f"{m_str} → {repl}")
    return diffs


__all__ = ["correct", "correct_lines", "diff_summary"]
