#!/usr/bin/env python3
"""
Simple script to test timezone functionality
Run this to verify that timezone handling is working correctly
"""

from datetime import datetime
from app.utils.timezone import (
    now_utc, 
    now_bucharest, 
    to_bucharest, 
    to_utc, 
    format_bucharest, 
    format_iso_bucharest,
    format_iso_utc,
    ensure_timezone
)

def test_timezone_functions():
    print("=== Timezone Functionality Test ===\n")
    
    # Test current time functions
    utc_now = now_utc()
    bucharest_now = now_bucharest()
    
    print("1. Current Time Functions:")
    print(f"   UTC Now: {utc_now}")
    print(f"   Bucharest Now: {bucharest_now}")
    print(f"   UTC ISO: {format_iso_utc(utc_now)}")
    print(f"   Bucharest ISO: {format_iso_bucharest(utc_now)}")
    print()
    
    # Test conversion functions
    print("2. Conversion Functions:")
    print(f"   UTC -> Bucharest: {to_bucharest(utc_now)}")
    print(f"   Bucharest -> UTC: {to_utc(bucharest_now)}")
    print()
    
    # Test naive datetime handling
    naive_dt = datetime(2023, 12, 7, 15, 30, 0)  # Naive datetime
    print("3. Naive Datetime Handling:")
    print(f"   Naive datetime: {naive_dt}")
    print(f"   Ensure UTC: {ensure_timezone(naive_dt, assume_utc=True)}")
    print(f"   Ensure Bucharest: {ensure_timezone(naive_dt, assume_utc=False)}")
    print(f"   To Bucharest: {to_bucharest(naive_dt)}")
    print(f"   Format Bucharest: {format_bucharest(naive_dt)}")
    print(f"   ISO Bucharest: {format_iso_bucharest(naive_dt)}")
    print()
    
    # Test edge cases
    print("4. Edge Cases:")
    print(f"   None handling: {format_bucharest(None)}")
    print(f"   None ISO: {format_iso_bucharest(None)}")
    print()
    
    print("=== Test Complete ===")
    print("If you see proper timezone offsets (+02:00 or +03:00 for Bucharest)")
    print("and times that are 3 hours ahead of UTC, then timezone handling is working correctly.")

if __name__ == "__main__":
    test_timezone_functions() 