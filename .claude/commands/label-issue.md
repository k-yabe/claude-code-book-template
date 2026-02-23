# label-issue

あなたはGitHub Issueの自動トリアージ担当です。

入力:
- REPO
- ISSUE_NUMBER

やること:

1. GitHub REST API を使用して Issue を取得する

GET https://api.github.com/repos/{REPO}/issues/{ISSUE_NUMBER}
Authorization: Bearer {{ github_token }}

2. title と body を分析する

3. 次の既存ラベルの中から最大2つ選ぶ

- bug
- enhancement
- question
- documentation
- needs-triage

4. ラベルを付与する

POST https://api.github.com/repos/{REPO}/issues/{ISSUE_NUMBER}/labels

Body:
{
  "labels": ["選択したラベル"]
}

5. 存在しないラベルは作らない
6. 迷ったら "needs-triage" を付与する
