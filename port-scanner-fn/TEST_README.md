# Port Scanner Function Test Suite

This directory contains comprehensive unit tests for the port scanner function modules `check_targets.py` and `check_targets_utils.py`.

## Test Structure

### Test Files

- **`test_check_targets_utils.py`** - Unit tests for utility functions and classes
- **`test_check_targets.py`** - Unit tests for the main CheckTargets class and CLI parsing
- **`pytest.ini`** - Pytest configuration
- **`test-requirements.txt`** - Test dependencies

### Test Coverage

#### `test_check_targets_utils.py` covers:

**Utility Functions:**
- `read_ports_file()` - Reading port configuration files
- `get_responding_urls()` - HTTP/HTTPS URL response checking
- `calculate_number_of_targets()` - Target count calculations for various formats
- `is_netblock_cidr()` - CIDR notation validation
- `is_ipv4_range()` - IPv4 range validation
- `get_number_of_ips_from_range()` - IP range size calculation
- `get_top_ports()` - Top ports retrieval via shell script
- `parse_top_ports_format()` - Port specification parsing

**Classes:**
- `CheckTargetsOptions` - Scan configuration options
  - Initialization with default/custom values
  - Command format generation for different scan types
  - Factory methods for default and deep scans
- `Host` - Host information container
  - Initialization and data handling
  - Hash and equality operations for set usage
- `CheckTargetsConfig` - Scan configuration and XML parsing
  - Command generation for various scan options
  - Comprehensive XML parsing for Nmap results
  - Port, OS, traceroute, and SSL information extraction

**Enums and Exceptions:**
- `ScanType` enum values
- `NmapParseException` handling
- `DefaultValues` configuration

#### `test_check_targets.py` covers:

**CheckTargets Class:**
- Initialization with Redis connection mocking
- Environment variable configuration
- Phase weight calculation for different scan types
- Scan phase detection from Nmap output
- Progress parsing from Nmap output lines
- User-friendly message generation
- Process execution and output handling
- XML output parsing and validation
- Network/broadcast address filtering
- Redis output writing and error handling
- Message storage and publishing
- Full scan workflow execution

**CLI Argument Parsing:**
- Default scan argument parsing
- Custom scan with all options
- Deep scan configuration
- TCP scan type variations
- Minimal argument requirements

**Integration Scenarios:**
- Full scan workflow with all mocked dependencies
- Error handling at various stages
- Redis communication patterns

## Running the Tests

### Prerequisites

1. Install test dependencies:
```bash
pip install -r test-requirements.txt
```

2. Ensure the main modules are importable (add to PYTHONPATH if needed):
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Running All Tests

```bash
# Run all tests with verbose output
pytest -v

# Run with coverage report
pytest --cov=check_targets --cov=check_targets_utils --cov-report=html

# Run specific test file
pytest test_check_targets_utils.py -v
pytest test_check_targets.py -v
```

### Running Specific Test Categories

```bash
# Run only unit tests (if using markers)
pytest -m unit

# Run integration tests
pytest -m integration

# Run specific test class
pytest test_check_targets.py::TestCheckTargets -v

# Run specific test method
pytest test_check_targets_utils.py::TestCheckTargetsOptions::test_init_default_values -v
```

### Test Output Options

```bash
# Show test durations
pytest --durations=10

# Show detailed failure information
pytest --tb=long

# Run with minimal output
pytest -q

# Stop on first failure
pytest -x
```

## Test Features

### Mocking Strategy

The tests extensively use Python's `unittest.mock` to isolate units under test:

- **Redis connections** - All Redis operations are mocked to avoid requiring a Redis instance
- **Subprocess calls** - Nmap execution is mocked with controlled output
- **File operations** - XML file reading/writing is mocked
- **Network requests** - HTTP requests for URL checking are mocked
- **Environment variables** - Configuration via environment variables is tested

### Test Data

Tests include realistic data scenarios:
- Valid and invalid IP addresses, CIDR blocks, and ranges
- Sample Nmap XML output with various scan results
- Port configurations and scan options
- Error conditions and edge cases

### Edge Cases Covered

- Empty files and missing files
- Invalid XML parsing
- Network connectivity failures
- Redis connection errors
- Process execution failures
- Invalid configuration parameters
- Malformed input data

## Test Examples

### Basic Test Execution

```python
# Example: Testing CIDR validation
def test_is_netblock_cidr_valid():
    assert is_netblock_cidr("192.168.1.0/24") is True
    assert is_netblock_cidr("10.0.0.0/8") is True

def test_is_netblock_cidr_invalid():
    assert is_netblock_cidr("192.168.1.1") is False
    assert is_netblock_cidr("invalid/24") is False
```

### Mocked External Dependencies

```python
@patch('redis.Redis')
@patch('subprocess.Popen')
def test_check_alive_success(mock_popen, mock_redis):
    # Setup mocks for successful scan
    mock_process = Mock()
    mock_process.stdout.readline.side_effect = ["Scan output", ""]
    mock_popen.return_value = mock_process
    
    # Execute test
    check_targets = CheckTargets(config)
    check_targets._CheckTargets__check_alive()
    
    # Verify behavior
    mock_popen.assert_called_once()
```

## Coverage Goals

The test suite aims for:
- **90%+ line coverage** on both modules
- **100% function coverage** for public APIs
- **Comprehensive error condition testing**
- **All CLI argument combinations**
- **All scan configuration options**

## Continuous Integration

These tests are designed to run in CI/CD environments:
- No external dependencies (all mocked)
- Fast execution (< 30 seconds typically)
- Clear pass/fail indicators
- Detailed error reporting
- Coverage metrics generation

## Contributing to Tests

When adding new functionality:

1. Add corresponding test cases
2. Maintain existing coverage levels
3. Test both success and error conditions
4. Mock all external dependencies
5. Include edge cases and invalid inputs
6. Update this README if adding new test categories

## Troubleshooting

### Common Issues

**Import Errors:**
```bash
# Ensure modules are in Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

**Missing Dependencies:**
```bash
# Install all test requirements
pip install -r test-requirements.txt
```

**Mock Issues:**
- Ensure all external dependencies are properly mocked
- Check that mock return values match expected data types
- Verify mock call assertions match actual usage patterns

### Debug Mode

Run tests with additional debugging:
```bash
# Show all output including print statements
pytest -s

# Show local variables in tracebacks
pytest --tb=long --showlocals

# Run single test with maximum verbosity
pytest test_file.py::test_name -vvv -s
``` 