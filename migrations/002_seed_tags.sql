-- =====================================================
-- 002_seed_tags.sql
-- Catálogo base de tags para el departamento ISC
-- =====================================================

INSERT INTO tags (nombre, slug) VALUES
  ('Inteligencia Artificial',     'ia'),
  ('Desarrollo Web',              'web'),
  ('Desarrollo Móvil',            'movil'),
  ('Redes y Telecomunicaciones',  'redes'),
  ('Ciberseguridad',              'ciberseguridad'),
  ('Cómputo en la Nube',          'nube'),
  ('Análisis de Datos',           'datos'),
  ('Robótica e IoT',              'robotica-iot'),
  ('Python',                      'python'),
  ('Java',                        'java'),
  ('JavaScript',                  'javascript'),
  ('Base de Datos',               'base-de-datos'),
  ('Emprendimiento',              'emprendimiento'),
  ('Idiomas',                     'idiomas'),
  ('Inglés',                      'ingles'),
  ('DevOps',                      'devops'),
  ('Flutter',                     'flutter'),
  ('Backend',                     'backend'),
  ('Frontend',                    'frontend'),
  ('Machine Learning',            'machine-learning'),
  ('General',                     'general')
  
ON CONFLICT (slug) DO NOTHING;