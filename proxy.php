<?php
// proxy.php - Local CORS Proxy for Tafsir MCP
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

set_time_limit(0); // Prevent PHP from timing out on long SSE streams

$target_url = isset($_GET['url']) ? $_GET['url'] : 'http://127.0.0.1:8000/sse';

$ch = curl_init($target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Fix for XAMPP SSL issues
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$headers = [];
$requestHeaders = getallheaders();
if (isset($requestHeaders['Content-Type'])) {
    $headers[] = 'Content-Type: ' . $requestHeaders['Content-Type'];
}

// Handle Server-Sent Events (SSE) stream without buffering
$isSSE = false;
if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'text/event-stream') !== false) {
    $isSSE = true;
    $headers[] = 'Accept: text/event-stream, application/json';
} elseif (isset($requestHeaders['Accept'])) {
    $headers[] = 'Accept: ' . $requestHeaders['Accept'];
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// Old block removed

if ($isSSE) {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    
    // Disable PHP output buffering
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
        echo $data;
        flush();
        return strlen($data);
    });
    
    curl_exec($ch);
} else {
    // Normal JSON-RPC POST response
    header('Content-Type: application/json');
    $response = curl_exec($ch);
    echo $response;
}

curl_close($ch);
?>
