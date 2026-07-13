BEGIN;

ALTER TABLE search_executions
  DROP CONSTRAINT IF EXISTS search_executions_phase_check;

ALTER TABLE search_executions
  ADD CONSTRAINT search_executions_phase_check CHECK (
    phase IS NULL OR phase IN (
      'Estimating','Fetching','Normalizing','Deduplicating','Persisting','Finalizing',
      'Complete','Partial Complete','Failed','Cancelled','Paused'
    )
  );

UPDATE search_executions
SET phase = CASE status
  WHEN 'Completed' THEN 'Complete'
  WHEN 'Partially Completed' THEN 'Partial Complete'
  WHEN 'Failed' THEN 'Failed'
  WHEN 'Cancelled' THEN 'Cancelled'
  WHEN 'Paused' THEN 'Paused'
  ELSE phase
END
WHERE status IN ('Completed','Partially Completed','Failed','Cancelled','Paused');

INSERT INTO schema_migrations(version)
VALUES ('028_search_execution_terminal_phase')
ON CONFLICT(version) DO NOTHING;

COMMIT;
