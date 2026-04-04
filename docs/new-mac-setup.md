# 新しいMacBookで作業する手順

## 先にやること

1. 現在の作業中コードを GitHub に push する
2. 新しいMacBookに Xcode / Homebrew / nvm を入れる
3. このリポジトリを clone する
4. `.env.local` を作成する
5. `npm install` と `npm run dev:local` で起動確認する

## 必要なもの

- GitHub にアクセスできること
- Node.js 22 系
- npm
- Xcode
- Apple Developer のサインイン情報
- Supabase の環境変数
- Anthropic API Key（画像解析機能を使う場合）
- Vercel のプロジェクト権限（デプロイする場合）

## セットアップ

```bash
git clone https://github.com/naga0033/pokemon-damage-calc.git
cd pokemon-damage-calc
nvm use || nvm install
npm install
cp .env.local.example .env.local
```

その後、`.env.local` に実際の値を入れます。

```bash
npm run dev:local
```

## 環境変数

最低限必要:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

機能によって必要:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET`

## リリース当日に困らないための確認

1. 新しいMacBookで `npm run build` が通る
2. 必要な環境変数をすべて再設定できる
3. Vercel にログインできる
4. Xcode で署名に使うAppleアカウントが使える
5. App Store Connect に入れる
6. GitHub に push できる

## おすすめ運用

- コードは必ず GitHub を正本にする
- `.env.local` は Git 管理に入れず、パスワードマネージャーなどで保管する
- リリース前日までに一度 MacBook 側だけでビルドとデプロイを試す
- 当日に備えて「MacBookだけでどこまでできるか」を事前に確認する
