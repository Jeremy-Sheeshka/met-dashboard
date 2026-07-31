# MET Dashboard — Automation & Operations

## 1. Freshness: Auto-rebuild on new blog posts

When you publish a new ETEC post on the blog, the dashboard should rebuild
to pick it up. Two pieces need wiring:

### 1a. Enable the Coolify webhook (dashboard side)

1. In Coolify → `met-dashboard` project → the application → **Webhooks**
2. Click **+ Add Webhook** → give it a name (e.g. `blog-trigger`)
3. Copy the **URL** (it looks like
   `https://<coolify-host>/webhooks/deploy/<uuid>`)
4. Set **Secret** to a random string (save it — the blog needs the same)

### 1b. Add a deploy hook to the blog (blog side)

In the blog repo at `/home/sheeshka/Desktop/jeremysheeshka`, add a
post-build script that POSTs to Coolify. For **Netlify**, add an
[outgoing webhook](https://docs.netlify.com/site-deploys/notifications/#outgoing-webhooks)
in Site Settings → Deploy notifications.

Alternatively, add this to the blog's `package.json`:

```json
{
  "scripts": {
    "postbuild": "pagefind --site dist && curl -X POST https://<coolify-host>/webhooks/deploy/<uuid> -H 'Authorization: Bearer <secret>' || true"
  }
}
```

The `|| true` ensures a failed webhook never blocks the blog deploy.

### 1c. Manual fallback

- **Coolify GUI**: open the app → click **Redeploy**
- **CLI**: `npm run sync:posts && npm run build` (then redeploy in Coolify)

---

## 2. Future Services: Routing more apps through the Cloudflare Tunnel

All services run as Docker containers on the `coolify` network. To expose a
new service at `https://<name>.jeremysheeshka.ca`:

1. Deploy the service in Coolify (or as a standalone Docker container on
   the `coolify` network)
2. Note the container **name** (e.g. `supabase-db-xyz`) and **port**
3. In Cloudflare Zero Trust → Networks → Tunnels → your `met-dashboard`
   tunnel → **Public Hostnames** → **Add a public hostname**:
   - **Subdomain**: the service name (e.g. `supabase`, `plausible`,
     `glances`, `laravel`)
   - **Domain**: `jeremysheeshka.ca`
   - **Service Type**: `HTTP`
   - **URL**: `<container-name>:<port>` (e.g. `supabase-db-xyz:5432`)
4. Cloudflare auto-creates the DNS CNAME. No router ports to open.

### Planned services

| Service     | Subdomain                 | Container  | Port   |
|-------------|---------------------------|------------|--------|
| Supabase    | `supabase.jeremysheeshka.ca` | TBD    | TBD    |
| Plausible   | `stats.jeremysheeshka.ca`    | TBD    | TBD    |
| Glances     | `glances.jeremysheeshka.ca`  | TBD    | 61208  |
| Laravel app | TBD                          | TBD    | TBD    |

---

## 3. Container-Name Stability

### The problem

The tunnel's public hostname URL is:
```
smispkqdebmqa7jqaqwf2jqm-011247517259:3000
```
This is Coolify's auto-generated container name. If you redeploy the app
from scratch (delete + recreate in Coolify, not just a rebuild), the name
**will change** and the tunnel will break.

### Quick fix after a container rename

```bash
# 1. Find the new container name
docker ps --filter name=met --format '{{.Names}}'
# 2. Update the tunnel config in Cloudflare Zero Trust:
#    Networks → Tunnels → met-dashboard → Edit public hostname
#    → change the URL to <new-name>:3000
```

### Best practice: add a stable network alias

To make the container reachable at a fixed name regardless of redeploys, add
a network alias when creating the application. In the Coolify compose override
or via `docker network connect`:

```bash
# After each deploy (or as a startup hook):
docker network disconnect coolify smispkqdebmqa7jqaqwf2jqm-011247517259 2>/dev/null
docker network connect --alias met-dashboard coolify smispkqdebmqa7jqaqwf2jqm-011247517259
```

Then update the tunnel URL to `met-dashboard:3000` — this name survives
redeploys.

> **Note:** Coolify may overwrite network settings on redeploy. Test this
> after the next rebuild and re-apply the alias if needed.

---

## 4. Step 9: Origin-Port Hardening Runbook (UNEXECUTED)

> ⚠ **THIS HAS NOT BEEN APPLIED.** Run manually in a separate session
> with Proxmox console access ready.

### Rationale

Cloudflare "Proxied" DNS hides your origin IP from DNS lookups, but anyone
who knows the IP (historical DNS, Shodan, certificate transparency logs)
can hit `http://<origin-ip>` directly on 80/443 and bypass Cloudflare.
This runbook makes the origin accept 80/443 **only** from Cloudflare's edge
IPs. Tunnels are unaffected (they're outbound).

### Safety preamble

- **Open Proxmox web console** for `pve-node1` BEFORE applying — if you
  lock yourself out, the console is your out-of-band recovery path
- **NEVER restrict port 22** (SSH) or Proxmox management (8006)
- Test each step before proceeding to the next

### Current firewall state

| Tool        | Status                          |
|-------------|---------------------------------|
| ufw         | Not installed                   |
| nftables    | Inactive (ruleset empty)        |
| iptables    | Docker-managed rules only       |
| 80/443      | `coolify-proxy` publishes to host (docker-proxy) |
| INPUT policy | ACCEPT (no restrictions)       |

**Conclusion:** iptables is the active tool. No host firewall currently
restricts 80/443. Docker's proxy publishes 80/443 to `0.0.0.0`.

### Step 9a — Fetch current Cloudflare IPs

```bash
curl -s https://www.cloudflare.com/ips-v4/ > /tmp/cf-ips-v4.txt
curl -s https://www.cloudflare.com/ips-v6/ > /tmp/cf-ips-v6.txt
```

### Step 9b — Create the Cloudflare allow rules (DO FIRST)

```bash
# Create a dedicated chain for Cloudflare IPs
iptables -N CLOUDFLARE-ALLOW 2>/dev/null || iptables -F CLOUDFLARE-ALLOW

# Allow Cloudflare IPv4 ranges on ports 80 and 443
while read cidr; do
  iptables -A CLOUDFLARE-ALLOW -s "$cidr" -p tcp --dport 80 -j ACCEPT
  iptables -A CLOUDFLARE-ALLOW -s "$cidr" -p tcp --dport 443 -j ACCEPT
done < /tmp/cf-ips-v4.txt

# Allow Cloudflare IPv6 ranges
while read cidr; do
  ip6tables -N CLOUDFLARE-ALLOW 2>/dev/null || ip6tables -F CLOUDFLARE-ALLOW
  ip6tables -A CLOUDFLARE-ALLOW -s "$cidr" -p tcp --dport 80 -j ACCEPT
  ip6tables -A CLOUDFLARE-ALLOW -s "$cidr" -p tcp --dport 443 -j ACCEPT
done < /tmp/cf-ips-v6.txt

# Prepend the CLOUDFLARE-ALLOW chain to INPUT for ports 80/443
iptables -I INPUT 1 -p tcp --dport 80 -j CLOUDFLARE-ALLOW
iptables -I INPUT 1 -p tcp --dport 443 -j CLOUDFLARE-ALLOW
ip6tables -I INPUT 1 -p tcp --dport 80 -j CLOUDFLARE-ALLOW
ip6tables -I INPUT 1 -p tcp --dport 443 -j CLOUDFLARE-ALLOW
```

### Step 9c — Add the default-deny (ONLY after 9b succeeds)

```bash
# Drop all other traffic to 80/443
iptables -A INPUT -p tcp --dport 80 -j DROP
iptables -A INPUT -p tcp --dport 443 -j DROP
ip6tables -A INPUT -p tcp --dport 80 -j DROP
ip6tables -A INPUT -p tcp --dport 443 -j DROP
```

### Step 9d — Persist across reboots

```bash
# Install iptables-persistent
apt-get install -y iptables-persistent

# Save current rules
iptables-save > /etc/iptables/rules.v4
ip6tables-save > /etc/iptables/rules.v6
```

### Step 9e — Verify (do ALL of these)

**From the host itself (should still work):**
```bash
curl -sI http://localhost:80 | head -1   # should return HTTP/1.1
curl -sI https://localhost:443 -k | head -1
```

**From a non-Cloudflare network** (phone on mobile data, or a VPS):
```bash
curl -sI --connect-timeout 5 http://<origin-ip>:80 | head -1
# Expected: timeout or connection refused (NOT the site HTML)
```

**The proxied sites must still load:**
```bash
curl -sI https://jeremysheeshka.ca | head -3
curl -sI https://met.jeremysheeshka.ca | head -3
curl -sI https://guac.jeremysheeshka.ca | head -3
# All must return HTTP/2 200 with cf-ray header
```

### Rollback — instant recovery

```bash
# Flush the Cloudflare allow chain and remove the INPUT rules
iptables -D INPUT -p tcp --dport 80 -j DROP 2>/dev/null
iptables -D INPUT -p tcp --dport 443 -j DROP 2>/dev/null
iptables -D INPUT -p tcp --dport 80 -j CLOUDFLARE-ALLOW 2>/dev/null
iptables -D INPUT -p tcp --dport 443 -j CLOUDFLARE-ALLOW 2>/dev/null
iptables -F CLOUDFLARE-ALLOW
iptables -X CLOUDFLARE-ALLOW

ip6tables -D INPUT -p tcp --dport 80 -j DROP 2>/dev/null
ip6tables -D INPUT -p tcp --dport 443 -j DROP 2>/dev/null
ip6tables -D INPUT -p tcp --dport 80 -j CLOUDFLARE-ALLOW 2>/dev/null
ip6tables -D INPUT -p tcp --dport 443 -j CLOUDFLARE-ALLOW 2>/dev/null
ip6tables -F CLOUDFLARE-ALLOW
ip6tables -X CLOUDFLARE-ALLOW
```

After rollback, 80/443 are back to ACCEPT for all sources. Verify the
proxied sites still work.

### Router-level alternative

If iptables rules don't persist or Docker interferes (docker-proxy may
bypass iptables INPUT in some configurations), hardening must be done at
the **home router** level instead:

1. Log into the router admin panel
2. Create ACL rules: allow port 80/443 from Cloudflare's IP ranges only
   (get the latest list from `/ips-v4/` and `/ips-v6/`)
3. Default-deny port 80/443 from all other sources
4. Never restrict ports 22 (SSH), 8006 (Proxmox), or any management port
