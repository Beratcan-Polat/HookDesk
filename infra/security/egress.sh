#!/usr/bin/env sh
set -eu
# Run as root on the Linux Docker host after each deployment.
# Only the worker's explicit database, Redis and built-in receiver ports are allowed on private networks.
worker=$(docker compose -f compose.production.yaml ps -q worker)
test -n "$worker"
source_ips=$(docker inspect "$worker" | jq -r '.[0].NetworkSettings.Networks[].IPAddress')
test -n "$source_ips"
iptables -N HOOKDESK_EGRESS 2>/dev/null || true
iptables -F HOOKDESK_EGRESS
iptables -A HOOKDESK_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for entry in postgres:5432 redis:6379 receiver:8080; do
  service=${entry%:*}
  port=${entry#*:}
  container=$(docker compose -f compose.production.yaml ps -q "$service")
  docker inspect "$container" | jq -r '.[0].NetworkSettings.Networks[].IPAddress' | while read -r target; do
    test -n "$target" && iptables -A HOOKDESK_EGRESS -d "$target" -p tcp --dport "$port" -j ACCEPT
  done
done
for network in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
  iptables -A HOOKDESK_EGRESS -d "$network" -j REJECT
done
iptables -A HOOKDESK_EGRESS -j RETURN
for source_ip in $source_ips; do
  iptables -C DOCKER-USER -s "$source_ip" -j HOOKDESK_EGRESS 2>/dev/null || iptables -I DOCKER-USER 1 -s "$source_ip" -j HOOKDESK_EGRESS
done
