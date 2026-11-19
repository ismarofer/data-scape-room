"""make data: regenerate everything deterministically. Uses Synthea output if present, else the pure-Python fallback (ADR 001/002)."""
import subprocess, sys, os, glob
here = os.path.dirname(os.path.abspath(__file__))
env = dict(os.environ, PYTHONUTF8="1")
src = "01_from_synthea.py" if glob.glob(os.path.join(here, "synthea", "out_[0-9]*", "csv", "patients.csv")) else "01_generate.py"
for s in (src, "03_inject.py", "04_answers.py"):
    print(">>", s)
    subprocess.run([sys.executable, s], cwd=here, check=True, env=env)
