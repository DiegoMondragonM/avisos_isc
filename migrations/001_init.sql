-- =====================================================
-- Base de datos: avisos_isc
-- Proyecto: App móvil de avisos de cursos, concursos y conferencias
-- Motor: PostgreSQL
-- =====================================================

BEGIN;

-- =========================
-- 1) usuarios
-- =========================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'estudiante',
    semestre SMALLINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_usuarios_rol CHECK (rol IN ('estudiante', 'admin')),
    CONSTRAINT chk_usuarios_semestre CHECK (semestre IS NULL OR semestre BETWEEN 1 AND 20)
);

-- =========================
-- 2) tags
-- =========================
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- 3) intereses_usuario
-- =========================
CREATE TABLE IF NOT EXISTS intereses_usuario (
    usuario_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, tag_id),
    CONSTRAINT fk_intereses_usuario_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_intereses_usuario_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =========================
-- 4) publicaciones
-- =========================
CREATE TABLE IF NOT EXISTS publicaciones (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(200),
    fuente VARCHAR(30) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    link TEXT,
    imagen_url TEXT,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    fecha_inscripcion_inicio TIMESTAMP,
    fecha_inscripcion_fin TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    hash_origen VARCHAR(255) NOT NULL UNIQUE,
    autor_id INT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_publicaciones_autor
        FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT chk_publicaciones_fuente CHECK (fuente IN ('mooc', 'manual')),
    CONSTRAINT chk_publicaciones_tipo CHECK (tipo IN ('curso', 'concurso', 'conferencia', 'taller', 'beca', 'otro')),
    CONSTRAINT chk_publicaciones_estado CHECK (estado IN ('borrador', 'publicada', 'vencida')),
    CONSTRAINT chk_publicaciones_fechas_evento CHECK (
        fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin
    ),
    CONSTRAINT chk_publicaciones_fechas_inscripcion CHECK (
        fecha_inscripcion_inicio IS NULL OR fecha_inscripcion_fin IS NULL OR fecha_inscripcion_inicio <= fecha_inscripcion_fin
    )
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_fuente ON publicaciones(fuente);
CREATE INDEX IF NOT EXISTS idx_publicaciones_tipo ON publicaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_publicaciones_estado ON publicaciones(estado);
CREATE INDEX IF NOT EXISTS idx_publicaciones_fecha_inicio ON publicaciones(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_publicaciones_source_id ON publicaciones(source_id);

-- =========================
-- 5) publicacion_tags
-- =========================
CREATE TABLE IF NOT EXISTS publicacion_tags (
    publicacion_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (publicacion_id, tag_id),
    CONSTRAINT fk_publicacion_tags_publicacion
        FOREIGN KEY (publicacion_id) REFERENCES publicaciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_publicacion_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =========================
-- 6) dispositivos_push
-- =========================
CREATE TABLE IF NOT EXISTS dispositivos_push (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    plataforma VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dispositivos_push_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT chk_dispositivos_push_plataforma CHECK (
        plataforma IS NULL OR plataforma IN ('android', 'ios', 'web')
    )
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_push_usuario_id ON dispositivos_push(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dispositivos_push_activo ON dispositivos_push(activo);

-- =========================
-- 7) interacciones
-- =========================
CREATE TABLE IF NOT EXISTS interacciones (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    publicacion_id INT NOT NULL,
    tipo_evento VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_interacciones_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_interacciones_publicacion
        FOREIGN KEY (publicacion_id) REFERENCES publicaciones(id) ON DELETE CASCADE,
    CONSTRAINT chk_interacciones_tipo_evento CHECK (
        tipo_evento IN ('view_detail', 'open_link', 'favorite', 'tap_notification')
    )
);

CREATE INDEX IF NOT EXISTS idx_interacciones_usuario_id ON interacciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_publicacion_id ON interacciones(publicacion_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_tipo_evento ON interacciones(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_interacciones_created_at ON interacciones(created_at);

-- =========================
-- 8) worker_log
-- =========================
CREATE TABLE IF NOT EXISTS worker_log (
    id SERIAL PRIMARY KEY,
    ejecutado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    cursos_vistos INT DEFAULT 0,
    cursos_nuevos INT DEFAULT 0,
    cursos_omitidos INT DEFAULT 0,
    error TEXT
);

-- Índice compuesto para el endpoint /sync/publicaciones?since=
CREATE INDEX IF NOT EXISTS idx_publicaciones_sync
    ON publicaciones(estado, updated_at);

COMMIT;
