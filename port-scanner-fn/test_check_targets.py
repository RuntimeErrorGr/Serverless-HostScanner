#!/usr/bin/env python3
"""
Unit tests for check_targets.py
"""

import pytest
import tempfile
import os
import json
import subprocess
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch, MagicMock, mock_open
from datetime import datetime
import ipaddress
import redis

from check_targets import (
    CheckTargets,
    CheckTargetsException,
    parse_cli_arguments
)
from check_targets_utils import (
    CheckTargetsConfig,
    CheckTargetsOptions,
    ScanType,
    Host
)


class TestCheckTargets:
    """Test CheckTargets class"""

    @patch('redis.Redis')
    def test_init_basic(self, mock_redis):
        """Test basic CheckTargets initialization"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        targets = ["192.168.1.1", "example.com"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan-123")
        
        check_targets = CheckTargets(config)
        
        assert check_targets.config == config
        assert check_targets.status == "running"
        assert len(check_targets.alive_targets) == 0
        assert check_targets.current_phase == "initializing"
        mock_redis.assert_called_once()

    @patch.dict(os.environ, {
        'REDIS_HOST': 'test-redis.local',
        'REDIS_PORT': '6380',
        'REDIS_DB': '1',
        'REDIS_PASSWORD': 'test-password'
    })
    @patch('redis.Redis')
    def test_init_with_env_vars(self, mock_redis):
        """Test CheckTargets initialization with environment variables"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        CheckTargets(config)
        
        mock_redis.assert_called_once_with(
            host="test-redis.local",
            port=6380,
            db=1,
            password="test-password",
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            decode_responses=True
        )

    @patch('redis.Redis')
    def test_calculate_phase_weights_default_scan(self, mock_redis):
        """Test phase weight calculation for default scan"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions.get_default_check_targets_options()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        weights = check_targets.phase_weights
        
        # Default scan should have host_discovery and tcp_scan
        assert "host_discovery" in check_targets.enabled_phases
        assert "tcp_scan" in check_targets.enabled_phases
        assert weights["host_discovery"] > 0
        assert weights["tcp_scan"] > 0
        
        # Should not have UDP scan by default
        assert "udp_scan" not in check_targets.enabled_phases
        assert weights["udp_scan"] == 0

    @patch('redis.Redis')
    def test_calculate_phase_weights_deep_scan(self, mock_redis):
        """Test phase weight calculation for deep scan"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions.get_deep_check_targets_options()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Deep scan should have all phases enabled
        expected_phases = ["host_discovery", "tcp_scan", "udp_scan", "os_detection", "service_detection", "nse_scripts"]
        for phase in expected_phases:
            assert phase in check_targets.enabled_phases
            assert check_targets.phase_weights[phase] > 0

    @patch('redis.Redis')
    def test_detect_scan_phase(self, mock_redis):
        """Test scan phase detection from output lines"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Test different phase detection patterns
        test_cases = [
            ("Starting Nmap ping scan", "host_discovery"),
            ("Initiating SYN Stealth Scan", "tcp_scan"),
            ("Initiating UDP Scan", "udp_scan"),
            ("Initiating OS detection", "os_detection"),
            ("Initiating Service scan", "service_detection"),
            ("NSE: Starting", "nse_scripts"),
            ("Random output", "initializing")  # Should remain current phase
        ]
        
        for line, expected_phase in test_cases:
            detected_phase = check_targets._detect_scan_phase(line)
            if expected_phase != "initializing":
                assert detected_phase == expected_phase
            else:
                assert detected_phase == check_targets.current_phase

    @patch('redis.Redis')
    def test_parse_nmap_progress(self, mock_redis):
        """Test Nmap progress parsing"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions.get_default_check_targets_options()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Test valid progress line
        progress_line = "Stats: 0:00:30 elapsed; 0 hosts completed (1 up), 1 undergoing SYN Stealth Scan; 0:00:10 remaining. About 50% done; ETC: 12:00"
        progress = check_targets.parse_nmap_progress(progress_line)
        
        assert progress is not None
        assert isinstance(progress, float)
        assert 0 <= progress <= 100

    @patch('redis.Redis')
    def test_parse_nmap_progress_invalid_line(self, mock_redis):
        """Test Nmap progress parsing with invalid line"""
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Test invalid progress line
        invalid_line = "This line has no progress information"
        progress = check_targets.parse_nmap_progress(invalid_line)
        
        assert progress is None

    @patch('redis.Redis')
    @patch('check_targets.get_responding_urls')
    @patch('subprocess.Popen')
    def test_check_alive_success(self, mock_popen, mock_get_urls, mock_redis):
        """Test successful check alive process"""

        # Mock Redis instance
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance

        # Simulate get_responding_urls returning no URLs
        mock_get_urls.return_value = ([], [])

        # Simulate process.stdout.readline using a generator
        def fake_readline():
            lines = [
                "Starting Nmap scan",
                "About 50% done; ETC: 12:00",
                "Nmap done: 1 IP address scanned",
            ]
            for line in lines:
                yield line
            while True:
                yield ""  # Keep yielding empty strings to simulate no new output

        fake_stdout = fake_readline()

        mock_process = Mock()
        mock_process.stdout.readline.side_effect = lambda: next(fake_stdout)
        mock_process.poll.side_effect = [None, None, None, 0]  # Running, then finished
        mock_process.wait.return_value = 0
        mock_process.stdout.close.return_value = None

        mock_popen.return_value = mock_process

        # Set up CheckTargets
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        check_targets = CheckTargets(config)

        # Call the method under test
        check_targets._CheckTargets__check_alive()

        # Assertions
        mock_popen.assert_called_once()
        assert mock_redis_instance.publish.called
        assert mock_redis_instance.set.called

    @patch('redis.Redis')
    @patch('check_targets.get_responding_urls')
    @patch('subprocess.Popen')
    def test_check_alive_process_error(self, mock_popen, mock_get_urls, mock_redis):
        """Test check alive process with error"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        mock_get_urls.return_value = ([], [])
        
        # Simulate process error
        mock_popen.side_effect = subprocess.CalledProcessError(1, 'nmap')
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        with pytest.raises(CheckTargetsException):
            check_targets._CheckTargets__check_alive()

    @patch('redis.Redis')
    @patch('os.path.isfile')
    @patch('os.stat')
    @patch('xml.etree.ElementTree.parse')
    def test_parse_output_success(self, mock_parse, mock_stat, mock_isfile, mock_redis):
        """Test successful XML output parsing"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        # Setup file mocks
        mock_isfile.return_value = True
        mock_stat.return_value.st_size = 1000  # Non-empty file
        
        # Setup XML mock
        mock_xml_root = Mock()
        mock_tree = Mock()
        mock_tree.getroot.return_value = mock_xml_root
        mock_parse.return_value = mock_tree
        
        # Mock parsed hosts
        host = Host()
        host.ip_address = "192.168.1.1"
        host.status = "up"
        
        with patch.object(CheckTargetsConfig, 'parse_scan_results', return_value=[host]):
            targets = ["192.168.1.1"]
            options = CheckTargetsOptions()
            config = CheckTargetsConfig(targets, options, "test-scan")
            
            check_targets = CheckTargets(config)
            check_targets._CheckTargets__parse_output()
            
            assert len(check_targets.alive_targets) == 1
            assert host in check_targets.alive_targets

    @patch('redis.Redis')
    @patch('os.path.isfile')
    def test_parse_output_file_not_found(self, mock_isfile, mock_redis):
        """Test XML parsing with missing file"""
        mock_isfile.return_value = False
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        with pytest.raises(CheckTargetsException):
            check_targets._CheckTargets__parse_output()

    @patch('redis.Redis')
    @patch('os.path.isfile')
    @patch('os.stat')
    def test_parse_output_empty_file(self, mock_stat, mock_isfile, mock_redis):
        """Test XML parsing with empty file"""
        mock_isfile.return_value = True
        mock_stat.return_value.st_size = 0  # Empty file
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        check_targets._CheckTargets__parse_output()
        
        # Should complete without error and no hosts added
        assert len(check_targets.alive_targets) == 0

    @patch('redis.Redis')
    def test_filter_network_and_broadcast_addresses(self, mock_redis):
        """Test filtering of network and broadcast addresses"""
        targets = ["192.168.1.0/24"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Add some hosts including network and broadcast addresses
        host1 = Host()
        host1.ip_address = "192.168.1.0"  # Network address
        host1.status = "up"
        
        host2 = Host()
        host2.ip_address = "192.168.1.1"  # Valid host
        host2.status = "up"
        
        host3 = Host()
        host3.ip_address = "192.168.1.255"  # Broadcast address
        host3.status = "up"
        
        check_targets.alive_targets.update([host1, host2, host3])
        check_targets._CheckTargets__filter_network_and_broadcast_addresses()
        
        # Only the valid host should remain
        assert len(check_targets.alive_targets) == 1
        assert host2 in check_targets.alive_targets
        assert host1 not in check_targets.alive_targets
        assert host3 not in check_targets.alive_targets

    @patch('redis.Redis')
    def test_write_output_success(self, mock_redis):
        """Test successful output writing to Redis"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan-123")
        
        check_targets = CheckTargets(config)
        
        # Add a test host
        host = Host()
        host.ip_address = "192.168.1.1"
        host.hostname = "test.example.com"
        host.status = "up"
        host.last_seen = "2023-01-01T00:00:00"
        host.reason = "syn-ack"
        host.ports = [{"port": 80, "state": "open", "protocol": "tcp"}]
        
        check_targets.alive_targets.add(host)
        
        results = check_targets._CheckTargets__write_output()
        
        # Verify results structure
        assert results["scan_id"] == "test-scan-123"
        assert results["status"] == "completed"
        assert len(results["scan_results"]) == 1
        
        scan_result = results["scan_results"][0]
        assert scan_result["ip_address"] == "192.168.1.1"
        assert scan_result["hostname"] == "test.example.com"
        assert scan_result["status"] == "up"
        
        # Verify Redis operations
        mock_redis_instance.set.assert_called()
        mock_redis_instance.publish.assert_called()

    @patch('redis.Redis')
    def test_store_and_publish_message(self, mock_redis):
        """Test message storage and publishing"""
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan-123")
        
        check_targets = CheckTargets(config)
        test_message = "Test scan message"
        
        check_targets._store_and_publish_message(test_message)
        
        # Verify Redis list append
        mock_redis_instance.rpush.assert_called_with("scan_output:test-scan-123", test_message)
        
        # Verify expiration set
        mock_redis_instance.expire.assert_called_with("scan_output:test-scan-123", 86400)
        
        # Verify WebSocket publish
        mock_redis_instance.publish.assert_called_with("test-scan-123", test_message)

    @patch('redis.Redis')
    def test_store_and_publish_message_error(self, mock_redis):
        """Test message storage with Redis error (should not raise)"""
        mock_redis_instance = Mock()
        mock_redis_instance.rpush.side_effect = Exception("Redis error")
        mock_redis.return_value = mock_redis_instance
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        # Should not raise exception
        check_targets._store_and_publish_message("Test message")
        
        # Should still try to publish
        mock_redis_instance.publish.assert_called()

    @patch('redis.Redis')
    @patch.object(CheckTargets, '_CheckTargets__check_alive')
    @patch.object(CheckTargets, '_CheckTargets__parse_output')
    @patch.object(CheckTargets, '_CheckTargets__write_output')
    def test_run_success(self, mock_write, mock_parse, mock_check, mock_redis):
        """Test successful full run"""
        mock_write.return_value = {"scan_id": "test-scan", "status": "completed"}
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        results = check_targets.run()
        
        # Verify all methods were called
        mock_check.assert_called_once()
        mock_parse.assert_called_once()
        mock_write.assert_called_once()
        
        # Verify results
        assert results["scan_id"] == "test-scan"
        assert results["status"] == "completed"

    @patch('redis.Redis')
    @patch.object(CheckTargets, '_CheckTargets__check_alive')
    @patch.object(CheckTargets, '_CheckTargets__parse_output')
    def test_run_check_alive_failure(self, mock_parse, mock_check, mock_redis):
        """Test run with check_alive failure"""
        mock_check.side_effect = CheckTargetsException("Scan failed")
        
        targets = ["192.168.1.1"]
        options = CheckTargetsOptions()
        config = CheckTargetsConfig(targets, options, "test-scan")
        
        check_targets = CheckTargets(config)
        
        with pytest.raises(CheckTargetsException):
            check_targets.run()
        
        # Parse and write should not be called if check_alive fails
        mock_parse.assert_not_called()


class TestParseCliArguments:
    """Test CLI argument parsing"""

    def test_parse_default_scan_arguments(self):
        """Test parsing default scan arguments"""
        test_args = [
            "--targets", "192.168.1.1,example.com",
            "--scan-type", "default",
            "--scan-id", "test-scan-123"
        ]
        
        with patch('sys.argv', ['check_targets.py'] + test_args):
            args = parse_cli_arguments()
            
            assert args.targets == "192.168.1.1,example.com"
            assert args.scan_type == "default"
            assert args.scan_id == "test-scan-123"

    def test_parse_custom_scan_arguments(self):
        """Test parsing custom scan arguments"""
        test_args = [
            "--targets", "192.168.1.0/24",
            "--scan-type", "custom",
            "--scan-id", "custom-scan-456",
            "--echo-request",
            "--os-detection",
            "--service-version",
            "--timing-flag", "4",
            "--tcp-syn-scan",
            "--tcp-ports", "80,443,22",
            "--udp-ports", "53,123",
            "--ssl-scan",
            "--http-headers"
        ]
        
        with patch('sys.argv', ['check_targets.py'] + test_args):
            args = parse_cli_arguments()
            
            assert args.targets == "192.168.1.0/24"
            assert args.scan_type == "custom"
            assert args.scan_id == "custom-scan-456"
            assert args.echo_request is True
            assert args.os_detection is True
            assert args.service_version is True
            assert args.timing_flag == 4
            assert args.tcp_syn_scan is True
            assert args.tcp_ports == "80,443,22"
            assert args.udp_ports == "53,123"
            assert args.ssl_scan is True
            assert args.http_headers is True

    def test_parse_deep_scan_arguments(self):
        """Test parsing deep scan arguments"""
        test_args = [
            "--targets", "10.0.0.0/8",
            "--scan-type", "deep",
            "--scan-id", "deep-scan-789"
        ]
        
        with patch('sys.argv', ['check_targets.py'] + test_args):
            args = parse_cli_arguments()
            
            assert args.targets == "10.0.0.0/8"
            assert args.scan_type == "deep"
            assert args.scan_id == "deep-scan-789"

    def test_parse_minimal_arguments(self):
        """Test parsing with minimal required arguments"""
        test_args = [
            "--targets", "192.168.1.1",
            "--scan-id", "minimal-scan"
        ]
        
        with patch('sys.argv', ['check_targets.py'] + test_args):
            args = parse_cli_arguments()
            
            assert args.targets == "192.168.1.1"
            assert args.scan_type == "default"  # Default value
            assert args.scan_id == "minimal-scan"

    def test_parse_all_tcp_scan_types(self):
        """Test parsing different TCP scan types"""
        tcp_scan_types = [
            "--tcp-syn-scan",
            "--tcp-ack-scan", 
            "--tcp-connect-scan",
            "--tcp-window-scan",
            "--tcp-null-scan",
            "--tcp-fin-scan",
            "--tcp-xmas-scan"
        ]
        
        for scan_type in tcp_scan_types:
            test_args = [
                "--targets", "192.168.1.1",
                "--scan-type", "custom",
                "--scan-id", "test-scan",
                scan_type
            ]
            
            with patch('sys.argv', ['check_targets.py'] + test_args):
                args = parse_cli_arguments()
                
                # Check that the appropriate attribute is set
                attr_name = scan_type.replace('--', '').replace('-', '_')
                assert getattr(args, attr_name) is True


class TestCheckTargetsException:
    """Test CheckTargetsException"""

    def test_exception_creation(self):
        """Test exception can be created and raised"""
        with pytest.raises(CheckTargetsException):
            raise CheckTargetsException("Test error message")

    def test_exception_with_message(self):
        """Test exception message handling"""
        error_msg = "Custom error message"
        
        try:
            raise CheckTargetsException(error_msg)
        except CheckTargetsException as e:
            assert str(e) == error_msg


class TestIntegrationScenarios:
    """Integration test scenarios"""

    @patch('redis.Redis')
    @patch('check_targets.get_responding_urls')
    @patch('subprocess.Popen')
    @patch('os.path.isfile')
    @patch('os.stat')
    @patch('xml.etree.ElementTree.parse')
    def test_full_scan_integration(self, mock_parse, mock_stat, mock_isfile,
                                    mock_popen, mock_get_urls, mock_redis):
        """Test full scan integration scenario"""

        # Setup all mocks for successful scan
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance

        mock_get_urls.return_value = ([], [])  # No URLs

        # Fake readline generator to avoid StopIteration
        def fake_readline():
            lines = [
                "Starting Nmap scan",
                "About 50% done; ETC: 12:00",
                "Scan complete",
            ]
            for line in lines:
                yield line
            while True:
                yield ""  # Simulate end of output without raising StopIteration

        fake_readline_gen = fake_readline()

        # Mock successful process
        mock_process = Mock()
        mock_process.stdout.readline.side_effect = lambda: next(fake_readline_gen)
        mock_process.poll.side_effect = [None, None, None, 0]
        mock_process.wait.return_value = 0
        mock_popen.return_value = mock_process

        # Mock file operations
        mock_isfile.return_value = True
        mock_stat.return_value.st_size = 1000

        # Mock XML parsing
        mock_xml_root = Mock()
        mock_tree = Mock()
        mock_tree.getroot.return_value = mock_xml_root
        mock_parse.return_value = mock_tree

        # Mock successful host discovery
        host = Host()
        host.ip_address = "192.168.1.1"
        host.status = "up"
        host.ports = [{"port": 80, "state": "open", "protocol": "tcp"}]

        with patch.object(CheckTargetsConfig, 'parse_scan_results', return_value=[host]):
            targets = ["192.168.1.1"]
            options = CheckTargetsOptions.get_default_check_targets_options()
            config = CheckTargetsConfig(targets, options, "integration-test")

            check_targets = CheckTargets(config)
            results = check_targets.run()

            # Verify successful completion
            assert results["status"] == "completed"
            assert results["scan_id"] == "integration-test"
            assert len(results["scan_results"]) == 1
            assert results["scan_results"][0]["ip_address"] == "192.168.1.1"

            # Verify Redis operations occurred
            assert mock_redis_instance.set.called
            assert mock_redis_instance.publish.called


if __name__ == "__main__":
    pytest.main([__file__]) 