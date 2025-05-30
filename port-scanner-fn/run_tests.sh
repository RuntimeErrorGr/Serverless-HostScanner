#!/bin/bash
set -e

echo "Setting up test environment..."

export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "Checking test dependencies..."
if ! python -c "import pytest, redis, requests" 2>/dev/null; then
    echo "Installing test dependencies..."
    pip install -r test-requirements.txt
fi

echo "Running unit tests..."

echo "Running test_check_targets_utils.py..."
pytest test_check_targets_utils.py -v --tb=short

echo "Running test_check_targets.py..."
pytest test_check_targets.py -v --tb=short

echo "Generating coverage report..."
pytest --cov=check_targets --cov=check_targets_utils --cov-report=term-missing --cov-report=html

echo "All tests completed!"
echo "Coverage report generated in htmlcov/index.html" 