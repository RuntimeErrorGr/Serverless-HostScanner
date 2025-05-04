#!/usr/bin/env python
"""
This script handles the process of checking responding targets.
"""
import argparse
import base64
import logging
import os
import sys
import subprocess
import xml.etree.ElementTree as ET
from ipaddress import IPv4Network
from dotenv import load_dotenv
import json

from .check_targets_utils import (
    CheckTargetsConfig,
    CheckTargetsOptions,
    ScanType,
    NmapParseException,
    get_responding_urls,
    calculate_timeout,
    is_netblock_cidr,
)


class CheckTargetsException(Exception):
    """Base class for check targets exceptions."""


class CheckTargets:
    """Class that holds information about the check alive process."""

    def __init__(self, config: CheckTargetsConfig) -> None:
        self.config = config
        self.alive_targets: set[str] = set()


    def __check_alive(self) -> None:
        """
        Runs the Nmap command to check which targets are alive.
        The command is run with a timeout based on the total number of targets (excepting urls).
        The output is saved in a xml file.
        """

        try:
            # URLs are checked and removed from the targets list.
            urls, responding_urls = get_responding_urls(self.config.targets)
            self.alive_targets.update(responding_urls)
            self.config.targets = list(set(self.config.targets) - set(urls))

            # Run Nmap only if there are targets left to check.
            if self.config.targets:
                cmd = self.config.get_cmd()
                logging.debug("Command to run: %s", cmd)
                timeout = calculate_timeout(self.config.targets)
                process = subprocess.run(
                    cmd,
                    timeout=timeout,
                    check=True,
                    capture_output=True,
                )
                logging.debug("Nmap process finished with return code: %s", process.returncode)
        except subprocess.CalledProcessError as process_exc:
            raise CheckTargetsException("Nmap process error: " + str(process_exc)) from process_exc
        except subprocess.TimeoutExpired as timeout_exc:
            raise CheckTargetsException("Timeout exceeded: " + str(timeout_exc)) from timeout_exc

    def __parse_output(self) -> None:
        """
        Parse the Nmap xml output file and append the alive targets to the alive_targets list.
        """

        if not os.path.isfile(self.config.output_file.name):
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
            raise CheckTargetsException("XML parse error: " + str(parse_error)) from parse_error
        except NmapParseException as nmap_parse_error:
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
        results = {
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
        sys.stdout.write(json.dumps(results, indent=2))
        sys.stdout.flush()

    def run(self):
        """Main function that runs the process of checking alive targets."""
        logging.debug("Starting check targets script...")
        self.__check_alive()
        self.__parse_output()
        self.__write_output()






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
        choices=[ScanType.DEFAULT.value, ScanType.CUSTOM.value],
        help="Type of scan to perform",
        default=ScanType.DEFAULT.value,
    )

    args, _ = parser.parse_known_args()

    if args.scan_type == ScanType.DEFAULT.value:
        logging.debug("Check targets script arguments: %s", args)
        return args

    parser.add_argument("--echo-request", help="Perform echo request.", action="store_true")
    parser.add_argument("--timestamp-request", help="Perform timestamp request.", action="store_true")
    parser.add_argument("--address-mask-request", help="Perform address mask request.", action="store_true")
    parser.add_argument("--ip-protocols-ping", help="Protocols for IP protocol ping.")
    parser.add_argument("--tcp-ack-ping-ports", help="Ports for TCP ACK ping.")
    parser.add_argument("--tcp-syn-ping-ports", help="Ports for TCP SYN ping.")
    parser.add_argument("--udp-ping-ports", help="Ports for UDP ping.")
    parser.add_argument("--max-retries", type=int, help="Max retries for a probe.")
    parser.add_argument("--max-rtt-timeout", type=int, help="Max retransmision timeout for a probe.")
    parser.add_argument("--max-scan-delay", type=int, help="Max scan delay.")
    parser.add_argument("--min-rate", type=int, help="Min number of transmitted packets per second.")
    
    # New scan options
    parser.add_argument("--os-detection", help="Enable OS detection", action="store_true")
    parser.add_argument("--service-version", help="Enable service/version detection", action="store_true")
    parser.add_argument("--aggressive", help="Enable aggressive scan mode", action="store_true")
    parser.add_argument("--traceroute", help="Enable traceroute", action="store_true")
    parser.add_argument("--ssl-scan", help="Enable SSL scan", action="store_true")
    parser.add_argument("--http-headers", help="Enable HTTP headers", action="store_true")

    args = parser.parse_args()
    logging.debug("Check targets script arguments: %s", args)
    return args


def main():
    load_dotenv()
    logging.debug("Starting check targets script...")
    args = parse_cli_arguments()

    try:
        targets = base64.b64decode(args.targets).decode("utf-8").split(",")
        logging.debug("Targets to check: %s", str(targets))
        scan_type = ScanType(args.scan_type)
        logging.debug("Scan type: %s", scan_type)

        if scan_type == ScanType.DEFAULT:
            scan_options = CheckTargetsOptions.get_default_check_targets_options()
        else:
            scan_options = CheckTargetsOptions(
                echo_request=args.echo_request,
                timestamp_request=args.timestamp_request,
                address_mask_request=args.address_mask_request,
                ip_protocols_ping=args.ip_protocols_ping,
                tcp_ack_ping_ports=args.tcp_ack_ping_ports,
                tcp_syn_ping_ports=args.tcp_syn_ping_ports,
                udp_ping_ports=args.udp_ping_ports,
                max_retries=args.max_retries,
                max_rtt_timeout=args.max_rtt_timeout,
                max_scan_delay=args.max_scan_delay,
                min_rate=args.min_rate,
                os_detection=args.os_detection,
                service_version=args.service_version,
                aggressive=args.aggressive,
                traceroute=args.traceroute,
                ssl_scan=args.ssl_scan,
                http_headers=args.http_headers
            )
        CheckTargets(CheckTargetsConfig(targets, scan_options)).run()
    except CheckTargetsException as issue:
        logging.exception("Check targets status: [Finished]. %s", issue)
        sys.exit(1)
    except Exception as issue:
        logging.exception("Check targets status: [Finished]. Unknown issue: %s", issue)
        sys.exit(1)


if __name__ == "__main__":
    main()
