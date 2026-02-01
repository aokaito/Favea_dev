-- Favea MVP データベーススキーマ
-- 推し活ERP「Favea」のMVP用テーブル定義

-- ============================================
-- 1. profiles テーブル（ユーザー情報）
-- ============================================
-- Supabase Authと連携するユーザープロフィール
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) を有効化
alter table public.profiles enable row level security;

-- ユーザーは自分のプロフィールのみ参照・更新可能
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 新規ユーザー登録時にプロフィールを自動作成するトリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. idols テーブル（推しの対象）
-- ============================================
-- アイドル、グループ、作品など推しの対象を管理
create table if not exists public.idols (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  official_url text,
  tags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- インデックス
create index idx_idols_name on public.idols(name);
create index idx_idols_tags on public.idols using gin(tags);

-- RLS
alter table public.idols enable row level security;

-- 全ユーザーが閲覧可能
create policy "Anyone can view idols"
  on public.idols for select
  to authenticated
  using (true);

-- 認証済みユーザーは追加可能
create policy "Authenticated users can insert idols"
  on public.idols for insert
  to authenticated
  with check (true);

-- ============================================
-- 3. events テーブル（イベント情報）
-- ============================================
-- AI収集＋コミュニティ管理のイベント情報
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  idol_id uuid references public.idols(id) on delete cascade not null,
  title text not null,
  event_date timestamp with time zone not null,
  venue text,
  source_url text,
  is_draft boolean default true,
  verified_count int default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- インデックス
create index idx_events_idol_id on public.events(idol_id);
create index idx_events_event_date on public.events(event_date);
create index idx_events_is_draft on public.events(is_draft);

-- RLS
alter table public.events enable row level security;

-- 全ユーザーが閲覧可能（ドラフトも含む、コミュニティ校閲のため）
create policy "Anyone can view events"
  on public.events for select
  to authenticated
  using (true);

-- 認証済みユーザーは追加可能
create policy "Authenticated users can insert events"
  on public.events for insert
  to authenticated
  with check (true);

-- 作成者のみ更新可能
create policy "Creators can update own events"
  on public.events for update
  to authenticated
  using (auth.uid() = created_by);

-- ============================================
-- 4. ticket_deadlines テーブル（締切情報）
-- ============================================
-- イベントに紐づく各種締切（抽選開始/終了、入金締切など）
create type public.deadline_type as enum ('lottery_start', 'lottery_end', 'payment');

create table if not exists public.ticket_deadlines (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  deadline_type public.deadline_type not null,
  start_at timestamp with time zone,
  end_at timestamp with time zone not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- インデックス
create index idx_ticket_deadlines_event_id on public.ticket_deadlines(event_id);
create index idx_ticket_deadlines_end_at on public.ticket_deadlines(end_at);

-- RLS
alter table public.ticket_deadlines enable row level security;

create policy "Anyone can view ticket_deadlines"
  on public.ticket_deadlines for select
  to authenticated
  using (true);

create policy "Authenticated users can insert ticket_deadlines"
  on public.ticket_deadlines for insert
  to authenticated
  with check (true);

-- ============================================
-- 5. user_events テーブル（ユーザー個別管理）
-- ============================================
-- ユーザーごとのイベント管理ステータス
create type public.ticket_status as enum (
  'not_applied', -- 未申込
  'applied',     -- 申込済
  'pending',     -- 結果待ち
  'won',         -- 当選
  'lost',        -- 落選
  'paid',        -- 入金済
  'confirmed'    -- 確定
);

create table if not exists public.user_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  status public.ticket_status default 'not_applied' not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- 同一ユーザー・イベントの組み合わせは一意
  unique(user_id, event_id)
);

-- インデックス
create index idx_user_events_user_id on public.user_events(user_id);
create index idx_user_events_event_id on public.user_events(event_id);
create index idx_user_events_status on public.user_events(status);

-- RLS
alter table public.user_events enable row level security;

-- ユーザーは自分のイベントのみ参照・更新可能
create policy "Users can view own user_events"
  on public.user_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own user_events"
  on public.user_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own user_events"
  on public.user_events for update
  using (auth.uid() = user_id);

create policy "Users can delete own user_events"
  on public.user_events for delete
  using (auth.uid() = user_id);

-- ============================================
-- 6. event_verifications テーブル（コミュニティ検証）
-- ============================================
-- イベント情報の検証記録
create table if not exists public.event_verifications (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  is_correct boolean not null,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- 同一ユーザー・イベントの組み合わせは一意
  unique(event_id, user_id)
);

-- インデックス
create index idx_event_verifications_event_id on public.event_verifications(event_id);

-- RLS
alter table public.event_verifications enable row level security;

create policy "Anyone can view verifications"
  on public.event_verifications for select
  to authenticated
  using (true);

create policy "Users can insert own verifications"
  on public.event_verifications for insert
  with check (auth.uid() = user_id);

-- 検証数を自動更新するトリガー
create or replace function public.update_verified_count()
returns trigger as $$
begin
  update public.events
  set verified_count = (
    select count(*) from public.event_verifications
    where event_id = coalesce(new.event_id, old.event_id)
    and is_correct = true
  )
  where id = coalesce(new.event_id, old.event_id);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_verification_changed
  after insert or update or delete on public.event_verifications
  for each row execute procedure public.update_verified_count();

-- ============================================
-- 7. 更新日時自動更新トリガー
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 各テーブルにトリガーを設定
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger update_idols_updated_at
  before update on public.idols
  for each row execute procedure public.update_updated_at();

create trigger update_events_updated_at
  before update on public.events
  for each row execute procedure public.update_updated_at();

create trigger update_ticket_deadlines_updated_at
  before update on public.ticket_deadlines
  for each row execute procedure public.update_updated_at();

create trigger update_user_events_updated_at
  before update on public.user_events
  for each row execute procedure public.update_updated_at();
