import redis
import json
import asyncio
import redis.asyncio as aioredis
from celery import Celery
import time
from datetime import timedelta

from app.config import settings
from app.log import get_logger
from app.database.db import get_db
from app.models.scan import Scan, ScanStatus
from app.models.target import Target
from app.models.finding import Finding, PortState, Severity
from app.utils.timezone import now_utc


celery_app = Celery(
    "tasks",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
)

log = get_logger(__name__)

# --- Scan Status Updater ---
def update_scan_status(scan_uuid, status, db):
    """
    Update the scan status in the database
    """
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        log.warning(f"Attempted to update status for non-existent scan: {scan_uuid}")
        return False
    # Set timestamps
    if status == ScanStatus.RUNNING and scan.status != ScanStatus.RUNNING:
        scan.started_at = now_utc()
    elif status in (ScanStatus.COMPLETED, ScanStatus.FAILED) and scan.finished_at is None:
        # get total number of completed/failed scans for the user
        total_scans = (
            db.query(Scan)
            .filter(
                Scan.user_id == scan.user_id,
                Scan.status.in_([ScanStatus.COMPLETED, ScanStatus.FAILED])
            )
            .count()
        )
        scan.name = "Results report no. " + str(total_scans + 1)
        scan.finished_at = now_utc()
        # Send final progress
        try:
            r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
            r.publish(f"{scan_uuid}:progress", "100")
            r.close()
        except Exception as e:
            log.error(f"Error publishing final progress for scan {scan_uuid}: {e}")
    if scan.status != status:
        scan.status = status
    db.commit()
    log.info(f"Updated scan {scan_uuid} status to {status}")
    return True


# --- Classification Rules ---
PORT_RULES = {
    22: (Severity.MEDIUM, "SSH open: enforce key-based auth, disable root login, and implement rate limiting."),
    23: (Severity.HIGH, "Telnet open: credentials are sent in cleartext; disable Telnet and use SSH."),
    21: (Severity.MEDIUM, "FTP open: unencrypted data flow; disable anonymous login or switch to SFTP/FTPS."),
    80: (Severity.LOW, "HTTP open: traffic is unencrypted; redirect HTTP to HTTPS and implement HSTS."),
    443: (Severity.LOW, "HTTPS open: ensure certificates are valid, use TLS1.2+ and strong cipher suites."),
    25: (Severity.MEDIUM, "SMTP open: verify no open relay, enforce authentication and restrict relay hosts."),
    3389: (Severity.HIGH, "RDP open: potential lateral movement; restrict source IPs, enforce MFA and network-level auth."),
    445: (Severity.MEDIUM, "SMBv1 open: vulnerable to multiple RCE exploits (e.g. EternalBlue); disable SMBv1 and apply security patches."),
    139: (Severity.MEDIUM, "NetBIOS is open; disable NetBIOS and use SMBv3."),
    135: (Severity.MEDIUM, "RPC is open; disable RPC and use SMBv3."),
    111: (Severity.MEDIUM, "RPC is open; disable RPC and use SMBv3."),
    110: (Severity.MEDIUM, "POP3 is open; disable POP3 and use IMAP."),
    143: (Severity.MEDIUM, "IMAP is open; disable IMAP and use POP3."),
    993: (Severity.MEDIUM, "IMAP is open; disable IMAP and use POP3."),
    995: (Severity.MEDIUM, "POP3 is open; disable POP3 and use IMAP."),
    587: (Severity.MEDIUM, "SMTP is open; disable SMTP and use SMTP over TLS."),
    465: (Severity.MEDIUM, "SMTP is open; disable SMTP and use SMTP over TLS."),
    563: (Severity.MEDIUM, "NNTP is open; disable NNTP and use NNTP over TLS."),
}

SCRIPT_RULES = {
    # SSL-related scripts
    'ssl-cert': None,  # parsed by classify_script for expiration and validity
    'ssl-poodle': (Severity.CRITICAL, "Vulnerable to POODLE (CVE-2014-3566): disable SSLv3, enforce TLS1.2+ and remove RC4 ciphers."),
    'ssl-enum-ciphers': None,  # handled by classify_script for weak ciphers
    'ssl-heartbleed': (Severity.HIGH, "Vulnerable to Heartbleed (CVE-2014-0160): upgrade OpenSSL to a non-vulnerable version."),
    'mysql-vuln-cve2012-2122': (Severity.CRITICAL, "MySQL vulnerable to CVE-2012-2122: patch or upgrade MySQL, restrict remote access and enforce strong credentials."),
    'ssh-publickey-acceptance': (Severity.HIGH, "SSH public key acceptance: verify authorized_keys policies, remove unrecognized keys, and rotate keys regularly."),
    'xmpp-brute': (Severity.HIGH, "XMPP brute-force susceptible: implement account lockouts, enforce strong password policies, and enable rate limiting."),

    # HTTP-related scripts
    'http-headers': (Severity.LOW, "Review and enforce security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) to harden web responses."),
    'http-phpself-xss': (Severity.CRITICAL, "PHP self-XSS vulnerability: sanitize input data, validate user input, and implement proper escaping."),
    'http-xssed': (Severity.CRITICAL, "XSS vulnerability: sanitize input data, validate user input, and implement proper escaping."),
    'http-csrf': (Severity.HIGH, "Missing CSRF protection: implement anti-CSRF tokens, enforce SameSite cookie attributes, and validate origin headers."),
    'samba-vuln-cve-2012-1182': (Severity.HIGH, "Samba vulnerable to CVE-2012-1182: update Samba to a patched version, disable anonymous shares, and restrict SMB access."),
    'http-frontpage-login': (Severity.MEDIUM, "FrontPage services exposed: disable FrontPage extensions or secure with authentication and remove legacy code."),
    'http-wordpress-brute': (Severity.MEDIUM, "WordPress brute-force detected: enforce strong admin credentials, implement login throttling, and use a web application firewall (WAF)."),
    'http-vuln-cve2010-2861': (Severity.HIGH, "Vulnerable to CVE-2010-2861: patch the affected HTTP service or upgrade to a secure software version."),
    'http-shellshock': (Severity.CRITICAL, "Vulnerable to Shellshock (CVE-2014-6271): update Bash to a patched version and reload all shell services."),
    'http-sql-injection': None,
    'http-title': (Severity.INFO, "Page titles exposed: remove default or sensitive information from HTTP title tags."),
    'http-server-header': (Severity.INFO, "Server header disclosure: remove or obfuscate server version to reduce fingerprinting risk."),
    'auth-spoof': (Severity.HIGH, "Authentication spoofing possible: verify authentication flows, use CSRF tokens, and enforce secure cookies."),
}

# --- Utility Functions ---
def classify_port(p_info):
    port = p_info.get('port')
    state = (p_info.get('state') or 'unknown').lower()
    if state not in ('open', 'closed'):
        return None
    if state == 'closed':
        return Severity.INFO, "Port closed; no service listening."
    return PORT_RULES.get(port, (Severity.LOW, f"Service {p_info.get('service', {}).get('name', '')}/{port} open; review necessity and patch."))


def classify_script(script):
    """Return (severity, recommendation) for an NSE script output dict, parsing SSL cert dates robustly."""
    from datetime import datetime
    name = script.get('id')
    output = script.get('output', '')
    # Predefined rules
    rule = SCRIPT_RULES.get(name)
    if rule:
        return rule

    # SSL certificate handling
    if name == 'ssl-cert':
        not_valid_before = None
        not_valid_after = None
        for line in output.splitlines():
            if 'Not valid before:' in line:
                val = line.split('Not valid before:')[1].strip()
                not_valid_before = val
            if 'Not valid after:' in line:
                val = line.split('Not valid after:')[1].strip()
                not_valid_after = val
        # Normalize timestamp formats
        def normalize(ts):
            # if missing seconds, add ':00'
            if ts and len(ts.split('T')[-1].split(':')) == 2:
                return ts + ':00'
            return ts
        try:
            if not_valid_before:
                not_valid_before = datetime.fromisoformat(normalize(not_valid_before))
            if not_valid_after:
                not_valid_after = datetime.fromisoformat(normalize(not_valid_after))
        except ValueError:
            # unable to parse, fallback to info
            return Severity.INFO, "SSL certificate validity could not be parsed; review manually."
        now = datetime.utcnow()
        if not_valid_before and not_valid_after:
            if not_valid_before <= now <= not_valid_after:
                return Severity.INFO, "SSL certificate is valid; ensure strong signature and key size."
            if not_valid_after - now < timedelta(days=30):
                return Severity.MEDIUM, "SSL certificate is expiring soon; renew the certificate."
            return Severity.HIGH, "SSL certificate is expired; renew the certificate."
        return Severity.INFO, "SSL certificate details incomplete; review manually."

    # SSL cipher enumeration
    if name == 'ssl-enum-ciphers':
        if any(tag in output.lower() for tag in ('rc4', '3des', 'md5')):
            return Severity.MEDIUM, "Disable weak TLS ciphers (RC4, 3DES, MD5)."
        return Severity.LOW, "Cipher suite is strong."
    
    if name == 'http-sql-injection':
        for line in output.splitlines():
            if "vulnerable" in line.lower():
                return Severity.CRITICAL, "SQL injection vulnerability: sanitize and parameterize inputs, use prepared statements, and deploy WAF rules."
            if "possible" in line.lower():
                return Severity.HIGH, "SQL injection vulnerability: possible vulnerability found."
        return Severity.HIGH, "SQL injection vulnerability: no vulnerability found."

    # Default informational
    return Severity.INFO, f"Script {name} ran; review output."


def classify_os(os_info):
    name = os_info.get('name', '')
    if any(x in name.lower() for x in ('xp', '2003', 'centos 5', 'debian 7')):
        return Severity.HIGH, f"Detected outdated OS {name}; upgrade or patch."
    return Severity.INFO, f"OS detected: {name}."


def classify_traceroute(trace):
    if trace and trace[0].get('ip') and not trace[0]['ip'].startswith(('10.', '192.168.', '172.')):
        return Severity.INFO, "Host appears in DMZ; verify firewall rules."
    return Severity.INFO, "Traceroute recorded."


def process_scan_results(scan, scan_results, db):
    new_count = 0
    for host in scan_results:
        ip = host.get('ip_address')
        name = host.get('hostname') or ip
        if not name:
            continue
        target = db.query(Target).filter_by(user_id=scan.user_id, name=name).first()
        if not target:
            target = Target(user_id=scan.user_id, name=name)
            db.add(target)
            db.flush()
        if target not in scan.targets:
            scan.targets.append(target)
        # OS finding
        os_info = host.get('os_info', {})
        sev, reco = classify_os(os_info)
        db.add(Finding(
            name=f"{name}-OS",
            description="OS fingerprint",
            recommendation=reco,
            port=None,
            port_state=None,
            protocol=None,
            service=None,
            os=os_info,
            traceroute=None,
            severity=sev,
            target=target,
        ))
        new_count += 1
        # Traceroute finding
        trace = host.get('traceroute', [])
        sev, reco = classify_traceroute(trace)
        db.add(Finding(
            name=f"{name}-Traceroute",
            description="Network path",
            recommendation=reco,
            port=None,
            port_state=None,
            protocol=None,
            service=None,
            os=None,
            traceroute=trace,
            severity=sev,
            target=target,
        ))
        new_count += 1
        # Port & Script findings
        for p in host.get('ports', []):
            if p.get('port') is None:
                continue
            try:
                port_num = int(p['port'])
            except (ValueError, TypeError):
                continue
            state = p.get('state', '').lower()
            if state not in ('open', 'closed'):
                continue
            result = classify_port(p)
            if not result:
                continue
            sev, reco = result
            db.add(Finding(
                name=f"{name}:{port_num}/{p.get('protocol')}",
                description=f"Port {state}",
                recommendation=reco,
                port=port_num,
                port_state=PortState(state),
                protocol=p.get('protocol'),
                service=p.get('service', {}).get('name', ''),
                os=None,
                traceroute=None,
                severity=sev,
                target=target
            ))
            new_count += 1
            # Handle scripts: scripts may be dict of {script_name: output or dict}
            scripts = p.get('scripts') or {}
            # Normalize: if scripts is list, keep; if dict, transform
            if isinstance(scripts, dict):
                items = scripts.items()
            elif isinstance(scripts, list):
                # each item might be dict with 'id' and 'output'
                items = [(s.get('id'), s.get('output', '')) for s in scripts if isinstance(s, dict)]
            else:
                items = []
            for script_name, script_data in items:
                # script_data can be str or dict
                if isinstance(script_data, dict):
                    output = script_data.get('output', '')
                else:
                    output = str(script_data)
                sev_s, reco_s = classify_script({'id': script_name, 'output': output})
                db.add(Finding(
                    name=f"{name}:{port_num} script {script_name}",
                    description=output,
                    recommendation=reco_s,
                    port=port_num,
                    port_state=PortState(state),
                    protocol=p.get('protocol'),
                    service=p.get('service', {}).get('name', ''),
                    os=None,
                    traceroute=None,
                    severity=sev_s,
                    target=target
                ))
                new_count += 1
    db.commit()
    log.info(f"Inserted {new_count} new findings for scan {scan.uuid}")


@celery_app.task
def watch_scan(scan_uuid):
    """Watch a scan's lifecycle using Redis as the single source of truth and
    publish status changes through Redis so that the WebSocket endpoint can
    forward them directly to the UI. This function now performs a minimal
    number of database writes (pending → running → completed/failed)."""

    async def async_watch():
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        r_async = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

        # Subscribe only to progress – status updates will be detected by polling
        pubsub = r_async.pubsub()
        await pubsub.subscribe(f"{scan_uuid}:progress")

        key_status = f"scan:{scan_uuid}"
        key_results = f"scan_results:{scan_uuid}"
        key_progress_cached = f"scan_progress:{scan_uuid}"
        last_message_time = time.time()
        log.info(f"Started watch_scan for {scan_uuid}")

        last_status: str | None = None  # Track the last known status so we only
                                        # touch MySQL on real transitions.

        try:
            while True:
                # Handle progress messages (forwarded from check_targets)
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    try:
                        prog = float(msg["data"].decode())
                        last_message_time = time.time()
                        r.set(key_progress_cached, str(prog), ex=3600)
                    except ValueError:
                        pass  # Ignore non-numeric messages on progress channel

                # Get current lifecycle status from Redis (written by check_targets)
                raw_status = r.get(key_status)
                if raw_status:
                    current_status = json.loads(raw_status).get("status")

                    # If status changed (including first observation), handle DB update & notify UI via Redis pub
                    if current_status and current_status != last_status:
                        last_status = current_status

                        # Translate str → ORM enum
                        mapping = {
                            "running": ScanStatus.RUNNING,
                            "completed": ScanStatus.COMPLETED,
                            "failed": ScanStatus.FAILED,
                        }
                        enum_status = mapping.get(current_status)

                        if enum_status:
                            db = next(get_db())
                            update_scan_status(scan_uuid, enum_status, db)

                            # Fetch updated scan for timestamps we might need to
                            # forward to the UI (started_at, finished_at)
                            scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
                            started_at_iso = scan.started_at.isoformat() if scan.started_at else None
                            finished_at_iso = scan.finished_at.isoformat() if scan.finished_at else None

                            db.close()
                        else:
                            started_at_iso = None
                            finished_at_iso = None

                        # Publish status change so WebSocket can forward it
                        r.publish(
                            f"{scan_uuid}:status",
                            json.dumps(
                                {
                                    "status": current_status,
                                    "started_at": started_at_iso,
                                    "finished_at": finished_at_iso,
                                }
                            ),
                        )
                        

                        # If the scan just finished, process results & break
                        if current_status in ("completed", "failed"):
                            # Handle final DB persistence only once (on completed)
                            db2 = next(get_db())
                            scan_db = db2.query(Scan).filter_by(uuid=scan_uuid).first()

                            if current_status == "completed" and scan_db:
                                # Persist final console output
                                try:
                                    out_key = f"scan_output:{scan_uuid}"
                                    lines = r.lrange(out_key, 0, -1)
                                    if lines:
                                        scan_db.output = "\n".join(l.decode() for l in lines)
                                        r.delete(out_key)
                                except Exception:
                                    log.warning(f"Could not retrieve output for {scan_uuid}")

                                # Persist structured results
                                res_raw = r.get(key_results)
                                if res_raw:
                                    scan_results = json.loads(res_raw)
                                    scan_db.result = json.dumps(scan_results)
                                    process_scan_results(scan_db, scan_results, db2)
                                    db2.commit()
                                    r.delete(key_results)

                            db2.close()

                            # No need to keep watching after terminal state
                            break

                await asyncio.sleep(1.5)
                if time.time() - last_message_time > 120:
                    log.warning(f"Scan {scan_uuid} has not received any progress updates in the last 120 seconds, terminating watch_scan")
                    db = next(get_db())
                    update_scan_status(scan_uuid, ScanStatus.FAILED, db)
                    db.close()
                    break
        finally:
            await pubsub.unsubscribe(f"{scan_uuid}:progress")
            await pubsub.close()
            await r_async.close()
            r.close()

    asyncio.run(async_watch())
