import os
import shutil
import subprocess

# Global handle to the running cloudflared process
_tunnel_process = None


def start_cloudflare_tunnel():
    """
    Starts a Cloudflare Tunnel using only the token from the environment.

    Uses `cloudflared tunnel run --token <TOKEN>`, which is the config-less,
    remote-managed mode: all routing config lives on Cloudflare's edge, so no
    local config.yml or credentials file is needed. This makes it work the same
    on a deploy environment that only provides environment variables.

    Requires the `cloudflared` binary to be installed and available on PATH.
    If the token is missing or the binary is not found, this logs a warning and
    returns without raising, so the backend can still start.
    """
    global _tunnel_process

    token = os.getenv("CLOUDFLARE_TUNNEL_TOKEN")
    if not token or not token.strip():
        print("WARNING: CLOUDFLARE_TUNNEL_TOKEN is not set or empty. Skipping Cloudflare Tunnel.")
        return

    cloudflared_path = shutil.which("cloudflared")
    if not cloudflared_path:
        print("WARNING: 'cloudflared' binary not found on PATH. Skipping Cloudflare Tunnel.")
        return

    try:
        _tunnel_process = subprocess.Popen(
            [cloudflared_path, "tunnel", "run", "--token", token.strip()],
        )
        print(f"Cloudflare Tunnel started (pid={_tunnel_process.pid}).")
    except Exception as e:
        print(f"Error starting Cloudflare Tunnel: {str(e)}")


def stop_cloudflare_tunnel():
    """
    Terminates the cloudflared process started by start_cloudflare_tunnel().
    """
    global _tunnel_process
    if _tunnel_process is None:
        return

    try:
        print("Stopping Cloudflare Tunnel...")
        _tunnel_process.terminate()
        try:
            _tunnel_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _tunnel_process.kill()
            _tunnel_process.wait()
        print("Cloudflare Tunnel stopped.")
    except Exception as e:
        print(f"Error stopping Cloudflare Tunnel: {str(e)}")
    finally:
        _tunnel_process = None
