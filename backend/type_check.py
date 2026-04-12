#!/usr/bin/env python3
"""
LYLO Security - Type Checking Script
Comprehensive type checking and validation for the codebase
"""

import subprocess
import sys
import os
import json
from typing import List, Dict, Any, Tuple
from pathlib import Path

def run_command(command: str) -> Tuple[bool, str, str]:
    """Run shell command and return success status, stdout, and stderr."""
    try:
        result = subprocess.run(
            command.split(),
            capture_output=True,
            text=True,
            check=True
        )
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout, e.stderr

def check_mypy_installed() -> bool:
    """Check if mypy is installed."""
    success, _, _ = run_command("mypy --version")
    return success

def install_mypy() -> bool:
    """Install mypy and required packages."""
    print("📦 Installing mypy and type checking dependencies...")

    packages = [
        "mypy>=1.8.0",
        "types-requests",
        "types-python-dateutil",
        "types-pillow",
    ]

    for package in packages:
        print(f"   Installing {package}...")
        success, _, error = run_command(f"pip install {package}")
        if not success:
            print(f"❌ Failed to install {package}: {error}")
            return False

    print("✅ MyPy installation complete!")
    return True

def run_mypy_check(target_dir: str = "backend") -> Tuple[bool, List[str]]:
    """Run mypy type checking on the target directory."""
    if not os.path.exists(target_dir):
        return False, [f"Target directory '{target_dir}' does not exist"]

    print(f"🔍 Running mypy type check on {target_dir}...")

    # MyPy command with comprehensive options
    command = f"mypy {target_dir} --config-file mypy.ini --show-error-codes --show-column-numbers"

    success, stdout, stderr = run_command(command)

    # Parse output
    errors = []
    if stdout:
        errors.extend(stdout.strip().split('\n'))
    if stderr:
        errors.extend(stderr.strip().split('\n'))

    return success, [error for error in errors if error.strip()]

def analyze_type_coverage(target_dir: str = "backend") -> Dict[str, Any]:
    """Analyze type coverage across Python files."""
    coverage_data = {
        "total_files": 0,
        "typed_files": 0,
        "untyped_functions": [],
        "files_needing_types": []
    }

    for py_file in Path(target_dir).rglob("*.py"):
        coverage_data["total_files"] += 1

        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Simple heuristic: check for type hints
            has_typing_import = "from typing import" in content or "import typing" in content
            has_annotations = "->" in content or ": " in content

            if has_typing_import or has_annotations:
                coverage_data["typed_files"] += 1
            else:
                coverage_data["files_needing_types"].append(str(py_file))

        except Exception as e:
            print(f"⚠️ Could not analyze {py_file}: {e}")

    return coverage_data

def generate_type_report(errors: List[str], coverage: Dict[str, Any]) -> None:
    """Generate comprehensive type checking report."""
    print("\n" + "=" * 70)
    print("📊 LYLO SECURITY - TYPE CHECKING REPORT")
    print("=" * 70)

    # Type Coverage Summary
    total_files = coverage["total_files"]
    typed_files = coverage["typed_files"]
    coverage_percent = (typed_files / total_files * 100) if total_files > 0 else 0

    print(f"\n📈 TYPE COVERAGE:")
    print(f"  • Total Python files: {total_files}")
    print(f"  • Files with type hints: {typed_files}")
    print(f"  • Coverage percentage: {coverage_percent:.1f}%")

    # Quality Assessment
    if coverage_percent >= 90:
        print("  ✅ Excellent type coverage!")
    elif coverage_percent >= 70:
        print("  🟡 Good type coverage, room for improvement")
    elif coverage_percent >= 50:
        print("  🟠 Moderate type coverage, needs work")
    else:
        print("  🔴 Poor type coverage, immediate attention needed")

    # MyPy Error Analysis
    print(f"\n🔍 MYPY ANALYSIS:")
    if not errors or (len(errors) == 1 and not errors[0].strip()):
        print("  ✅ No type errors found!")
    else:
        error_count = len([e for e in errors if e.strip() and "Success:" not in e])
        print(f"  • Total issues found: {error_count}")

        # Categorize errors
        error_types = {}
        for error in errors:
            if ":" in error and "error:" in error.lower():
                error_type = error.split("error:")[-1].split("[")[0].strip()
                error_types[error_type] = error_types.get(error_type, 0) + 1

        if error_types:
            print("  • Error breakdown:")
            for error_type, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
                print(f"    - {error_type}: {count}")

    # Files Needing Types
    files_needing_types = coverage["files_needing_types"]
    if files_needing_types:
        print(f"\n📋 FILES NEEDING TYPE HINTS ({len(files_needing_types)}):")
        for file_path in files_needing_types[:10]:  # Show first 10
            print(f"  • {file_path}")
        if len(files_needing_types) > 10:
            print(f"  ... and {len(files_needing_types) - 10} more")

    # Detailed Errors
    if errors and any(e.strip() for e in errors):
        print(f"\n🚨 DETAILED TYPE ERRORS:")
        for i, error in enumerate(errors, 1):
            if error.strip() and "Success:" not in error:
                print(f"  {i:2d}. {error}")
                if i >= 20:  # Limit to first 20 errors
                    remaining = len(errors) - i
                    if remaining > 0:
                        print(f"  ... and {remaining} more errors")
                    break

def create_type_fixing_guide() -> None:
    """Create a guide for fixing common type issues."""
    guide_content = """# LYLO Security - Type Fixing Guide

## Common Type Issues and Solutions

### 1. Function Return Types
```python
# ❌ Before
def fetch_data(user_id):
    return {"data": "value"}

# ✅ After
def fetch_data(user_id: str) -> Dict[str, str]:
    return {"data": "value"}
```

### 2. Optional Parameters
```python
# ❌ Before
def process_user(name, age=None):
    pass

# ✅ After
def process_user(name: str, age: Optional[int] = None) -> None:
    pass
```

### 3. List and Dict Types
```python
# ❌ Before
def get_users() -> list:
    return [{"name": "Alice"}]

# ✅ After
def get_users() -> List[Dict[str, str]]:
    return [{"name": "Alice"}]
```

### 4. Class Attributes
```python
# ❌ Before
class UserService:
    def __init__(self):
        self.users = []

# ✅ After
class UserService:
    def __init__(self) -> None:
        self.users: List[User] = []
```

### 5. Protocol Implementation
```python
# ✅ Using LYLO types
from lylo_types import VectorIndex, UserID

def search_memories(index: VectorIndex, user_id: UserID) -> List[str]:
    return index.query(vector=[0.1] * 1536, filter={"user_id": user_id})
```

## Quick Fix Commands

1. Install type stubs:
   ```bash
   pip install types-requests types-pillow mypy
   ```

2. Run type checking:
   ```bash
   python type_check.py
   ```

3. Fix imports:
   ```python
   from typing import Dict, List, Optional, Union
   from lylo_types import UserID, PersonaType, VaultData
   ```

## Priority Files to Fix

Focus on these files first:
1. Core modules (lylo_kernel.py, main.py)
2. API routes (routers/*.py)
3. Vault implementations (med_vault.py, tactical_vault.py)
4. Utility modules

## MyPy Configuration

The mypy.ini file is configured for strict type checking.
To temporarily ignore a line: `# type: ignore`
To ignore an entire file: Add `# type: ignore` at the top
"""

    with open("TYPE_FIXING_GUIDE.md", "w") as f:
        f.write(guide_content)

    print("📚 Created TYPE_FIXING_GUIDE.md")

def main() -> int:
    """Main type checking process."""
    print("🔍 LYLO Security - Type Checking & Analysis")
    print("=" * 60)

    # Check if mypy is installed
    if not check_mypy_installed():
        print("⚠️ MyPy not found. Installing...")
        if not install_mypy():
            print("❌ Failed to install MyPy. Please install manually:")
            print("   pip install mypy types-requests types-pillow")
            return 1

    # Run mypy check
    mypy_success, mypy_errors = run_mypy_check()

    # Analyze type coverage
    coverage_data = analyze_type_coverage()

    # Generate comprehensive report
    generate_type_report(mypy_errors, coverage_data)

    # Create fixing guide
    create_type_fixing_guide()

    # Final recommendations
    print("\n" + "=" * 70)
    print("🎯 RECOMMENDATIONS:")

    coverage_percent = (coverage_data["typed_files"] / coverage_data["total_files"] * 100) if coverage_data["total_files"] > 0 else 0

    if coverage_percent < 70:
        print("  1. 🏃‍♂️ URGENT: Add type hints to core modules")
        print("     - Start with lylo_kernel.py and main.py")
        print("     - Use lylo_types.py for consistent typing")

    if mypy_errors and any(e.strip() for e in mypy_errors):
        print("  2. 🔧 Fix MyPy errors using TYPE_FIXING_GUIDE.md")
        print("     - Address highest-priority errors first")
        print("     - Use protocols for external dependencies")

    print("  3. 🚀 Set up pre-commit hooks for type checking")
    print("  4. 📊 Run this script regularly to track progress")

    # Return appropriate exit code
    if mypy_success and coverage_percent >= 70:
        print("\n✅ Type checking passed!")
        return 0
    else:
        print("\n⚠️ Type checking needs attention.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)