"""Run every smoke scenario sequentially. Exit non-zero on any failure."""
import subprocess, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
scenarios = sorted(glob.glob(os.path.join(HERE, "scenarios", "*.py")))

failures = []
for path in scenarios:
    name = os.path.basename(path)
    print(f"\n=== running {name} ===")
    r = subprocess.run([sys.executable, path])
    if r.returncode != 0:
        failures.append(name)

print("\n=== summary ===")
if failures:
    print("FAILED:", ", ".join(failures))
    sys.exit(1)
print(f"all {len(scenarios)} scenarios passed")
