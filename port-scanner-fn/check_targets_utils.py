import json
import logging
import ipaddress
import tempfile
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import certifi
import requests
import os
import more_itertools
import subprocess
import typing


def read_ports_file(filename: str) -> str:
    try:
        with open(filename, encoding="utf-8") as ports_file:
            result = ports_file.readlines()[0].rstrip("\r\n")
            return result
    except FileNotFoundError:
        logging.error(f"File not found: {filename}")
        return ""


def get_responding_urls(targets: list) -> tuple[list, set]:
    """
    Targets in url format (e.g. http://example.com) can't be checked with Nmap.
    In this case, a GET request is used.
    Responding URLs are returned along with the rest of the URLs.
    """
    responding_urls = set()
    urls = [target for target in targets if urlparse(target).hostname]

    for url in urls:
        try:
            session = requests.session()
            request = requests.Request("GET", url)
            prepared_request = session.prepare_request(request)
            prepared_request.prepare_url(url, [])
            session.send(prepared_request, verify=certifi.where(), timeout=DefaultValues.REQUEST_TIMEOUT)

            responding_urls.add(url)
            logging.debug("Found responding url: %s", url)
        except (requests.exceptions.RequestException, ValueError):
            continue
    return urls, responding_urls


def calculate_number_of_targets(targets: list[str]) -> int:
    """
    Calculate the number of targets based on the total number of targets.
    """
    expanded_targets_no = 0
    for target in targets:
        if is_ipv4_range(target):
            expanded_targets_no += get_number_of_ips_from_range(target)
        elif is_netblock_cidr(target):
            expanded_targets_no += ipaddress.IPv4Network(target, strict=False).num_addresses
        else:
            expanded_targets_no += 1
    return expanded_targets_no


def is_netblock_cidr(target: str) -> bool:
    if "/" not in target:
        return False
    try:
        ipaddress.ip_network(target, strict=False)
        return True
    except ValueError:
        return False


def is_ipv4_range(ip_range: str) -> bool:
    try:
        if "-" not in ip_range:
            return False

        base_ip, last_octet_range = ip_range.split("-")
        base_ip = base_ip.strip()
        last_octet_range = last_octet_range.strip()

        # Validate the base IP address
        ipaddress.IPv4Address(base_ip)

        last_octet = int(last_octet_range)
        if not (0 <= last_octet <= 255):
            return False

        base_ip_parts = base_ip.split(".")
        if len(base_ip_parts) != 4:
            return False

        base_last_octet = int(base_ip_parts[-1])
        if not (0 <= base_last_octet <= 255):
            return False

        return base_last_octet <= last_octet

    except (ValueError, TypeError, ipaddress.AddressValueError):
        return False


def get_number_of_ips_from_range(ip_range: str) -> int:
    """Calculate the number of IP addresses in a range in format 'x.x.x.x-y'"""

    if not is_ipv4_range(ip_range):
        return 0

    base_ip, last_octet_range = map(str.strip, ip_range.split("-"))
    try:
        first_ip = ipaddress.IPv4Address(base_ip)
        last_ip = ipaddress.IPv4Address(base_ip.rsplit(".", 1)[0] + "." + last_octet_range)
    except ipaddress.AddressValueError as e:
        logging.error("Error while parsing IP range: %s", e)
        return 0

    return int(last_ip) - int(first_ip) + 1


class NmapParseException(Exception):
    """Nmap parser failed"""


@dataclass
class DefaultValues:
    """
    Class that holds the scan type default configuration values for the check alive process.
    """

    REQUEST_TIMEOUT = 10


class ScanType(Enum):
    """
    Scan types which defines the Nmap configuration for the check alive process.
    """

    DEFAULT = "default"
    DEEP = "deep"
    CUSTOM = "custom"

    def __str__(self):
        return self.value


class CheckTargetsOptions:
    """
    Class that holds scan options for a Nmap command as they are passed from the user input.
    """

    MAX_RATE = 100000

    def __init__(
        self,
        echo_request: bool = False,
        timestamp_request: bool = False,
        address_mask_request: bool = False,
        timing_flag: str | int | None = None,
        os_detection: bool = False,
        service_version: bool = False,
        aggressive: bool = False,
        traceroute: bool = False,
        ssl_scan: bool = False,
        http_headers: bool = False,
        tcp_ports: str | None = None,
        udp_ports: str | None = None,
        tcp_syn_scan: bool = False,
        tcp_ack_scan: bool = False,
        tcp_connect_scan: bool = False,
        tcp_window_scan: bool = False,
        tcp_null_scan: bool  = False,
        tcp_fin_scan: bool  = False,
        tcp_xmas_scan: bool  = False,
    ):
        self.echo_request = echo_request
        self.timestamp_request = timestamp_request
        self.address_mask_request = address_mask_request
        self.timing_flag = timing_flag
        self.os_detection = os_detection
        self.service_version = service_version
        self.aggressive = aggressive
        self.traceroute = traceroute
        self.ssl_scan = ssl_scan
        self.http_headers = http_headers
        self.tcp_ports = tcp_ports
        self.udp_ports = udp_ports
        self.tcp_syn_scan = tcp_syn_scan
        self.tcp_ack_scan = tcp_ack_scan
        self.tcp_connect_scan = tcp_connect_scan
        self.tcp_window_scan = tcp_window_scan
        self.tcp_null_scan = tcp_null_scan
        self.tcp_fin_scan = tcp_fin_scan
        self.tcp_xmas_scan = tcp_xmas_scan

    def get_options_in_cmd_format(self):
        """
        Function that parses parameters in Nmap CLI format.
        """

        def get_echo_request_flag() -> str:
            return "-PE" if self.echo_request else ""

        def get_timestamp_request_flag() -> str:
            return "-PP" if self.timestamp_request else ""

        def get_address_mask_request_flag() -> str:
            return "-PM" if self.address_mask_request else ""
        
        def get_os_detection_flag() -> str:
            return "-O" if self.os_detection else ""

        def get_service_version_flag() -> str:
            return "-sV" if self.service_version else ""

        def get_aggressive_flag() -> str:
            return "-A" if self.aggressive else ""

        def get_traceroute_flag() -> str:
            return "--traceroute" if self.traceroute else ""
        
        def get_ssl_scan_flag() -> str:
            return "--script=ssl-cert,ssl-enum-ciphers" if self.ssl_scan else ""

        def get_http_headers_flag() -> str:
            return "--script=http-headers,http-title,http-server-header" if self.http_headers else ""

        # Get TCP scan type (only one can be used)
        def get_tcp_scan_flag() -> str:
            if self.tcp_syn_scan:
                return "-sS"
            elif self.tcp_ack_scan:
                return "-sA"
            elif self.tcp_window_scan:
                return "-sW"
            elif self.tcp_null_scan:
                return "-sN"
            elif self.tcp_fin_scan:
                return "-sF"
            elif self.tcp_xmas_scan:
                return "-sX"
            elif self.tcp_connect_scan:
                return "-sT"
            return ""
        
        def get_timing_flag() -> str:
            return f"-T{self.timing_flag}" if self.timing_flag is not None else ""

        def get_port_flags() -> tuple[str, str, str]:
            parts = []
            udp_scan_needed = False
            version_intensity = ""
            
            if self.tcp_ports:
                port_type, n = parse_top_ports_format(self.tcp_ports)
                if port_type == "top":
                    tcp_ports = get_top_ports("tcp", n)
                    if tcp_ports:
                        parts.append(f"T:{tcp_ports}")
                else:
                    parts.append(f"T:{self.tcp_ports}")
            
            if self.udp_ports:
                port_type, n = parse_top_ports_format(self.udp_ports)
                if port_type == "top":
                    udp_ports = get_top_ports("udp", n)
                    if udp_ports:
                        parts.append(f"U:{udp_ports}")
                        udp_scan_needed = True
                else:
                    parts.append(f"U:{self.udp_ports}")
                    udp_scan_needed = True
            
            if udp_scan_needed and self.service_version:
                version_intensity = "--version-intensity=0"
            
            if parts:
                return f"-p {','.join(parts)}", "-sU" if udp_scan_needed else "", version_intensity
            return "", "", ""

        return list(
            filter(
                None,
                [
                    get_echo_request_flag(),
                    get_timestamp_request_flag(),
                    get_address_mask_request_flag(),
                    get_os_detection_flag().split(),
                    get_service_version_flag().split(),
                    get_aggressive_flag().split(),
                    get_traceroute_flag().split(),
                    get_timing_flag().split(),
                    get_ssl_scan_flag().split(),
                    get_http_headers_flag().split(),
                    get_tcp_scan_flag().split(),
                    *get_port_flags(),
                ],
            )
        )

    def __str__(self):

        return json.dumps(
            {
                "echo_request": self.echo_request,
                "timestamp_request": self.timestamp_request,
                "address_mask_request": self.address_mask_request,
                "os_detection": self.os_detection,
                "service_version": self.service_version,
                "aggressive": self.aggressive,
                "traceroute": self.traceroute,
                "ssl_scan": self.ssl_scan,
                "http_headers": self.http_headers,
                "tcp_ports": self.tcp_ports,
                "udp_ports": self.udp_ports,
                "timing_flag": self.timing_flag,
                "tcp_syn_scan": self.tcp_syn_scan,
                "tcp_ack_scan": self.tcp_ack_scan,
                "tcp_connect_scan": self.tcp_connect_scan,
                "tcp_window_scan": self.tcp_window_scan,
                "tcp_null_scan": self.tcp_null_scan,
                "tcp_fin_scan": self.tcp_fin_scan,
                "tcp_xmas_scan": self.tcp_xmas_scan,
            }
        )

    @staticmethod
    def get_default_check_targets_options():
        return CheckTargetsOptions(
            echo_request=True,
            tcp_syn_scan=True,
            tcp_ports="top-100",
            timing_flag=5,
        )
    
    @staticmethod
    def get_deep_check_targets_options():
        return CheckTargetsOptions(
            echo_request=True,
            timestamp_request=True,
            address_mask_request=True,
            os_detection=True,
            service_version=True,
            traceroute=True,
            ssl_scan=True,
            http_headers=True,
            tcp_syn_scan=True,
            timing_flag=3,
            tcp_ports="top-5000",
            udp_ports="top-100"
        )


class Host:
    """
    Class that holds the information of a host in a Nmap scan.
    """

    def __init__(self):
        self.ip_address = ""
        self.hostname = ""
        self.status = ""
        self.last_seen = ""
        self.reason = ""
        self.os_info = {}
        self.ports = []
        self.traceroute = []
        self.ssl_info = {}
        self.http_headers = {}

    def __str__(self):
        return json.dumps(self.__dict__)

    def to_dict(self):
        return self.__dict__

    # Allow Host instances to be stored in a set / used as dict keys based on their IP.
    def __hash__(self):
        return hash(self.ip_address)

    def __eq__(self, other):
        if not isinstance(other, Host):
            return False
        return self.ip_address == other.ip_address


class CheckTargetsConfig:
    """Class that holds elements of a Nmap check alive command."""

    SOURCE_PORT = 53
    STATS_INTERVAL = 2

    def __init__(
        self,
        targets: list[str],
        scan_options: CheckTargetsOptions,
        scan_id: str,
    ):
        self.targets = targets
        self.scan_options = scan_options
        self.output_file = tempfile.NamedTemporaryFile(suffix=".xml", mode="w+t")
        self.scan_id = scan_id

    def get_cmd(self) -> list[str]:
        """Returns the Nmap command to be executed."""
        return list(
            more_itertools.collapse(
                [
                    "nmap",
                    "-n",
                    "-vvv",
                    "--reason",
                    "-PS21,22,23,25,53,80,110,143,443,3306,3343,3389,5060,5900,6379,8080,9443",
                    "-PU53,67,123",
                    "-PA21,22,80,443,445,3389,3306",
                    "--source-port",
                    str(self.SOURCE_PORT),
                    "--stats-every",
                    str(self.STATS_INTERVAL) + "s",
                    self.targets,
                    self.scan_options.get_options_in_cmd_format(),
                    "-oX",
                    self.output_file.name,
                ]
            )
        )

    @staticmethod
    def parse_scan_results(xml_tree_or_root: ET.Element | ET.ElementTree) -> list[Host]:
        """Parse an Nmap XML file (as ElementTree or Element) into a list of *Host* objects.

        The previous implementation sometimes returned hosts without any port information or
        crashed when certain optional XML nodes were missing.  This version is more defensive
        (all look-ups are guarded) and also captures extra script output in a generic *scripts*
        dictionary so we never silently drop data.
        """

        # Ensure we work with the *root* element irrespective of what has been passed in.
        root: ET.Element
        if isinstance(xml_tree_or_root, ET.Element):
            root = xml_tree_or_root
        else:
            root = xml_tree_or_root.getroot()

        results: list[Host] = []

        # Extract the *last seen* timestamp once (if present)
        runstats = root.find("runstats/finished")
        last_seen = runstats.get("timestr", "") if runstats is not None else ""

        for host_el in root.findall("host"):
            host_obj = Host()
            host_obj.last_seen = last_seen

            # ---------------------------
            # Basic host identification
            # ---------------------------
            addr_el = host_el.find("address[@addrtype='ipv4']") or host_el.find("address")
            if addr_el is not None:
                host_obj.ip_address = addr_el.get("addr", "")

            # Hostname (take the first user provided one, else the first name we see)
            hostnames_el = host_el.find("hostnames")
            if hostnames_el is not None:
                user_defined = hostnames_el.find("hostname[@type='user']")
                hn_el = user_defined if user_defined is not None else hostnames_el.find("hostname")
                if hn_el is not None:
                    host_obj.hostname = hn_el.get("name", "")

            status_el = host_el.find("status")
            if status_el is not None:
                host_obj.status = status_el.get("state", "")
                host_obj.reason = status_el.get("reason", "")

            # ---------------------------
            # Operating-system fingerprint
            # ---------------------------
            osmatch_el = host_el.find("os/osmatch")
            if osmatch_el is not None:
                host_obj.os_info = {
                    "name": osmatch_el.get("name", ""),
                    "accuracy": osmatch_el.get("accuracy", ""),
                    "classes": [],
                }

                for osclass in osmatch_el.findall("osclass"):
                    host_obj.os_info["classes"].append({
                        "type": osclass.get("type", ""),
                        "vendor": osclass.get("vendor", ""),
                        "osfamily": osclass.get("osfamily", ""),
                        "osgen": osclass.get("osgen", ""),
                        "accuracy": osclass.get("accuracy", ""),
                    })

            # ---------------------------
            # Port information
            # ---------------------------
            ports_list: list[dict] = []
            for port_el in host_el.findall("ports/port"):
                port_state_el = port_el.find("state")
                state = port_state_el.get("state", "") if port_state_el is not None else ""

                service_el = port_el.find("service")
                service_dict = {}
                if service_el is not None:
                    for attr in [
                        "name",
                        "product",
                        "version",
                        "extrainfo",
                        "ostype",
                        "method",
                        "conf",
                    ]:
                        if attr in service_el.attrib:
                            service_dict[attr] = service_el.attrib[attr]

                port_info: dict[str, typing.Any] = {
                    "port": int(port_el.get("portid", "0")),
                    "protocol": port_el.get("protocol", ""),
                    "state": state,
                    "service": service_dict,
                    "scripts": {},
                }

                # Capture *all* script outputs on this port, not just a selected few
                for script_el in port_el.findall("script"):
                    script_id = script_el.get("id", "unknown")
                    port_info["scripts"][script_id] = script_el.get("output", "")

                ports_list.append(port_info)

            # If Nmap emitted an <extraports> element (e.g. filtered ports) keep a synthetic record
            # so that we don't lose the information completely.
            for extraports_el in host_el.findall("ports/extraports"):
                state = extraports_el.get("state", "filtered")
                count = int(extraports_el.get("count", "0"))
                ports_list.append({
                    "port": None,
                    "protocol": extraports_el.get("proto", "tcp"),
                    "state": state,
                    "count": count,
                })

            host_obj.ports = ports_list

            # ---------------------------
            # Traceroute (if any)
            # ---------------------------
            traceroute: list[dict] = []
            for hop in host_el.findall("trace/hop"):
                traceroute.append({
                    "ttl": hop.get("ttl", ""),
                    "ipaddr": hop.get("ipaddr", ""),
                    "rtt": hop.get("rtt", ""),
                    "host": hop.get("host", ""),
                })
            host_obj.traceroute = traceroute

            # ---------------------------
            # Host-level scripts (e.g. ssl-cert etc.)
            # ---------------------------
            ssl_cert_el = host_el.find("script[@id='ssl-cert']")
            if ssl_cert_el is not None:
                host_obj.ssl_info["certificate"] = ssl_cert_el.get("output", "")

            ssl_ciphers_el = host_el.find("script[@id='ssl-enum-ciphers']")
            if ssl_ciphers_el is not None:
                host_obj.ssl_info["ciphers"] = ssl_ciphers_el.get("output", "")

            results.append(host_obj)

        return results


def get_top_ports(port_type: str, top_n: int) -> str:
    """
    Get top N ports by running list_nmap_top_ports.sh script.
    Args:
        port_type: Either 'tcp' or 'udp'
        top_n: Number of top ports to get
    Returns:
        String containing comma-separated ports
    """
    try:
        script_path = os.path.join(os.path.dirname(__file__), "list_nmap_top_ports.sh")
        result = subprocess.run(
            ["bash", script_path, port_type.upper(), str(top_n)],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        logging.error(f"Error running list_nmap_top_ports.sh: {e}")
        return ""
    except Exception as e:
        logging.error(f"Unexpected error getting top ports: {e}")
        return ""


def parse_top_ports_format(port_spec: str) -> tuple[str, int]:
    """Parse port specification in format "top-N" (e.g., top-100, top-1000)"""
    if not port_spec.startswith("top-"):
        return port_spec, 0
        
    try:
        n = int(port_spec.split("-")[1])
        return "top", n
    except (ValueError, IndexError):
        return port_spec, 0
