-- =====================================================
-- 003_publicaciones_soft_delete.sql
-- Permite sincronizar publicaciones eliminadas/ocultas sin borrarlas físicamente.
-- =====================================================

ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE publicaciones
  DROP CONSTRAINT IF EXISTS chk_publicaciones_estado;

ALTER TABLE publicaciones
  ADD CONSTRAINT chk_publicaciones_estado
  CHECK (estado IN ('borrador', 'publicada', 'vencida', 'eliminada'));
