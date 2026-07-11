BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_items (
  id BIGSERIAL PRIMARY KEY,
  knowledge_key TEXT NOT NULL CHECK (LENGTH(TRIM(knowledge_key)) > 0),
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('company', 'target_customer_profile')),
  title TEXT NOT NULL,
  summary TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  supersedes_id BIGINT REFERENCES knowledge_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Needs Review', 'Outdated', 'Archived')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (knowledge_key, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_single_active
  ON knowledge_items(knowledge_key) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type_status
  ON knowledge_items(knowledge_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_key_revision
  ON knowledge_items(knowledge_key, revision_no DESC);

INSERT INTO schema_migrations(version)
VALUES ('025_v53_ai_knowledge_center_foundation')
ON CONFLICT(version) DO NOTHING;

COMMIT;
