# Favea - 推し活チケット・デッドライン管理

推し活ERP「Favea（ファベア）」のMVP版です。

## 概要

Faveaは、推し活における煩雑なチケット管理・締切管理を効率化するためのアプリケーションです。

### MVP機能

- **AI自動収集**: 推し名を入力するだけで、Web上のチケット情報を自動収集
- **工程ステータス管理**: 抽選待ち→抽選中→入金待ち→確定の4段階管理
- **入金締切アラート**: 当選後の入金漏れを防ぐ通知機能
- **コミュニティ校閲**: AIの情報をコミュニティで検証

## 技術スタック

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: OpenAI/Anthropic API (Phase 2以降)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成
2. 「New Project」をクリックして新規プロジェクトを作成
3. プロジェクト名、データベースパスワード、リージョンを設定

### 3. 環境変数の設定

`.env.local.example`をコピーして`.env.local`を作成:

```bash
cp .env.local.example .env.local
```

Supabaseダッシュボードから以下の値を取得して設定:
- Settings > API > Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Settings > API > Project API keys > anon (public) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. データベースのセットアップ

Supabaseダッシュボードの「SQL Editor」で、`supabase/migrations/001_initial_schema.sql`の内容を実行してテーブルを作成します。

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## ディレクトリ構成

```
favea/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 認証関連ページ
│   │   │   ├── login/          # ログイン
│   │   │   └── signup/         # 新規登録
│   │   ├── (dashboard)/        # メイン機能
│   │   │   └── dashboard/      # ダッシュボード
│   │   └── api/                # API Routes
│   │       └── ai-draft/       # AI収集API
│   ├── components/             # UIコンポーネント
│   │   ├── ui/                 # shadcn/ui コンポーネント
│   │   ├── event-card.tsx      # イベントカード
│   │   ├── event-dialog.tsx    # イベント編集ダイアログ
│   │   ├── ai-collect-dialog.tsx # AI収集ダイアログ
│   │   └── calendar-view.tsx   # カレンダー表示
│   └── lib/
│       ├── supabase/           # Supabaseクライアント
│       ├── types.ts            # 型定義
│       └── utils.ts            # ユーティリティ
└── supabase/
    └── migrations/             # SQLマイグレーション
```

## データベーススキーマ

| テーブル | 用途 |
|---------|------|
| profiles | ユーザー情報（Supabase Authと連携） |
| idols | 推しの対象（人物・グループ・作品） |
| events | イベント情報（AI＋コミュニティ管理） |
| ticket_deadlines | 申込・入金締切 |
| user_events | ユーザー個別の管理ステータス |
| event_verifications | コミュニティ検証記録 |

## チケットステータス

```
not_applied（未申込）
    ↓
applied（申込済）
    ↓
pending（結果待ち）
    ↓
won（当選）/ lost（落選）
    ↓
paid（入金済）
    ↓
confirmed（確定）
```

## ロードマップ

- **Phase 1 (MVP)**: チケットスケジュール管理ツール ← 現在
- **Phase 2**: 予算管理・グッズ在庫管理との連携
- **Phase 3**: 共同購入やコストシェアなどの金融・物流機能

## ライセンス

Private
