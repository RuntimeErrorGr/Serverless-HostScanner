#!/usr/bin/env python3
"""
Unit tests for check_targets_utils.py
"""

import pytest
import tempfile
import os
import json
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch, mock_open, MagicMock
from datetime import datetime
import requests
import subprocess
import ipaddress

from check_targets_utils import (
    read_ports_file,
    get_responding_urls,
    calculate_number_of_targets,
    is_netblock_cidr,
    is_ipv4_range,
    get_number_of_ips_from_range,
    CheckTargetsOptions,
    Host,
    CheckTargetsConfig,
    get_top_ports,
    parse_top_ports_format,
    ScanType,
    NmapParseException,
    DefaultValues
)


class TestUtilityFunctions:
    """Test utility functions from check_targets_utils.py"""

    def test_read_ports_file_success(self):
        """Test successful reading of ports file"""
        test_content = "80,443,22,21,25\n"
        with patch("builtins.open", mock_open(read_data=test_content)):
            result = read_ports_file("test_ports.txt")
            assert result == "80,443,22,21,25"

    def test_read_ports_file_not_found(self):
        """Test reading non-existent ports file"""
        with patch("builtins.open", side_effect=FileNotFoundError):
            result = read_ports_file("nonexistent.txt")
            assert result == ""

    def test_read_ports_file_with_carriage_return(self):
        """Test reading ports file with carriage return"""
        test_content = "80,443,22\r\n"
        with patch("builtins.open", mock_open(read_data=test_content)):
            result = read_ports_file("test_ports.txt")
            assert result == "80,443,22"

    @patch('requests.session')
    @patch('certifi.where')
    def test_get_responding_urls_success(self, mock_certifi, mock_session):
        """Test successful URL response checking"""
        # Setup mocks
        mock_certifi.return_value = "/path/to/certs"
        mock_response = Mock()
        mock_session_instance = Mock()
        mock_session.return_value = mock_session_instance
        mock_session_instance.send.return_value = mock_response
        
        targets = ["http://example.com", "192.168.1.1", "https://test.com"]
        
        urls, responding_urls = get_responding_urls(targets)
        
        assert urls == ["http://example.com", "https://test.com"]
        assert len(responding_urls) == 2
        assert all(isinstance(host, Host) for host in responding_urls)
        assert all(host.status == "up" for host in responding_urls)

    @patch('requests.session')
    def test_get_responding_urls_request_exception(self, mock_session):
        """Test URL checking with request exceptions"""
        mock_session_instance = Mock()
        mock_session.return_value = mock_session_instance
        mock_session_instance.send.side_effect = requests.exceptions.RequestException
        
        targets = ["http://example.com"]
        
        urls, responding_urls = get_responding_urls(targets)
        
        assert urls == ["http://example.com"]
        assert responding_urls == []

    def test_calculate_number_of_targets_single_ips(self):
        """Test calculating number of targets for single IPs"""
        targets = ["192.168.1.1", "10.0.0.1", "example.com"]
        result = calculate_number_of_targets(targets)
        assert result == 3

    def test_calculate_number_of_targets_cidr(self):
        """Test calculating number of targets for CIDR blocks"""
        targets = ["192.168.1.0/24", "10.0.0.0/30"]
        result = calculate_number_of_targets(targets)
        assert result == 256 + 4  # /24 = 256 addresses, /30 = 4 addresses

    def test_calculate_number_of_targets_ip_range(self):
        """Test calculating number of targets for IP ranges"""
        targets = ["192.168.1.1-5", "10.0.0.1-10"]
        result = calculate_number_of_targets(targets)
        assert result == 5 + 10  # 1-5 = 5 IPs, 1-10 = 10 IPs

    def test_calculate_number_of_targets_mixed(self):
        """Test calculating number of targets for mixed formats"""
        targets = ["192.168.1.1", "10.0.0.0/30", "172.16.1.1-5"]
        result = calculate_number_of_targets(targets)
        assert result == 1 + 4 + 5

    def test_is_netblock_cidr_valid(self):
        """Test valid CIDR block detection"""
        assert is_netblock_cidr("192.168.1.0/24") is True
        assert is_netblock_cidr("10.0.0.0/8") is True
        assert is_netblock_cidr("172.16.0.0/16") is True

    def test_is_netblock_cidr_invalid(self):
        """Test invalid CIDR block detection"""
        assert is_netblock_cidr("192.168.1.1") is False
        assert is_netblock_cidr("192.168.1.1-5") is False
        assert is_netblock_cidr("invalid/24") is False
        assert is_netblock_cidr("192.168.1.0/33") is False

    def test_is_ipv4_range_valid(self):
        """Test valid IPv4 range detection"""
        assert is_ipv4_range("192.168.1.1-5") is True
        assert is_ipv4_range("10.0.0.1-255") is True
        assert is_ipv4_range("172.16.1.100-200") is True

    def test_is_ipv4_range_invalid(self):
        """Test invalid IPv4 range detection"""
        assert is_ipv4_range("192.168.1.1") is False
        assert is_ipv4_range("192.168.1.1/24") is False
        assert is_ipv4_range("192.168.1.1-256") is False  # Invalid last octet
        assert is_ipv4_range("192.168.1.5-1") is False    # Start > end
        assert is_ipv4_range("invalid-5") is False

    def test_get_number_of_ips_from_range_valid(self):
        """Test calculating IPs from valid ranges"""
        assert get_number_of_ips_from_range("192.168.1.1-5") == 5
        assert get_number_of_ips_from_range("10.0.0.1-10") == 10
        assert get_number_of_ips_from_range("172.16.1.100-200") == 101

    def test_get_number_of_ips_from_range_invalid(self):
        """Test calculating IPs from invalid ranges"""
        assert get_number_of_ips_from_range("192.168.1.1") == 0
        assert get_number_of_ips_from_range("invalid-range") == 0

    @patch('subprocess.run')
    def test_get_top_ports_success(self, mock_run):
        """Test successful top ports retrieval"""
        mock_run.return_value.stdout = "80,443,22,21,25"
        mock_run.return_value.returncode = 0
        
        result = get_top_ports("tcp", 5)
        
        assert result == "80,443,22,21,25"
        mock_run.assert_called_once()

    @patch('subprocess.run')
    def test_get_top_ports_script_error(self, mock_run):
        """Test top ports retrieval with script error"""
        mock_run.side_effect = subprocess.CalledProcessError(1, "bash")
        
        result = get_top_ports("tcp", 5)
        
        assert result == ""

    @patch('subprocess.run')
    def test_get_top_ports_unexpected_error(self, mock_run):
        """Test top ports retrieval with unexpected error"""
        mock_run.side_effect = Exception("Unexpected error")
        
        result = get_top_ports("tcp", 5)
        
        assert result == ""

    def test_parse_top_ports_format_valid(self):
        """Test parsing valid top ports format"""
        port_type, n = parse_top_ports_format("top-100")
        assert port_type == "top"
        assert n == 100
        
        port_type, n = parse_top_ports_format("top-1000")
        assert port_type == "top"
        assert n == 1000

    def test_parse_top_ports_format_invalid(self):
        """Test parsing invalid top ports format"""
        port_type, n = parse_top_ports_format("80,443,22")
        assert port_type == "80,443,22"
        assert n == 0
        
        port_type, n = parse_top_ports_format("top-invalid")
        assert port_type == "top-invalid"
        assert n == 0


class TestCheckTargetsOptions:
    """Test CheckTargetsOptions class"""

    def test_init_default_values(self):
        """Test initialization with default values"""
        options = CheckTargetsOptions()
        
        assert options.echo_request is False
        assert options.timestamp_request is False
        assert options.address_mask_request is False
        assert options.timing_flag is None
        assert options.os_detection is False
        assert options.service_version is False
        assert options.aggressive is False
        assert options.traceroute is False
        assert options.ssl_scan is False
        assert options.http_headers is False
        assert options.tcp_ports is None
        assert options.udp_ports is None

    def test_init_custom_values(self):
        """Test initialization with custom values"""
        options = CheckTargetsOptions(
            echo_request=True,
            timing_flag=4,
            os_detection=True,
            tcp_ports="80,443",
            udp_ports="53,123"
        )
        
        assert options.echo_request is True
        assert options.timing_flag == 4
        assert options.os_detection is True
        assert options.tcp_ports == "80,443"
        assert options.udp_ports == "53,123"

    @patch('check_targets_utils.get_top_ports')
    def test_get_options_in_cmd_format_basic(self, mock_get_top_ports):
        """Test basic command format generation"""
        mock_get_top_ports.return_value = "80,443,22"
        
        options = CheckTargetsOptions(
            echo_request=True,
            tcp_syn_scan=True,
            tcp_ports="top-3"
        )
        
        cmd_options = options.get_options_in_cmd_format()
        
        # Should contain echo request and SYN scan flags
        flat_options = [item for sublist in cmd_options for item in (sublist if isinstance(sublist, list) else [sublist])]
        assert "-PE" in flat_options
        assert "-sS" in flat_options
        assert "-p T:80,443,22" in flat_options

    def test_get_options_in_cmd_format_timing(self):
        """Test timing flag in command format"""
        options = CheckTargetsOptions(timing_flag=4)
        cmd_options = options.get_options_in_cmd_format()
        
        flat_options = [item for sublist in cmd_options for item in (sublist if isinstance(sublist, list) else [sublist])]
        assert "-T4" in flat_options

    def test_get_options_in_cmd_format_tcp_scan_types(self):
        """Test different TCP scan types"""
        scan_types = [
            ("tcp_syn_scan", "-sS"),
            ("tcp_ack_scan", "-sA"),
            ("tcp_connect_scan", "-sT"),
            ("tcp_window_scan", "-sW"),
            ("tcp_null_scan", "-sN"),
            ("tcp_fin_scan", "-sF"),
            ("tcp_xmas_scan", "-sX")
        ]
        
        for scan_attr, expected_flag in scan_types:
            options = CheckTargetsOptions(**{scan_attr: True})
            cmd_options = options.get_options_in_cmd_format()
            flat_options = [item for sublist in cmd_options for item in (sublist if isinstance(sublist, list) else [sublist])]
            assert expected_flag in flat_options

    def test_str_representation(self):
        """Test string representation of options"""
        options = CheckTargetsOptions(echo_request=True, timing_flag=4)
        str_repr = str(options)
        
        # Should be valid JSON
        parsed = json.loads(str_repr)
        assert parsed["echo_request"] is True
        assert parsed["timing_flag"] == 4

    def test_get_default_check_targets_options(self):
        """Test default options factory method"""
        options = CheckTargetsOptions.get_default_check_targets_options()
        
        assert options.echo_request is True
        assert options.tcp_syn_scan is True
        assert options.tcp_ports == "top-100"
        assert options.timing_flag == 5

    def test_get_deep_check_targets_options(self):
        """Test deep scan options factory method"""
        options = CheckTargetsOptions.get_deep_check_targets_options()
        
        assert options.echo_request is True
        assert options.timestamp_request is True
        assert options.address_mask_request is True
        assert options.os_detection is True
        assert options.service_version is True
        assert options.traceroute is True
        assert options.ssl_scan is True
        assert options.http_headers is True
        assert options.tcp_syn_scan is True
        assert options.timing_flag == 3
        assert options.tcp_ports == "top-5000"
        assert options.udp_ports == "top-100"


class TestHost:
    """Test Host class"""

    def test_host_initialization(self):
        """Test Host initialization"""
        host = Host()
        
        assert host.ip_address == ""
        assert host.hostname == ""
        assert host.status == ""
        assert host.last_seen == ""
        assert host.reason == ""
        assert host.os_info == {}
        assert host.ports == []
        assert host.traceroute == []
        assert host.ssl_info == {}
        assert host.http_headers == {}

    def test_host_with_data(self):
        """Test Host with actual data"""
        host = Host()
        host.ip_address = "192.168.1.1"
        host.hostname = "test.example.com"
        host.status = "up"
        host.last_seen = "2023-01-01T00:00:00"
        host.reason = "syn-ack"
        
        assert host.ip_address == "192.168.1.1"
        assert host.hostname == "test.example.com"
        assert host.status == "up"

    def test_host_str_representation(self):
        """Test Host string representation"""
        host = Host()
        host.ip_address = "192.168.1.1"
        host.status = "up"
        
        str_repr = str(host)
        parsed = json.loads(str_repr)
        
        assert parsed["ip_address"] == "192.168.1.1"
        assert parsed["status"] == "up"

    def test_host_to_dict(self):
        """Test Host to_dict method"""
        host = Host()
        host.ip_address = "192.168.1.1"
        host.status = "up"
        
        host_dict = host.to_dict()
        
        assert host_dict["ip_address"] == "192.168.1.1"
        assert host_dict["status"] == "up"

    def test_host_hash_and_equality(self):
        """Test Host hash and equality based on IP address"""
        host1 = Host()
        host1.ip_address = "192.168.1.1"
        
        host2 = Host()
        host2.ip_address = "192.168.1.1"
        
        host3 = Host()
        host3.ip_address = "192.168.1.2"
        
        # Same IP should be equal and have same hash
        assert host1 == host2
        assert hash(host1) == hash(host2)
        
        # Different IP should not be equal
        assert host1 != host3
        assert hash(host1) != hash(host3)
        
        # Can be used in sets
        host_set = {host1, host2, host3}
        assert len(host_set) == 2  # host1 and host2 are considered same


class TestCheckTargetsConfig:
    """Test CheckTargetsConfig class"""

    def test_config_initialization(self):
        """Test CheckTargetsConfig initialization"""
        targets = ["192.168.1.1", "example.com"]
        options = CheckTargetsOptions()
        scan_id = "test-scan-123"
        
        config = CheckTargetsConfig(targets, options, scan_id)
        
        assert config.targets == targets
        assert config.scan_options == options
        assert config.scan_id == scan_id
        assert hasattr(config.output_file, 'name')
        assert config.output_file.name.endswith('.xml')

    def test_get_cmd_basic(self):
        """Test basic command generation"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions(echo_request=True)
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        cmd = config.get_cmd()
        
        assert cmd[0] == "nmap"
        assert "192.168.1.1" in cmd
        assert "-PE" in cmd
        assert "-oX" in cmd
        assert config.output_file.name in cmd

    def test_get_cmd_with_complex_options(self):
        """Test command generation with complex options"""
        targets = ["192.168.1.0/24"]
        options = CheckTargetsOptions(
            echo_request=True,
            os_detection=True,
            tcp_syn_scan=True,
            timing_flag=4
        )
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        cmd = config.get_cmd()
        
        assert "nmap" in cmd
        assert "192.168.1.0/24" in cmd
        assert "-PE" in cmd
        assert "-O" in cmd
        assert "-sS" in cmd
        assert "-T4" in cmd

    def test_parse_scan_results_basic(self):
        """Test basic XML parsing"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <runstats>
                <finished timestr="2023-01-01 00:00:00 UTC"/>
            </runstats>
            <host>
                <address addr="192.168.1.1" addrtype="ipv4"/>
                <status state="up" reason="syn-ack"/>
                <hostnames>
                    <hostname name="test.example.com" type="user"/>
                </hostnames>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert host.ip_address == "192.168.1.1"
        assert host.status == "up"
        assert host.reason == "syn-ack"
        assert host.hostname == "test.example.com"
        assert host.last_seen == "2023-01-01 00:00:00 UTC"

    def test_parse_scan_results_with_ports(self):
        """Test XML parsing with port information"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <host>
                <address addr="192.168.1.1" addrtype="ipv4"/>
                <status state="up" reason="syn-ack"/>
                <ports>
                    <port protocol="tcp" portid="80">
                        <state state="open" reason="syn-ack" reason_ttl="64"/>
                        <service name="http" product="Apache" version="2.4.41"/>
                        <script id="http-title" output="Test Page"/>
                    </port>
                    <port protocol="tcp" portid="443">
                        <state state="closed" reason="reset" reason_ttl="64"/>
                    </port>
                </ports>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert len(host.ports) == 2
        
        # Check first port (HTTP)
        port1 = host.ports[0]
        assert port1["port"] == 80
        assert port1["protocol"] == "tcp"
        assert port1["state"] == "open"
        assert port1["reason"] == "syn-ack"
        assert port1["service"]["name"] == "http"
        assert port1["service"]["product"] == "Apache"
        assert port1["service"]["version"] == "2.4.41"
        assert port1["scripts"]["http-title"] == "Test Page"
        
        # Check second port (HTTPS)
        port2 = host.ports[1]
        assert port2["port"] == 443
        assert port2["state"] == "closed"

    def test_parse_scan_results_with_os_info(self):
        """Test XML parsing with OS information"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <host>
                <address addr="192.168.1.1" addrtype="ipv4"/>
                <status state="up" reason="syn-ack"/>
                <os>
                    <osmatch name="Linux 3.2 - 4.9" accuracy="95">
                        <osclass type="general purpose" vendor="Linux" osfamily="Linux" osgen="3.X" accuracy="95"/>
                        <osclass type="general purpose" vendor="Linux" osfamily="Linux" osgen="4.X" accuracy="90"/>
                    </osmatch>
                </os>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert host.os_info["name"] == "Linux 3.2 - 4.9"
        assert host.os_info["accuracy"] == "95"
        assert len(host.os_info["classes"]) == 2
        
        os_class = host.os_info["classes"][0]
        assert os_class["type"] == "general purpose"
        assert os_class["vendor"] == "Linux"
        assert os_class["osfamily"] == "Linux"

    def test_parse_scan_results_with_traceroute(self):
        """Test XML parsing with traceroute information"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <host>
                <address addr="192.168.1.1" addrtype="ipv4"/>
                <status state="up" reason="syn-ack"/>
                <trace>
                    <hop ttl="1" ipaddr="192.168.1.254" rtt="1.23" host="gateway.local"/>
                    <hop ttl="2" ipaddr="10.0.0.1" rtt="5.67"/>
                </trace>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert len(host.traceroute) == 2
        
        hop1 = host.traceroute[0]
        assert hop1["ttl"] == "1"
        assert hop1["ipaddr"] == "192.168.1.254"
        assert hop1["rtt"] == "1.23"
        assert hop1["host"] == "gateway.local"
        
        hop2 = host.traceroute[1]
        assert hop2["ttl"] == "2"
        assert hop2["ipaddr"] == "10.0.0.1"
        assert hop2["rtt"] == "5.67"
        assert hop2["host"] == ""

    def test_parse_scan_results_with_ssl_info(self):
        """Test XML parsing with SSL script information"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <host>
                <address addr="192.168.1.1" addrtype="ipv4"/>
                <status state="up" reason="syn-ack"/>
                <script id="ssl-cert" output="Certificate information..."/>
                <script id="ssl-enum-ciphers" output="Cipher suite information..."/>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert host.ssl_info["certificate"] == "Certificate information..."
        assert host.ssl_info["ciphers"] == "Cipher suite information..."

    def test_parse_scan_results_empty(self):
        """Test parsing empty XML results"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 0

    def test_parse_scan_results_minimal_host(self):
        """Test parsing host with minimal information"""
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <nmaprun>
            <host>
                <status state="down" reason="no-response"/>
            </host>
        </nmaprun>"""
        
        root = ET.fromstring(xml_content)
        hosts = CheckTargetsConfig.parse_scan_results(root)
        
        assert len(hosts) == 1
        host = hosts[0]
        assert host.ip_address == ""
        assert host.status == "down"
        assert host.reason == "no-response"


class TestEnumsAndExceptions:
    """Test enums and exception classes"""

    def test_scan_type_enum(self):
        """Test ScanType enum"""
        assert ScanType.DEFAULT.value == "default"
        assert ScanType.DEEP.value == "deep"
        assert ScanType.CUSTOM.value == "custom"
        
        assert str(ScanType.DEFAULT) == "default"

    def test_nmap_parse_exception(self):
        """Test NmapParseException"""
        with pytest.raises(NmapParseException):
            raise NmapParseException("Test error")

    def test_default_values(self):
        """Test DefaultValues dataclass"""
        assert DefaultValues.REQUEST_TIMEOUT == 10


if __name__ == "__main__":
    pytest.main([__file__]) 