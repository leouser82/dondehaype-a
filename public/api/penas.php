<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

define('DHP_DB', true);

function fail($code, $error, $detail = '') {
  http_response_code($code);
  $payload = ['error' => $error, 'penas' => []];
  if ($detail !== '') $payload['detail'] = $detail;
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function ok($payload, $code = 200) {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function db() {
  $config = include __DIR__ . '/db-config.php';
  if (!is_array($config)) fail(500, 'Falta db-config.php');
  $dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $config['host'] ?? 'localhost',
    (int) ($config['port'] ?? 3306),
    $config['name'] ?? ''
  );
  try {
    $pdo = new PDO($dsn, $config['user'] ?? '', $config['pass'] ?? '', [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  } catch (Throwable $e) {
    fail(503, 'No se pudo conectar a MySQL', $e->getMessage());
  }
  return $pdo;
}

function as_list($value) {
  if (is_array($value)) return array_values($value);
  if (is_string($value) && $value !== '') {
    $parsed = json_decode($value, true);
    return is_array($parsed) ? array_values($parsed) : [];
  }
  return [];
}

function as_date($value) {
  if (!$value) return '';
  return substr((string) $value, 0, 10);
}

function row_to_pena($row) {
  if (!$row) return null;
  return [
    'id' => $row['id'],
    'fuente' => 'vecinos',
    'tipoEvento' => $row['tipo_evento'],
    'musicos' => as_list($row['musicos'] ?? []),
    'gruposBaile' => as_list($row['grupos_baile'] ?? []),
    'provincia' => $row['provincia'] ?? '',
    'localidad' => $row['localidad'] ?? '',
    'ciudad' => $row['ciudad'] ?? '',
    'lat' => isset($row['lat']) ? (float) $row['lat'] : null,
    'lng' => isset($row['lng']) ? (float) $row['lng'] : null,
    'valorAnticipada' => $row['valor_anticipada'] === null ? null : (float) $row['valor_anticipada'],
    'valorPuerta' => $row['valor_puerta'] === null ? null : (float) $row['valor_puerta'],
    'reservaMesa' => !empty($row['reserva_mesa']),
    'institucion' => $row['institucion'] ?? '',
    'fechaDesde' => as_date($row['fecha_desde'] ?? ''),
    'fechaHasta' => as_date($row['fecha_hasta'] ?? ''),
    'horario' => $row['horario'] ?? '',
    'flyerUrl' => $row['flyer_url'] ?? '',
    'createdAt' => $row['created_at'] ?? null,
    'creadoPor' => [
      'uid' => $row['user_uid'],
      'nombre' => $row['user_name'] ?? 'Vecino',
      'email' => $row['user_email'] ?? '',
    ],
  ];
}

function read_body() {
  $raw = file_get_contents('php://input');
  if ($raw === '' || $raw === false) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function uuid() {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function save_flyer($dataUrl, $id) {
  if (!$dataUrl) return '';
  if (strpos($dataUrl, 'data:') !== 0) return (string) $dataUrl;
  if (!preg_match('#^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$#', $dataUrl, $m)) return '';
  $mime = strtolower($m[1]);
  $ext = strpos($mime, 'png') !== false ? 'png' : (strpos($mime, 'webp') !== false ? 'webp' : 'jpg');
  $dir = dirname(__DIR__) . '/uploads';
  if (!is_dir($dir)) mkdir($dir, 0755, true);
  $name = $id . '.' . $ext;
  file_put_contents($dir . '/' . $name, base64_decode($m[2]));
  return '/uploads/' . $name;
}

function upsert_user($pdo, $usuario) {
  $uid = trim((string) ($usuario['uid'] ?? ''));
  if ($uid === '') fail(401, 'Falta el usuario');
  $stmt = $pdo->prepare(
    'INSERT INTO users (uid, email, display_name, photo_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       display_name = VALUES(display_name),
       photo_url = VALUES(photo_url)'
  );
  $stmt->execute([
    $uid,
    $usuario['email'] ?? '',
    $usuario['displayName'] ?? $usuario['nombre'] ?? 'Vecino',
    $usuario['photoURL'] ?? '',
  ]);
  return $uid;
}

function payload_from_body($body) {
  $musicos = isset($body['musicos']) && is_array($body['musicos']) ? array_values(array_filter($body['musicos'])) : [];
  $grupos = isset($body['gruposBaile']) && is_array($body['gruposBaile']) ? array_values(array_filter($body['gruposBaile'])) : [];
  return [
    'tipo_evento' => substr((string) ($body['tipoEvento'] ?? 'Peña'), 0, 32),
    'musicos' => json_encode($musicos, JSON_UNESCAPED_UNICODE),
    'grupos_baile' => json_encode($grupos, JSON_UNESCAPED_UNICODE),
    'provincia' => substr((string) ($body['provincia'] ?? ''), 0, 80),
    'localidad' => substr((string) ($body['localidad'] ?? ''), 0, 160),
    'ciudad' => substr((string) ($body['ciudad'] ?? ''), 0, 160),
    'lat' => isset($body['lat']) ? (float) $body['lat'] : null,
    'lng' => isset($body['lng']) ? (float) $body['lng'] : null,
    'valor_anticipada' => ($body['valorAnticipada'] === '' || !isset($body['valorAnticipada'])) ? null : (float) $body['valorAnticipada'],
    'valor_puerta' => ($body['valorPuerta'] === '' || !isset($body['valorPuerta'])) ? null : (float) $body['valorPuerta'],
    'reserva_mesa' => !empty($body['reservaMesa']) ? 1 : 0,
    'institucion' => substr((string) ($body['institucion'] ?? ''), 0, 255),
    'fecha_desde' => substr((string) ($body['fechaDesde'] ?? ''), 0, 10),
    'fecha_hasta' => substr((string) ($body['fechaHasta'] ?? ''), 0, 10),
    'horario' => substr((string) ($body['horario'] ?? '21:00'), 0, 8),
  ];
}

function validar($payload) {
  if ($payload['provincia'] === '' || $payload['localidad'] === '' || $payload['ciudad'] === '') {
    fail(400, 'Marcá el lugar en el mapa para completar provincia, localidad y ciudad.');
  }
  if (!is_finite($payload['lat']) || !is_finite($payload['lng'])) {
    fail(400, 'Marcá el punto exacto en el mapa.');
  }
  if ($payload['fecha_desde'] === '' || $payload['fecha_hasta'] === '') {
    fail(400, 'Indicá fecha desde y hasta.');
  }
  if ($payload['fecha_hasta'] < $payload['fecha_desde']) {
    fail(400, 'La fecha hasta no puede ser anterior a la fecha desde.');
  }
  if ($payload['institucion'] === '') {
    fail(400, 'Marcá el lugar en el mapa para completar la institución.');
  }
}

function fetch_pena($pdo, $id) {
  $sql = 'SELECT p.*, u.email AS user_email, u.display_name AS user_name, u.photo_url AS user_photo
          FROM penas p LEFT JOIN users u ON u.uid = p.user_uid WHERE p.id = ?';
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$id]);
  return $stmt->fetch();
}

$pdo = db();
$body = read_body();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!empty($body['_method'])) $method = strtoupper((string) $body['_method']);
$id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

$select = 'SELECT p.*, u.email AS user_email, u.display_name AS user_name, u.photo_url AS user_photo
           FROM penas p LEFT JOIN users u ON u.uid = p.user_uid';

try {
  if ($method === 'GET' && $id === '') {
    $uid = trim((string) ($_GET['uid'] ?? ''));
    if ($uid !== '') {
      $stmt = $pdo->prepare($select . ' WHERE p.user_uid = ? ORDER BY p.fecha_desde DESC');
      $stmt->execute([$uid]);
    } else {
      $stmt = $pdo->query($select . ' ORDER BY p.fecha_desde ASC');
    }
    $rows = $stmt->fetchAll();
    ok(['penas' => array_map('row_to_pena', $rows)]);
  }

  if ($method === 'GET' && $id !== '') {
    $row = fetch_pena($pdo, $id);
    if (!$row) fail(404, 'No encontramos esa peña.');
    ok(['pena' => row_to_pena($row)]);
  }

  if ($method === 'POST' && $id === '') {
    $uid = upsert_user($pdo, $body['usuario'] ?? $body['creadoPor'] ?? []);
    $payload = payload_from_body($body);
    validar($payload);
    $newId = uuid();
    $flyer = save_flyer($body['flyerUrl'] ?? '', $newId);
    $stmt = $pdo->prepare(
      'INSERT INTO penas (
        id, user_uid, tipo_evento, musicos, grupos_baile, provincia, localidad, ciudad,
        lat, lng, valor_anticipada, valor_puerta, reserva_mesa, institucion,
        fecha_desde, fecha_hasta, horario, flyer_url
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
      $newId, $uid, $payload['tipo_evento'], $payload['musicos'], $payload['grupos_baile'],
      $payload['provincia'], $payload['localidad'], $payload['ciudad'],
      $payload['lat'], $payload['lng'], $payload['valor_anticipada'], $payload['valor_puerta'],
      $payload['reserva_mesa'], $payload['institucion'], $payload['fecha_desde'],
      $payload['fecha_hasta'], $payload['horario'], $flyer,
    ]);
    ok(['pena' => row_to_pena(fetch_pena($pdo, $newId))], 201);
  }

  if ($method === 'PUT' && $id !== '') {
    $uid = upsert_user($pdo, $body['usuario'] ?? $body['creadoPor'] ?? []);
    $current = $pdo->prepare('SELECT * FROM penas WHERE id = ?');
    $current->execute([$id]);
    $row = $current->fetch();
    if (!$row) fail(404, 'No encontramos esa peña.');
    if ($row['user_uid'] !== $uid) fail(403, 'Solo podés editar las peñas que cargaste vos.');
    $payload = payload_from_body($body);
    validar($payload);
    $flyer = !empty($body['flyerUrl']) ? save_flyer($body['flyerUrl'], $id) : $row['flyer_url'];
    $stmt = $pdo->prepare(
      'UPDATE penas SET
        tipo_evento=?, musicos=?, grupos_baile=?, provincia=?, localidad=?, ciudad=?,
        lat=?, lng=?, valor_anticipada=?, valor_puerta=?, reserva_mesa=?, institucion=?,
        fecha_desde=?, fecha_hasta=?, horario=?, flyer_url=?
       WHERE id=? AND user_uid=?'
    );
    $stmt->execute([
      $payload['tipo_evento'], $payload['musicos'], $payload['grupos_baile'],
      $payload['provincia'], $payload['localidad'], $payload['ciudad'],
      $payload['lat'], $payload['lng'], $payload['valor_anticipada'], $payload['valor_puerta'],
      $payload['reserva_mesa'], $payload['institucion'], $payload['fecha_desde'],
      $payload['fecha_hasta'], $payload['horario'], $flyer, $id, $uid,
    ]);
    ok(['pena' => row_to_pena(fetch_pena($pdo, $id))]);
  }

  if ($method === 'DELETE' && $id !== '') {
    $uid = trim((string) ($body['usuario']['uid'] ?? $body['uid'] ?? $_GET['uid'] ?? ''));
    if ($uid === '') fail(401, 'Tenés que estar logueado.');
    $current = $pdo->prepare('SELECT * FROM penas WHERE id = ?');
    $current->execute([$id]);
    $row = $current->fetch();
    if (!$row) fail(404, 'No encontramos esa peña.');
    if ($row['user_uid'] !== $uid) fail(403, 'Solo podés borrar las peñas que cargaste vos.');
    $del = $pdo->prepare('DELETE FROM penas WHERE id = ? AND user_uid = ?');
    $del->execute([$id, $uid]);
    ok(['ok' => true]);
  }

  fail(405, 'Método no permitido');
} catch (Throwable $e) {
  fail(500, 'Error de base de datos', $e->getMessage());
}
