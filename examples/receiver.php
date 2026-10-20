<?php
// Run behind your own HTTPS endpoint. Set HOOKDESK_SIGNING_SECRET and a writable persistent RECEIVER_DB file.
$secret=getenv('HOOKDESK_SIGNING_SECRET') ?: '';
$body=file_get_contents('php://input');
$timestamp=$_SERVER['HTTP_X_HOOKDESK_TIMESTAMP'] ?? '';
$signature=$_SERVER['HTTP_X_HOOKDESK_SIGNATURE'] ?? '';
if(!$secret || !ctype_digit($timestamp) || abs(time()-(int)$timestamp)>300 || !hash_equals('v1='.hash_hmac('sha256',$timestamp.'.'.$body,$secret),$signature)){
    http_response_code(401);exit('Invalid signature');
}
$event=json_decode($body,true);
if(!is_array($event) || !isset($event['id'])){http_response_code(422);exit('Invalid event');}
$db=new PDO('sqlite:'.(getenv('RECEIVER_DB') ?: __DIR__.'/receiver.sqlite'),null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE IF NOT EXISTS processed_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TEXT NOT NULL)');
$db->beginTransaction();
$insert=$db->prepare('INSERT OR IGNORE INTO processed_events (id,type,received_at) VALUES (?,?,?)');
$insert->execute([$event['id'],$event['type'] ?? '',gmdate(DATE_ATOM)]);
$duplicate=$insert->rowCount()===0;
// For this example, inserting the event IS the business effect. Real DB effects belong in this same transaction.
// External effects require their own idempotency key or a transactional outbox.
$db->commit();
header('Content-Type: application/json');echo json_encode(['accepted'=>true,'duplicate'=>$duplicate]);
