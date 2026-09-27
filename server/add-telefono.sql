-- Correr en phpMyAdmin, con la base u290440545_dondehaypenia seleccionada.
-- El teléfono es opcional y puede quedar en NULL.

ALTER TABLE penas
  ADD COLUMN telefono VARCHAR(40) NULL DEFAULT NULL AFTER institucion;
