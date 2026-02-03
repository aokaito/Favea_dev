-- Favea Initial Schema
-- チケット・締切管理システムのデータベース構造

-- 1. profiles テーブル（ユーザープロフィール）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. idols テーブル（推し/アーティスト）
CREATE TABLE IF NOT EXISTS idols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  official_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. events テーブル（イベント情報）
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id UUID NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  venue TEXT,
  source_url TEXT,
  is_draft BOOLEAN DEFAULT TRUE,
  verified_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ticket_deadlines テーブル（締切情報）
CREATE TABLE IF NOT EXISTS ticket_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  deadline_type TEXT NOT NULL CHECK (deadline_type IN ('lottery_start', 'lottery_end', 'payment')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. user_events テーブル（ユーザーのイベント管理）
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_applied' CHECK (status IN ('not_applied', 'applied', 'pending', 'won', 'lost', 'paid', 'confirmed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_events_idol_id ON events(idol_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_ticket_deadlines_event_id ON ticket_deadlines(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_deadlines_end_at ON ticket_deadlines(end_at);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_id ON user_events(event_id);
CREATE INDEX IF NOT EXISTS idx_idols_name ON idols(name);

-- RLS (Row Level Security) を有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE idols ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLSポリシー: idols（全員が閲覧可能、認証ユーザーが作成可能）
CREATE POLICY "Anyone can view idols" ON idols
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create idols" ON idols
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLSポリシー: events（全員が閲覧可能、認証ユーザーが作成可能）
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators can update own events" ON events
  FOR UPDATE USING (auth.uid() = created_by);

-- RLSポリシー: ticket_deadlines（全員が閲覧可能）
CREATE POLICY "Anyone can view deadlines" ON ticket_deadlines
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create deadlines" ON ticket_deadlines
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLSポリシー: user_events（自分のデータのみ）
CREATE POLICY "Users can view own user_events" ON user_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own user_events" ON user_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_events" ON user_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_events" ON user_events
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_idols_updated_at
  BEFORE UPDATE ON idols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_deadlines_updated_at
  BEFORE UPDATE ON ticket_deadlines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_events_updated_at
  BEFORE UPDATE ON user_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 新規ユーザー登録時にprofileを自動作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
