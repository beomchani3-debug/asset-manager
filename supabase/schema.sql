-- ============================================================
-- Asset Manager — Supabase 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

-- ── 테이블 생성 ──────────────────────────────────────────────

-- 1) 거래기록 (투자 매수/매도/배당)
create table if not exists transactions (
  id           uuid        primary key default gen_random_uuid(),
  date         date        not null,
  side         text        not null,        -- 매수 / 매도 / 배당
  broker       text        default '',
  asset_name   text        default '',
  ticker       text        default '',
  market       text        default '',
  sector       text        default '',
  currency     text        default 'KRW',
  price        numeric     default 0,
  quantity     numeric     default 0,
  fx_rate      numeric     default 1,
  krw_amount   numeric     default 0,
  memo         text        default '',
  user_id      uuid,                         -- 나중에 로그인 기능 추가 시 사용
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2) 가계부 (수입/고정비/변동지출/용돈지출)
create table if not exists cash_flows (
  id           uuid        primary key default gen_random_uuid(),
  date         date        not null,
  type         text        not null,         -- 수입 / 고정비 / 변동지출 / 용돈지출
  category     text        not null,
  amount       numeric     not null default 0,
  memo         text        default '',
  recurring_id uuid,                         -- 반복 고정비에서 자동/연결 생성된 경우 템플릿 id
  user_id      uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 기존 테이블에 반복 고정비 컬럼 추가 (이미 테이블이 있는 경우)
alter table cash_flows add column if not exists recurring_id uuid;

-- 3) 앱 설정 (배당목표, 환율, 카테고리 등)
create table if not exists app_settings (
  id           uuid        primary key default gen_random_uuid(),
  key          text        unique not null,
  value        jsonb,
  user_id      uuid,
  updated_at   timestamptz default now()
);

-- ── 인덱스 ──────────────────────────────────────────────────
create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_ticker on transactions(ticker);
create index if not exists idx_cash_flows_date on cash_flows(date desc);
create index if not exists idx_cash_flows_type on cash_flows(type);
create index if not exists idx_app_settings_key on app_settings(key);

-- ── Row Level Security ───────────────────────────────────────
-- 개인 앱 (anon key 접근) → RLS 비활성화
alter table transactions  disable row level security;
alter table cash_flows    disable row level security;
alter table app_settings  disable row level security;

-- ── 나중에 로그인 기능 추가 시 (현재는 주석 처리) ────────────────
-- alter table transactions  enable row level security;
-- alter table cash_flows    enable row level security;
-- alter table app_settings  enable row level security;
--
-- create policy "own_transactions" on transactions
--   for all using (auth.uid() = user_id);
-- create policy "own_cash_flows" on cash_flows
--   for all using (auth.uid() = user_id);
-- create policy "own_settings" on app_settings
--   for all using (auth.uid() = user_id);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transactions_updated on transactions;
create trigger trg_transactions_updated
  before update on transactions
  for each row execute function update_updated_at();

drop trigger if exists trg_cash_flows_updated on cash_flows;
create trigger trg_cash_flows_updated
  before update on cash_flows
  for each row execute function update_updated_at();
