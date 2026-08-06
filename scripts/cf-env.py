#!/usr/bin/env python3
"""
cloudflare-env.py — Docker-inspired CLI environment manager for Cloudflare Workers / Wrangler.

Follows the *-env pattern (ai-protocols.md §8.12):
  - Packages the execution context so `wrangler` runs in a predictable, isolated environment.
  - Supports dual-mode: source (human) + subprocess (agent/CI).

Usage:
  cloudflare-env.py [--shell] [-e dev]        # Source mode: eval "$(cloudflare-env.py --shell)"
  cloudflare-env.py -r "npx wrangler deploy"  # Subprocess mode (agent/CI)
  cloudflare-env.py -e prod -r "npx wrangler deploy"

Env file convention (dual-file, project root):
  .dev.vars          — gitignored, secrets (CLOUDFLARE_API_TOKEN, etc.)
  .dev.vars.template — committed, onboarding template with placeholder values

Why .vars instead of .env?
  Wrangler natively reads .dev.vars for local dev secrets. Using the standard
  file name means wrangler auto-loads the secrets without extra tooling.
  wrangler.toml/wrangler.jsonc handles the public config (bindings, routes).
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


_ROOT_MARKERS = ("wrangler.toml", "package.json")


def _find_project_root(start: Path) -> Path:
    """Walk up from start looking for wrangler.toml or package.json."""
    current = start.resolve()
    while current != current.parent:
        if any((current / m).exists() for m in _ROOT_MARKERS):
            return current
        current = current.parent
    return start.resolve()


def _parse_env_file(filepath: Path) -> dict[str, str]:
    """Parse a KEY=VALUE env file, ignoring comments and blank lines.

    Accepts both plain `KEY=VALUE` and `export KEY=VALUE` formats
    (consistent with dbt-env.py and java-env.py).
    """
    env_vars: dict[str, str] = {}
    if not filepath.exists():
        return env_vars
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                # Strip optional 'export ' prefix (Bash shell source compatibility)
                if line.startswith("export "):
                    line = line[7:]  # len("export ") == 7
                key, val = line.split("=", 1)
                env_vars[key.strip()] = val.strip()
    return env_vars


def _expand_vars(env_vars: dict[str, str]) -> dict[str, str]:
    """Expand ${VAR} references within env_vars values."""
    expanded: dict[str, str] = {}
    for key, val in env_vars.items():
        expanded[key] = re.sub(
            r"\$\{(\w+)\}",
            lambda m: env_vars.get(m.group(1), os.environ.get(m.group(1), m.group(0))),
            val,
        )
    return expanded


def load_env(base_dir: Path, env_name: str) -> dict[str, str]:
    """Load secrets from .<env>.vars in the project root.

    Uses Wrangler-native .dev.vars convention. wrangler.toml/wrangler.jsonc
    handles public config (bindings, routes). Only the hidden .<env>.vars
    (gitignored) is loaded here for secrets.

    Loading order: secrets file → expand ${VAR} referencing os.environ as fallback.
    """
    secrets_file = base_dir / f".{env_name}.vars"

    if not secrets_file.exists():
        template = base_dir / f".{env_name}.vars.template"
        print(
            f"Error: No env file found: {secrets_file}",
            file=sys.stderr,
        )
        if template.exists():
            print(
                f"  → Copy the template and fill in your values:\n"
                f"    cp {template.name} .{env_name}.vars",
                file=sys.stderr,
            )
        else:
            available = sorted(
                f.stem.lstrip(".")
                for f in base_dir.iterdir()
                if f.suffix == ".vars" and f.name.startswith(".")
                and not f.name.endswith(".template")
            )
            if available:
                print(f"  Available environments: {', '.join(available)}", file=sys.stderr)
        sys.exit(1)

    env_vars = _parse_env_file(secrets_file)
    return _expand_vars(env_vars)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cloudflare Workers environment tool (cloudflare-env)",
        epilog=(
            "Examples:\n"
            "  . cf-env.sh -e dev                        # Export env for dev\n"
            "  cf-env.py -e dev -r 'npx wrangler whoami' # Run in dev context\n"
            "  cf-env.py -r 'npx wrangler deploy'        # Deploy (default: dev)\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-e", "--env", default="dev",
        help="Target environment (default: dev)",
    )
    parser.add_argument(
        "-b", "-d", "--base-dir", default=None,
        help="Project root (auto-detected via wrangler.toml / package.json if not set)",
    )
    parser.add_argument(
        "--shell", action="store_true",
        help="Print 'export KEY=value;' lines for eval (human / source mode)",
    )
    parser.add_argument(
        "-r", "--run", type=str, default=None,
        help="Run a command inside an isolated subprocess with env injected",
    )

    args = parser.parse_args()

    if args.base_dir:
        base_dir = Path(args.base_dir).resolve()
    else:
        base_dir = _find_project_root(Path.cwd())

    env_vars = load_env(base_dir, args.env)

    if args.run:
        # Subprocess mode — isolated, no state leaks
        run_env = os.environ.copy()
        run_env.update(env_vars)
        print(f"Running: {args.run}  [env={args.env}]")
        try:
            subprocess.run(args.run, shell=True, check=True, env=run_env)
        except subprocess.CalledProcessError as e:
            print(f"Command failed with exit code {e.returncode}", file=sys.stderr)
            sys.exit(e.returncode)
    else:
        # Source mode — print exports for eval
        for k, v in env_vars.items():
            escaped_v = str(v).replace("'", "'\\''")
            print(f"export {k}='{escaped_v}';")
        print(f"echo \"Cloudflare environment '{args.env}' loaded.\" >&2;")


if __name__ == "__main__":
    main()
