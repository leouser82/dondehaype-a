-- Correr en phpMyAdmin, con la base u290440545_dondehaypenia seleccionada.

CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  display_name VARCHAR(255) NOT NULL DEFAULT '',
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS penas (
  id CHAR(36) NOT NULL,
  user_uid VARCHAR(128) NOT NULL,
  tipo_evento VARCHAR(32) NOT NULL,
  musicos JSON,
  grupos_baile JSON,
  provincia VARCHAR(80) NOT NULL DEFAULT '',
  localidad VARCHAR(160) NOT NULL DEFAULT '',
  ciudad VARCHAR(160) NOT NULL DEFAULT '',
  lat DECIMAL(10, 6) NOT NULL,
  lng DECIMAL(10, 6) NOT NULL,
  valor_anticipada DECIMAL(12, 2) NULL,
  valor_puerta DECIMAL(12, 2) NULL,
  reserva_mesa TINYINT(1) NOT NULL DEFAULT 0,
  institucion VARCHAR(255) NOT NULL DEFAULT '',
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  horario VARCHAR(8) NOT NULL DEFAULT '21:00',
  flyer_url MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_penas_user (user_uid),
  KEY idx_penas_fecha (fecha_hasta),
  CONSTRAINT fk_penas_user FOREIGN KEY (user_uid) REFERENCES users (uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
