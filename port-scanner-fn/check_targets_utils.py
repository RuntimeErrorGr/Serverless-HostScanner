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
import more_itertools


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


def calculate_timeout(targets: list[str]) -> int:
    """
    Calculate exec_cmd timeout based on the total number of targets.
    """
    expanded_targets_no = 0
    for target in targets:
        if is_ipv4_range(target):
            expanded_targets_no += get_number_of_ips_from_range(target)
        elif is_netblock_cidr(target):
            expanded_targets_no += ipaddress.IPv4Network(target, strict=False).num_addresses
        else:
            expanded_targets_no += 1
    timeout = expanded_targets_no * 7200
    logging.debug("Number of targets: %s. Timeout: %s", expanded_targets_no, timeout)
    return timeout


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

    SCAN_DELAY = 10
    RTT_TIMEOUT = 550
    RETRIES = 7
    REQUEST_TIMEOUT = 20
    MIN_RATE = 100000
    IP_PROTOCOLS = {"icmp": 1, "igmp": 2, "ip_in_ip": 4, "tcp": 6, "sctp": 132}


class ScanType(Enum):
    """
    Scan types which defines the Nmap configuration for the check alive process.
    """

    DEFAULT = "default"
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
        ip_protocols_ping: str | None = None,
        tcp_ack_ping_ports: str | None = None,
        tcp_syn_ping_ports: str | None = None,
        udp_ping_ports: str | None = None,
        max_retries: int | None = None,
        max_rtt_timeout: int | None = None,
        max_scan_delay: int | None = None,
        min_rate: int | None = None,
        os_detection: bool = False,
        service_version: bool = False,
        aggressive: bool = False,
        traceroute: bool = False,
        ssl_scan: bool = False,
        http_headers: bool = False,
    ):
        self.echo_request = echo_request
        self.timestamp_request = timestamp_request
        self.address_mask_request = address_mask_request
        self.ip_protocols_ping = ip_protocols_ping
        self.tcp_ack_ping_ports = tcp_ack_ping_ports
        self.tcp_syn_ping_ports = tcp_syn_ping_ports
        self.udp_ping_ports = udp_ping_ports
        self.max_retries = max_retries
        self.max_rtt_timeout = max_rtt_timeout
        self.max_scan_delay = max_scan_delay
        self.min_rate = min_rate
        self.os_detection = os_detection
        self.service_version = service_version
        self.aggressive = aggressive
        self.traceroute = traceroute
        self.ssl_scan = ssl_scan
        self.http_headers = http_headers

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

        def get_ip_protocol_ping_flag() -> str:
            return f"-PO{self.ip_protocols_ping}" if self.ip_protocols_ping else ""

        def get_tcp_ack_ping_ports_flag() -> str:
            return f"-PA{self.tcp_ack_ping_ports}" if self.tcp_ack_ping_ports else ""

        def get_tcp_syn_ping_ports_flag() -> str:
            return f"-PS{self.tcp_syn_ping_ports}" if self.tcp_syn_ping_ports else ""

        def get_udp_ping_ports_flag() -> str:
            return f"-PU{self.udp_ping_ports}" if self.udp_ping_ports else ""

        def get_max_retries_flag() -> str:
            return f"--max-retries {self.max_retries}" if self.max_retries else ""

        def get_max_rtt_timeout_flag() -> str:
            return f"--max-rtt-timeout {self.max_rtt_timeout}ms" if self.max_rtt_timeout else ""

        def get_max_scan_delay_flag() -> str:
            return f"--max-scan-delay {self.max_scan_delay}ms" if self.max_scan_delay else ""

        def get_min_rate_flag() -> str:
            if self.min_rate and self.min_rate > self.MAX_RATE:
                return f"--min-rate {self.MAX_RATE}"
            return f"--min-rate {self.min_rate}" if self.min_rate else ""

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

        return list(
            filter(
                None,
                [
                    get_echo_request_flag(),
                    get_timestamp_request_flag(),
                    get_address_mask_request_flag(),
                    get_ip_protocol_ping_flag().split(),
                    get_tcp_ack_ping_ports_flag().split(),
                    get_tcp_syn_ping_ports_flag().split(),
                    get_udp_ping_ports_flag().split(),
                    get_max_retries_flag().split(),
                    get_max_rtt_timeout_flag().split(),
                    get_max_scan_delay_flag().split(),
                    get_min_rate_flag().split(),
                    get_os_detection_flag().split(),
                    get_service_version_flag().split(),
                    get_aggressive_flag().split(),
                    get_traceroute_flag().split(),
                    get_ssl_scan_flag().split(),
                    get_http_headers_flag().split(),
                ],
            )
        )

    def __str__(self):

        return json.dumps(
            {
                "echo_request": self.echo_request,
                "timestamp_request": self.timestamp_request,
                "address_mask_request": self.address_mask_request,
                "ip_protocol_ping": self.ip_protocols_ping,
                "tcp_ack_ping_ports": self.tcp_ack_ping_ports,
                "tcp_syn_ping_ports": self.tcp_syn_ping_ports,
                "udp_ping_ports": self.udp_ping_ports,
                "max_retries": self.max_retries,
                "max_rtt_timeout": self.max_rtt_timeout,
                "max_scan_delay": self.max_scan_delay,
                "min_rate": self.min_rate,
                "os_detection": self.os_detection,
                "service_version": self.service_version,
                "aggressive": self.aggressive,
                "traceroute": self.traceroute,
                "ssl_scan": self.ssl_scan,
                "http_headers": self.http_headers
            }
        )

    @staticmethod
    def get_default_check_targets_options():
        tcp_ack_ping_ports = tcp_syn_ping_ports = read_ports_file("/home/app/function/tcp.txt")
        udp_ping_ports = read_ports_file("/home/app/function/udp.txt")
        logging.debug(f"tcp_ack_ping_ports: {tcp_ack_ping_ports}")
        logging.debug(f"tcp_syn_ping_ports: {tcp_syn_ping_ports}")
        logging.debug(f"udp_ping_ports: {udp_ping_ports}")
        return CheckTargetsOptions(
            echo_request=True,
            timestamp_request=True,
            address_mask_request=True,
            ip_protocols_ping=",".join(map(str, DefaultValues.IP_PROTOCOLS.values())),
            tcp_ack_ping_ports=tcp_ack_ping_ports,
            tcp_syn_ping_ports=tcp_syn_ping_ports,
            udp_ping_ports=udp_ping_ports,
            max_retries=DefaultValues.RETRIES,
            max_rtt_timeout=DefaultValues.RTT_TIMEOUT,
            max_scan_delay=DefaultValues.SCAN_DELAY,
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


class CheckTargetsConfig:
    """Class that holds elements of a Nmap check alive command."""

    SOURCE_PORT = 53
    STATS_INTERVAL = 1

    def __init__(
        self,
        targets: list[str],
        scan_options: CheckTargetsOptions,
    ):
        self.targets = targets
        self.scan_options = scan_options
        self.output_file = tempfile.NamedTemporaryFile(suffix=".xml", mode="w+t")

    def get_cmd(self) -> list[str]:
        """Returns the Nmap command to be executed."""
        return list(
            more_itertools.collapse(
                [
                    "nmap",
                    "-n",
                    "--reason",
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
    def parse_scan_results(tree: ET.ElementTree) -> list[Host]:
        """
        Parse the Nmap output tree generated by a scan.
        :param tree: The ElementTree object of the Nmap output.
        :return: A list of Host objects.
        """
        nmap_results = []
        try:
            # Get last seen time from runstats
            runstats = tree.find("runstats/finished")
            last_seen = runstats.get("timestr", "") if runstats is not None else ""
            for host in tree.findall("host"):
                host_obj = Host()
                host_obj.last_seen = last_seen

                # Parse address information
                address = host.find("address")
                if address is not None:
                    host_obj.ip_address = address.get("addr", "")

                # Parse hostname information
                hostnames = host.find("hostnames")
                if hostnames is not None:
                    for hostname in hostnames.findall("hostname"):
                        if hostname.get("type") == "user":
                            host_obj.hostname = hostname.get("name", "")

                # Parse status information
                status = host.find("status")
                if status is not None:
                    host_obj.status = status.get("state", "")
                    host_obj.reason = status.get("reason", "")

                # Parse OS information
                os_info = {}
                osmatch = host.find("os/osmatch")
                if osmatch is not None:
                    os_info = {
                        "name": osmatch.get("name", ""),
                        "accuracy": osmatch.get("accuracy", ""),
                        "line": osmatch.get("line", ""),
                        "classes": []
                    }
                    for osclass in osmatch.findall("osclass"):
                        os_info["classes"].append({
                            "type": osclass.get("type", ""),
                            "vendor": osclass.get("vendor", ""),
                            "osfamily": osclass.get("osfamily", ""),
                            "osgen": osclass.get("osgen", ""),
                            "accuracy": osclass.get("accuracy", "")
                        })
                host_obj.os_info = os_info

                # Parse port information
                ports = []
                for port in host.findall("ports/port"):
                    port_info = {
                        "port": port.get("portid", ""),
                        "protocol": port.get("protocol", ""),
                        "state": port.find("state").get("state", "") if port.find("state") is not None else "",
                        "service": {
                            "name": port.find("service").get("name", "") if port.find("service") is not None else "",
                            "product": port.find("service").get("product", "") if port.find("service") is not None else "",
                            "version": port.find("service").get("version", "") if port.find("service") is not None else "",
                            "extrainfo": port.find("service").get("extrainfo", "") if port.find("service") is not None else "",
                            "ostype": port.find("service").get("ostype", "") if port.find("service") is not None else "",
                            "method": port.find("service").get("method", "") if port.find("service") is not None else "",
                            "conf": port.find("service").get("conf", "") if port.find("service") is not None else ""
                        }
                    }

                    # Parse SSL/TLS information for this port
                    ssl_cert = port.find("script[@id='ssl-cert']")
                    if ssl_cert is not None:
                        port_info["ssl_info"] = {
                            "certificate": ssl_cert.get("output", ""),
                            "subject": ssl_cert.find("table[@key='subject']/elem[@key='commonName']").text if ssl_cert.find("table[@key='subject']/elem[@key='commonName']") is not None else None,
                            "issuer": ssl_cert.find("table[@key='issuer']/elem[@key='commonName']").text if ssl_cert.find("table[@key='issuer']/elem[@key='commonName']") is not None else None,
                            "validity": {
                                "not_before": ssl_cert.find("table[@key='validity']/elem[@key='notBefore']").text if ssl_cert.find("table[@key='validity']/elem[@key='notBefore']") is not None else None,
                                "not_after": ssl_cert.find("table[@key='validity']/elem[@key='notAfter']").text if ssl_cert.find("table[@key='validity']/elem[@key='notAfter']") is not None else None
                            }
                        }

                    # Parse HTTP headers for this port
                    http_headers = port.find("script[@id='http-headers']")
                    if http_headers is not None:
                        port_info["http_headers"] = http_headers.get("output", "")

                    # Parse HTTP server header for this port
                    http_server = port.find("script[@id='http-server-header']")
                    if http_server is not None:
                        port_info["http_server"] = http_server.get("output", "")

                    # Parse HTTP title for this port
                    http_title = port.find("script[@id='http-title']")
                    if http_title is not None:
                        port_info["http_title"] = http_title.get("output", "")

                    ports.append(port_info)
                host_obj.ports = ports

                # Parse traceroute information
                traceroute = []
                for hop in host.findall("trace/hop"):
                    traceroute.append({
                        "ttl": hop.get("ttl", ""),
                        "ipaddr": hop.get("ipaddr", ""),
                        "rtt": hop.get("rtt", ""),
                        "host": hop.get("host", "")
                    })
                host_obj.traceroute = traceroute

                # Parse SSL/TLS information
                ssl_cert = host.find("script[@id='ssl-cert']")
                if ssl_cert is not None:
                    host_obj.ssl_info = {
                        "certificate": ssl_cert.get("output", ""),
                        "issuer": ssl_cert.find("elem[@key='issuer']").text if ssl_cert.find("elem[@key='issuer']") is not None else None,
                        "validity": ssl_cert.find("elem[@key='validity']").text if ssl_cert.find("elem[@key='validity']") is not None else None
                    }

                # Parse SSL ciphers
                ssl_ciphers = host.find("script[@id='ssl-enum-ciphers']")
                if ssl_ciphers is not None:
                    if "ssl_info" not in host_obj.ssl_info:
                        host_obj.ssl_info = {}
                    host_obj.ssl_info["ciphers"] = ssl_ciphers.get("output", "")

                nmap_results.append(host_obj)
        except Exception as exc:
            raise NmapParseException(f"Could not parse Nmap tree: {exc}") from exc
        return nmap_results
