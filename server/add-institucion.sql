-- Correr en phpMyAdmin, con la base u290440545_dondehaypenia seleccionada.
-- La institución organizadora es opcional y puede quedar en NULL.
-- Si la columna no existe, corre el ADD. Si ya existe, corre solo el MODIFY.

ALTER TABLE penas
  ADD COLUMN institucion VARCHAR(255) NULL DEFAULT NULL AFTER reserva_mesa;

ALTER TABLE penas
  MODIFY institucion VARCHAR(255) NULL DEFAULT NULL;
