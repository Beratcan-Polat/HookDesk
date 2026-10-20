<?php
// Server-side integration example for a Laravel cargo/rental application.
$base=rtrim(getenv('HOOKDESK_URL') ?: '', '/');
$key=getenv('HOOKDESK_API_KEY') ?: '';
$operationId=$argv[1] ?? null;
if(!$base || !$key || !$operationId){fwrite(STDERR,"Set HOOKDESK_URL / HOOKDESK_API_KEY and pass a stable rental or shipment operation ID.\n");exit(1);}
$payload=json_encode(['type'=>'rental.created','data'=>['rental_id'=>$operationId]],JSON_THROW_ON_ERROR);
$curl=curl_init($base.'/api/v1/events');
curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json','Idempotency-Key: rental-created-'.$operationId]]);
$response=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
if($response===false){fwrite(STDERR,"Network failure: retry with the same operation ID and body.\n");exit(1);}
curl_close($curl);echo $response.PHP_EOL;exit($status===202?0:1);
