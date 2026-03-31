-- 使用率ランキングテーブル
-- Supabase の SQL Editor で実行してください
CREATE TABLE IF NOT EXISTS usage_ranking (
  id TEXT PRIMARY KEY DEFAULT 'latest',
  singles JSONB NOT NULL DEFAULT '[]',
  doubles JSONB NOT NULL DEFAULT '[]',
  month TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（Row Level Security）: 全員が読み取れるようにする
ALTER TABLE usage_ranking ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー: 全員が読める
CREATE POLICY "Anyone can read usage_ranking"
  ON usage_ranking FOR SELECT
  USING (true);

-- 書き込みポリシー: service_role のみ（Cron API Route から）
CREATE POLICY "Service role can update usage_ranking"
  ON usage_ranking FOR ALL
  USING (true)
  WITH CHECK (true);
