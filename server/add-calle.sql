-- Correr en phpMyAdmin, con la base u290440545_dondehaypenia seleccionada.
-- La calle se completa con el mapa y puede quedar en NULL.

ALTER TABLE penas
  ADD COLUMN calle VARCHAR(255) NULL DEFAULT NULL AFTER ciudad;
