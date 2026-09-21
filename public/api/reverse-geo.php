<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$lat = isset($_GET['lat']) ? (float) $_GET['lat'] : NAN;
$lng = isset($_GET['lng']) ? (float) $_GET['lng'] : NAN;
if (!is_finite($lat) || !is_finite($lng)) {
  http_response_code(400);
  echo json_encode(['error' => 'Coordenadas inválidas'], JSON_UNESCAPED_UNICODE);
  exit;
}

function norm($value) {
  $n = mb_strtolower(trim((string) $value), 'UTF-8');
  $map = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n'];
  return strtr($n, $map);
}

function match_provincia($raw) {
  $n = norm($raw);
  if ($n === '') return '';
  if (preg_match('/ciudad autonoma|capital federal|\bcaba\b/', $n)) return 'CABA';
  if (strpos($n, 'tierra del fuego') !== false) return 'Tierra del Fuego';
  $list = [
    'Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa',
    'Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan',
    'San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán',
  ];
  foreach ($list as $item) {
    $p = norm($item);
    if ($n === $p || strpos($n, $p) !== false) return $item;
  }
  return trim((string) $raw);
}

$url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' . rawurlencode((string) $lat)
  . '&lon=' . rawurlencode((string) $lng) . '&addressdetails=1&zoom=18&accept-language=es';
$ctx = stream_context_create([
  'http' => [
    'timeout' => 8,
    'header' => "User-Agent: DondeHayPena/1.0\r\nAccept: application/json\r\n",
  ],
]);
$raw = @file_get_contents($url, false, $ctx);
$data = $raw ? json_decode($raw, true) : null;
$a = is_array($data['address'] ?? null) ? $data['address'] : [];
$institucion = trim((string) ($data['name'] ?? ''));
if ($institucion === '') {
  $institucion = trim(($a['amenity'] ?? '') ?: ($a['tourism'] ?? '') ?: ($a['leisure'] ?? '') ?: trim(($a['road'] ?? '') . ' ' . ($a['house_number'] ?? '')));
}

echo json_encode([
  'institucion' => $institucion,
  'localidad' => $a['suburb'] ?? $a['neighbourhood'] ?? $a['town'] ?? $a['village'] ?? $a['city'] ?? '',
  'ciudad' => $a['city'] ?? $a['town'] ?? $a['village'] ?? $a['municipality'] ?? '',
  'provincia' => match_provincia($a['state'] ?? $a['province'] ?? ''),
], JSON_UNESCAPED_UNICODE);
