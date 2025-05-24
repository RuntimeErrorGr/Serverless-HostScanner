#!/usr/bin/env python
"""
This script handles the process of checking responding targets.
"""
import argparse
import logging
import os
import random
import xml.etree.ElementTree as ET
from ipaddress import IPv4Network
import json
import redis
from .check_targets_utils import (
    CheckTargetsConfig,
    ScanType,
    NmapParseException,
    get_responding_urls,
    is_netblock_cidr,
    Host,
    calculate_number_of_targets,
)


class CheckTargetsException(Exception):
    """Base class for check targets exceptions."""


class CheckTargets:
    """Class that holds information about the check alive process."""

    def __init__(self, config: CheckTargetsConfig) -> None:
        self.config = config
        self.status = "running"
        redis_host = os.environ.get("REDIS_HOST", "redis-nfs.default.svc.cluster.local")
        redis_port = int(os.environ.get("REDIS_PORT", "6379"))
        redis_db = int(os.environ.get("REDIS_DB", "0"))
        redis_password = os.environ.get("REDIS_PASSWORD", None)
        
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            password=redis_password,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            decode_responses=True
        )
        self.alive_targets: set[Host] = set()
        
        # Progress tracking
        self.current_phase = "initializing"
        self.phase_weights = self._calculate_phase_weights()
        self.overall_progress = 0.0
        self.last_sent_progress = 0.0
        self.phase_start_times = {}
        
        # Message throttling
        self.last_status_message_time = 0
        self.STATUS_MESSAGE_INTERVAL = 8

    def _calculate_phase_weights(self) -> dict:
        """Identify enabled scan phases and assign equal weight to each."""

        self.enabled_phases: list[str] = []  # Store for later use in progress calculation

        # Host discovery is always enabled
        self.enabled_phases.append("host_discovery")

        # Dynamically add phases depending on scan options
        if self.config.scan_options.tcp_ports:
            self.enabled_phases.append("tcp_scan")

        if self.config.scan_options.udp_ports:
            self.enabled_phases.append("udp_scan")

        if self.config.scan_options.os_detection:
            self.enabled_phases.append("os_detection")

        if self.config.scan_options.service_version:
            self.enabled_phases.append("service_detection")

        if self.config.scan_options.ssl_scan or self.config.scan_options.http_headers:
            self.enabled_phases.append("nse_scripts")

        # Calculate equal weight slice for each enabled phase
        phase_count = len(self.enabled_phases) * calculate_number_of_targets(self.config.targets) if self.enabled_phases else 1
        phase_weight = 100.0 / phase_count


        # Initialize all weights to 0 then set for enabled
        weights = {
            'host_discovery': 0,
            'tcp_scan': 0,
            'udp_scan': 0,
            'os_detection': 0,
            'service_detection': 0,
            'nse_scripts': 0,
        }

        for phase in self.enabled_phases:
            if phase == "nse_scripts":
                weights[phase] = phase_weight * 2
            else:
                weights[phase] = phase_weight

        return weights

    def _detect_scan_phase(self, line: str) -> str:
        """Detect which scan phase is currently running based on output line."""
        line_lower = line.lower()
        
        if 'ping scan' in line_lower or 'host discovery' in line_lower:
            return 'host_discovery'
        elif 'syn stealth scan' in line_lower or 'tcp scan' in line_lower:
            return 'tcp_scan'
        elif 'udp scan' in line_lower:
            return 'udp_scan'
        elif 'os detection' in line_lower:
            return 'os_detection'
        elif 'service scan' in line_lower or 'version detection' in line_lower:
            return 'service_detection'
        elif 'nse' in line_lower or 'script scan' in line_lower:
            return 'nse_scripts'
        
        return self.current_phase

    def parse_nmap_progress(self, line: str) -> float | None:
        """Parse progress percentage from Nmap output line with intelligent weighting."""
        if "% done" not in line or "ETC:" not in line:
            return None
            
        try:
            # Extract percentage from line
            percentage = float(line.split("%")[0].split("About ")[-1].strip())
            
            # Detect current phase
            new_phase = self._detect_scan_phase(line)
            if new_phase != self.current_phase:
                self.current_phase = new_phase
                import time
                self.phase_start_times[new_phase] = time.time()
            
            # Slice size for each phase (equal distribution)
            slice_size = 100.0 / len(self.enabled_phases) if self.enabled_phases else 100.0

            # Determine index of current phase in enabled phases list
            try:
                phase_index = self.enabled_phases.index(self.current_phase)
            except ValueError:
                phase_index = 0  # Fallback, shouldn't happen

            # Completed portion from phases that are already finished
            completed_progress = phase_index * slice_size

            # Progress within the current phase
            current_phase_progress = (percentage / 100) * slice_size
            new_overall_progress = completed_progress + current_phase_progress


            # Ensure progress only increases (handle Nmap's phase transitions)
            if new_overall_progress > self.overall_progress:
                self.overall_progress = round(new_overall_progress, 2)
            

            self.last_sent_progress = self.overall_progress
            return min(self.overall_progress, round(random.uniform(75.12, 78.37), 2))
                
        except (ValueError, IndexError):
            pass
            
        return None

    def _generate_user_friendly_message(self, line: str) -> str | None:
        """Generate user-friendly messages from technical Nmap output."""
        import time
        import re
        
        line_lower = line.lower()
        
        # Skip timing lines entirely (we parse progress but don't display)
        if '% done' in line and 'etc:' in line_lower:
            return None
        
        if "using" in line_lower:
            return None
        
        if "error:" in line_lower:
            return None
            
        # Transform status update lines
        if 'stats:' in line_lower and 'elapsed' in line_lower:
            # Throttle status messages
            current_time = time.time()
            if current_time - self.last_status_message_time < self.STATUS_MESSAGE_INTERVAL:
                return None
            self.last_status_message_time = current_time
            
            # Extract elapsed time
            elapsed_match = re.search(r'(\d+:\d+:\d+|\d+:\d+) elapsed', line)
            if elapsed_match:
                elapsed = elapsed_match.group(1)
                
                # Generate phase-specific message
                if self.current_phase == 'host_discovery':
                    return f"[*] Discovering live hosts... ({elapsed} elapsed)"
                elif self.current_phase == 'tcp_scan':
                    return f"[*] Scanning TCP ports... ({elapsed} elapsed)"
                elif self.current_phase == 'udp_scan':
                    return f"[*] Scanning UDP ports... ({elapsed} elapsed)"
                elif self.current_phase == 'os_detection':
                    return f"[*] Detecting operating systems... ({elapsed} elapsed)"
                elif self.current_phase == 'service_detection':
                    return f"[*] Identifying services and versions... ({elapsed} elapsed)"
                elif self.current_phase == 'nse_scripts':
                    return f"[*] Running security scripts... ({elapsed} elapsed)"
                else:
                    return f"[*] Scanning in progress... ({elapsed} elapsed)"
            return None
            
        # Transform NSE thread messages
        if 'nse: active nse script threads' in line_lower:
            return None  # Skip these technical messages
            
        # Transform undergoing messages
        if 'undergoing' in line_lower:
            if 'syn stealth scan' in line_lower:
                return "[*] Performing TCP port scan..."
            elif 'udp scan' in line_lower:
                return "[*] Performing UDP port scan..."
            elif 'script scan' in line_lower:
                return "[*] Running security analysis scripts..."
            elif 'service scan' in line_lower:
                return "[*] Identifying running services..."
            return None
            
        # Let other meaningful messages pass through
        if any(keyword in line_lower for keyword in [
            'starting', 'completed', 'finished', 'discovered', 'failed', 'timeout'
        ]):
            return line
            
        return None

    def __process_scan_output(self, line: str, seen_lines: set) -> None:
        """Process a single line of scan output with smart filtering and progress tracking."""
        
        if not line:
            return
            
        # Always check for progress (but don't display timing lines)
        if "ETC:" in line:
            progress = self.parse_nmap_progress(line)
            if progress is not None:
                self.redis_client.publish(f"{self.config.scan_id}:progress", str(progress))
            return  # Don't display timing lines
        
        # Generate user-friendly message
        user_message = self._generate_user_friendly_message(line)
        if not user_message:
            return
            
        # Avoid sending duplicate messages
        if user_message in seen_lines:
            return
            
        seen_lines.add(user_message)
        
        # Store output in Redis and publish to WebSocket
        self._store_and_publish_message(user_message)

    def __check_alive(self) -> None:
        """
        Runs the Nmap command to check which targets are alive.
        The command is run with a timeout based on the total number of targets (excepting urls).
        The output is saved in a xml file.
        """
        import subprocess
        import time
        import logging
        import json

        HEARTBEAT_INTERVAL = 30  # seconds
        last_output_time = time.time()
        seen_lines = set()  # Track seen lines to avoid sending duplicates

        try:
            # URLs are checked and removed from the targets list.
            logging.debug("Starting check targets script...")
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            self.redis_client.publish(f"{self.config.scan_id}:progress", str(random.uniform(1.4, 2.8)))
            urls, responding_urls = get_responding_urls(self.config.targets)
            self.alive_targets.update(responding_urls)
            self.config.targets = list(set(self.config.targets) - set(urls))

            # Run Nmap only if there are targets left to check.
            if self.config.targets:
                cmd = self.config.get_cmd()
                logging.debug("Command to run: %s", cmd)
                process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                
                # Send initial information
                starting_message = f"Starting scan of {len(self.config.targets)} targets..."
                self._store_and_publish_message(starting_message)
                seen_lines.add(starting_message)

                while True:
                    line = process.stdout.readline()
                    if line:
                        line = line.strip()
                        self.__process_scan_output(line, seen_lines)
                        last_output_time = time.time()
                    else:
                        # No new output, check if process is still running
                        if process.poll() is not None:
                            break  # Process finished
                        # Heartbeat if needed
                        if time.time() - last_output_time > HEARTBEAT_INTERVAL:
                            heartbeat_msg = f"[heartbeat] Scan still running at {time.strftime('%H:%M:%S')}..."
                            self._store_and_publish_message(heartbeat_msg)
                            last_output_time = time.time()
                        time.sleep(0.5)  # Avoid busy loop

                process.stdout.close()
                return_code = process.wait()
                logging.debug("Nmap process finished with return code: %s", return_code)

                if return_code != 0:
                    self.status = "failed"
                    error_msg = "Scan failed. Please check the scan results for more details."
                    self._store_and_publish_message(error_msg)
                    self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
                    raise CheckTargetsException(f"Nmap process error: return code {return_code}")
                else:
                    completion_msg = "Scan completed!"
                    self._store_and_publish_message(completion_msg)

        except subprocess.CalledProcessError as process_exc:
            self.status = "failed"
            error_msg = f"Process error: {process_exc}"
            self._store_and_publish_message(error_msg)
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException("Nmap process error: " + str(process_exc)) from process_exc
        except subprocess.TimeoutExpired as timeout_exc:
            self.status = "failed"
            error_msg = f"Timeout error: {timeout_exc}"
            self._store_and_publish_message(error_msg)
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException("Timeout exceeded: " + str(timeout_exc)) from timeout_exc
        except Exception as exc:
            self.status = "failed"
            error_msg = f"Unexpected error: {exc}"
            self._store_and_publish_message(error_msg)
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            logging.error("Unexpected error in __check_alive: %s", exc)
            raise

    def __parse_output(self) -> None:
        """
        Parse the Nmap xml output file and append the alive targets to the alive_targets list.
        """

        if not os.path.isfile(self.config.output_file.name):
            self.status = "failed"
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException("Nmap xml output file does not exist.")

        # File is empty, no need to parse it.
        if os.stat(self.config.output_file.name).st_size == 0:
            return

        try:
            tree_root = ET.parse(self.config.output_file.name).getroot()
            nmap_results = CheckTargetsConfig.parse_scan_results(tree_root)
            for host in nmap_results:
                if host.status == "up":
                    self.alive_targets.add(host)
            self.__filter_network_and_broadcast_addresses()
        except ET.ParseError as parse_error:
            self.status = "failed"
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException("XML parse error: " + str(parse_error)) from parse_error
        except NmapParseException as nmap_parse_error:
            self.status = "failed"
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException(str(nmap_parse_error)) from nmap_parse_error
        finally:
            self.config.output_file.flush()
            self.config.output_file.close()

    def __filter_network_and_broadcast_addresses(self) -> None:
        """
        Removes the network and broadcast addresses from alive targets after the check alive process is done.
        It is necessary because Nmap, by default, scans all IPs from a CIDR block, including these addresses.
        The logic for adding targets does not account for these 2 addresses.
        """

        for target in self.config.targets:
            if not is_netblock_cidr(target):
                continue

            range_address = IPv4Network(target, strict=False)
            network_address = str(range_address.network_address)
            broadcast_address = str(range_address.broadcast_address)
            logging.debug(
                "Range: %s. Network Address : %s. Broadcast Address : %s",
                target,
                network_address,
                broadcast_address,
            )

            if network_address in self.alive_targets:
                self.alive_targets.remove(network_address)
            if broadcast_address in self.alive_targets:
                self.alive_targets.remove(broadcast_address)

    def __write_output(self) -> None:
        """Outputs the scan results in JSON format."""
        logging.debug("Alive targets: %s", self.alive_targets)
        try:
            self.status = "completed"
            results = {
                "scan_id": self.config.scan_id,
                "status": self.status,
                "scan_results": [
                    {
                        "ip_address": host.ip_address,
                        "hostname": host.hostname,
                        "status": host.status,
                        "last_seen": host.last_seen,
                        "reason": host.reason,
                        "os_info": host.os_info,
                        "ports": host.ports,
                        "traceroute": host.traceroute,
                        "ssl_info": host.ssl_info,
                        "http_headers": host.http_headers
                    }
                    for host in self.alive_targets
                ]
            }

            # Update Redis with completed status and scan results
            logging.debug("Writing results to Redis for scan id: %s", self.config.scan_id)
            # Store status in the scan:<scan_id> key
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            self.redis_client.publish(f"{self.config.scan_id}:progress", "100")
            # Store results in the scan_results:<scan_id> key
            self.redis_client.set(f"scan_results:{self.config.scan_id}", json.dumps(results["scan_results"]))
            
            logging.debug("Successfully wrote results to Redis for scan id: %s", self.config.scan_id)
            return results
        except redis.RedisError as e:
            logging.error("Failed to write results to Redis: %s", str(e))
            self.redis_client.set(f"scan:{self.config.scan_id}", json.dumps({"status": self.status}))
            raise CheckTargetsException(f"Redis write error: {str(e)}") from e

    def run(self):
        """Main function that runs the process of checking alive targets."""
        self.__check_alive()
        self.__parse_output()
        return self.__write_output()

    def _store_and_publish_message(self, message: str) -> None:
        """Store message in Redis and publish to WebSocket channel."""
        try:
            output_key = f"scan_output:{self.config.scan_id}"
            # Append to Redis list for ordered output
            self.redis_client.rpush(output_key, message)
            # Set expiration to 24 hours
            self.redis_client.expire(output_key, 86400)
        except Exception as e:
            import logging
            logging.warning(f"Failed to store output in Redis: {e}")
        
        # Also publish to WebSocket channel
        self.redis_client.publish(self.config.scan_id, message)


def parse_cli_arguments():
    """
    Parse known arguments (--targets, --scan-type) first to check the scan-type.
    If scan-type is DEFAULT, then no other arguments are needed and the check alive will run with default options.
    If scan-type is CUSTOM, then additional arguments will be parsed and their values will replace the default options.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", help="Targets to check.", required=True)
    parser.add_argument(
        "--scan-type",
        choices=[ScanType.DEFAULT.value, ScanType.CUSTOM.value, ScanType.DEEP.value],
        help="Type of scan to perform",
        default=ScanType.DEFAULT.value,
    )
    parser.add_argument("--scan-id", help="Scan ID", required=True)
    args, _ = parser.parse_known_args()

    if args.scan_type == ScanType.DEFAULT.value:
        logging.debug("Check targets script arguments: %s", args)
        return args

    parser.add_argument("--echo-request", help="Perform echo request.", action="store_true")
    parser.add_argument("--timestamp-request", help="Perform timestamp request.", action="store_true")
    parser.add_argument("--address-mask-request", help="Perform address mask request.", action="store_true")
    
    # New scan options
    parser.add_argument("--timing-flag", help="Timing flag", type=int, default=3)
    parser.add_argument("--os-detection", help="Enable OS detection", action="store_true")
    parser.add_argument("--service-version", help="Enable service/version detection", action="store_true")
    parser.add_argument("--aggressive", help="Enable aggressive scan mode", action="store_true")
    parser.add_argument("--traceroute", help="Enable traceroute", action="store_true")
    parser.add_argument("--ssl-scan", help="Enable SSL scan", action="store_true")
    parser.add_argument("--http-headers", help="Enable HTTP headers", action="store_true")


    # Port list arguments for scan types
    parser.add_argument("--tcp-syn-scan", help="Enable TCP SYN scan", action="store_true")
    parser.add_argument("--tcp-ack-scan", help="Enable TCP ACK scan", action="store_true")
    parser.add_argument("--tcp-connect-scan", help="Enable TCP connect scan", action="store_true")
    parser.add_argument("--tcp-window-scan", help="Enable TCP window scan", action="store_true")
    parser.add_argument("--tcp-null-scan", help="Enable TCP null scan", action="store_true")
    parser.add_argument("--tcp-fin-scan", help="Enable TCP FIN scan", action="store_true")
    parser.add_argument("--tcp-xmas-scan", help="Enable TCP XMAS scan", action="store_true")
    parser.add_argument("--tcp-ports", help="TCP ports to scan")
    parser.add_argument("--udp-ports", help="UDP ports to scan")

    args = parser.parse_args()
    logging.debug("Check targets script arguments: %s", args)
    return args
