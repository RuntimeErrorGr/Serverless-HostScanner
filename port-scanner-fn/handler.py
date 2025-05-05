import json
import logging
import sys
import base64
import os
from .check_targets import CheckTargets, CheckTargetsConfig, CheckTargetsOptions, ScanType, parse_cli_arguments

def _initialize_logging():
    log_file_path = os.getenv("LOGS_PATH", "/code/logs/") + "check_targets.log"
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    log_handler = logging.FileHandler(log_file_path)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)-8s %(filename)s %(funcName)s %(lineno)d  %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
    log_handler.setFormatter(formatter)
    log_handler.setLevel(logging.DEBUG)
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(log_handler)

def handle(event, context):
    try:
        # Parse input from OpenFaaS
        input_data = json.loads(event.body)
        _initialize_logging()
        # Convert input to command line arguments format
        sys.argv = ['check_targets.py']  # Reset argv
        
        # Add required arguments
        if 'targets' in input_data:
            encoded_targets = base64.b64encode(','.join(input_data['targets']).encode()).decode()
            sys.argv.extend(['--targets', encoded_targets])
        
        # Add scan type
        scan_type = input_data.get('scan_type', 'default')
        sys.argv.extend(['--scan-type', scan_type])
        
        # Add custom scan options if provided
        if scan_type.upper() == 'CUSTOM':
            scan_options = input_data.get('scan_options', {})
            logging.debug(f"Scan options: {scan_options}")
            if scan_options.get('echo_request'):
                sys.argv.append('--echo-request')
            if scan_options.get('timestamp_request'):
                sys.argv.append('--timestamp-request')
            if scan_options.get('address_mask_request'):
                sys.argv.append('--address-mask-request')
            if scan_options.get('ip_protocols_ping'):
                sys.argv.extend(['--ip-protocols-ping', scan_options['ip_protocols_ping']])
            if scan_options.get('tcp_ack_ping_ports'):
                sys.argv.extend(['--tcp-ack-ping-ports', scan_options['tcp_ack_ping_ports']])
            if scan_options.get('tcp_syn_ping_ports'):
                sys.argv.extend(['--tcp-syn-ping-ports', scan_options['tcp_syn_ping_ports']])
            if scan_options.get('udp_ping_ports'):
                sys.argv.extend(['--udp-ping-ports', scan_options['udp_ping_ports']])
            if scan_options.get('max_retries'):
                sys.argv.extend(['--max-retries', str(scan_options['max_retries'])])
            if scan_options.get('max_rtt_timeout'):
                sys.argv.extend(['--max-rtt-timeout', str(scan_options['max_rtt_timeout'])])
            if scan_options.get('max_scan_delay'):
                sys.argv.extend(['--max-scan-delay', str(scan_options['max_scan_delay'])])
            if scan_options.get('min_rate'):
                sys.argv.extend(['--min-rate', str(scan_options['min_rate'])])
            if scan_options.get('os_detection'):
                sys.argv.append('--os-detection')
            if scan_options.get('service_version'):
                sys.argv.append('--service-version')
            if scan_options.get('aggressive'):
                sys.argv.append('--aggressive')
            if scan_options.get('traceroute'):
                sys.argv.append('--traceroute')
            if scan_options.get('ssl_scan'):
                sys.argv.append('--ssl-scan')
            if scan_options.get('http_headers'):
                sys.argv.append('--http-headers')

        # Parse arguments using existing logic
        args = parse_cli_arguments()
        
        # Create config and run scan
        targets = base64.b64decode(args.targets).decode("utf-8").split(",")
        scan_type = ScanType(args.scan_type)
        logging.debug(f"Scan type: {scan_type}")
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

        config = CheckTargetsConfig(targets, scan_options)
        scanner = CheckTargets(config)
        scanner.run()

        # Return results
        return {
            "statusCode": 200,
            "body": json.dumps({"results": [host.to_dict() for host in scanner.alive_targets]})
        }

    except Exception as e:
        logging.error(f"Error during scan: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        } 