-- Telegram chat_id to conversation mapping
CREATE TABLE IF NOT EXISTS telegram_chat_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT NOT NULL,
  bot_id TEXT NOT NULL,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(telegram_chat_id, bot_id)
);

-- Index for fast lookups by chat_id + bot_id
CREATE INDEX idx_telegram_chat_mappings_chat_bot
  ON telegram_chat_mappings(telegram_chat_id, bot_id);

-- RLS
ALTER TABLE telegram_chat_mappings ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON telegram_chat_mappings
  FOR ALL
  USING (true)
  WITH CHECK (true);
