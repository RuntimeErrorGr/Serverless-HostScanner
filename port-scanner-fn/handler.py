import json
import logging
import sys
import base64
import os

from .check_targets import CheckTargets, CheckTargetsConfig, ScanType, parse_cli_arguments
from .check_targets_utils import CheckTargetsOptions

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

def handle(event, _):
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

        # Add scan id
        scan_id = input_data.get('scan_id', '')
        sys.argv.extend(['--scan-id', scan_id])
        
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

            if scan_options.get('timing_flag'):
                sys.argv.append('--timing-flag')
                sys.argv.append(str(scan_options['timing_flag']))
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

            if scan_options.get('tcp_ports'):
                sys.argv.extend(['--tcp-ports', scan_options['tcp_ports']])
            if scan_options.get('udp_ports'):
                sys.argv.extend(['--udp-ports', scan_options['udp_ports']])

            if scan_options.get('tcp_null_scan'):
                sys.argv.append('--tcp-null-scan')
            if scan_options.get('tcp_fin_scan'):
                sys.argv.append('--tcp-fin-scan')
            if scan_options.get('tcp_xmas_scan'):
                sys.argv.append('--tcp-xmas-scan')

            if scan_options.get('tcp_syn_scan'):
                sys.argv.append('--tcp-syn-scan')
            if scan_options.get('tcp_ack_scan'):
                sys.argv.append('--tcp-ack-scan')
            if scan_options.get('tcp_connect_scan'):
                sys.argv.append('--tcp-connect-scan')
            if scan_options.get('tcp_window_scan'):
                sys.argv.append('--tcp-window-scan')

        # Parse arguments using existing logic
        args = parse_cli_arguments()
        
        # Create config and run scan
        targets = base64.b64decode(args.targets).decode("utf-8").split(",")
        scan_type = ScanType(args.scan_type)
        logging.debug(f"Scan type: {scan_type}")
        if scan_type == ScanType.DEFAULT:
            scan_options = CheckTargetsOptions.get_default_check_targets_options()
        elif scan_type == ScanType.DEEP:
            scan_options = CheckTargetsOptions.get_deep_check_targets_options()
        else:
            scan_options = CheckTargetsOptions(
                echo_request=args.echo_request,
                timestamp_request=args.timestamp_request,
                address_mask_request=args.address_mask_request,
                os_detection=args.os_detection,
                service_version=args.service_version,
                aggressive=args.aggressive,
                traceroute=args.traceroute,
                ssl_scan=args.ssl_scan,
                http_headers=args.http_headers,
                tcp_syn_scan=args.tcp_syn_scan,
                tcp_ack_scan=args.tcp_ack_scan,
                tcp_connect_scan=args.tcp_connect_scan,
                tcp_window_scan=args.tcp_window_scan,
                tcp_null_scan=args.tcp_null_scan,
                tcp_fin_scan=args.tcp_fin_scan,
                tcp_xmas_scan=args.tcp_xmas_scan,
                tcp_ports=args.tcp_ports,
                udp_ports=args.udp_ports,
            )

        config = CheckTargetsConfig(targets, scan_options, scan_id)
        scanner = CheckTargets(config)
        results = scanner.run()

        # Return results
        return {
            "statusCode": 200,
            "body": json.dumps(results)
        }

    except Exception as e:
        logging.error(f"Error during scan: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "scan_id": scan_id})
        } 