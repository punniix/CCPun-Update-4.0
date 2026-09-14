#!/usr/bin/python3
"""Open and close the loopback-only CCPun Production Draft workspace."""

from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


APP_DIR = Path(__file__).resolve().parents[2]
RUNTIME_DIR = APP_DIR / ".ccpun-local"
LOCK_FILE = RUNTIME_DIR / "launcher.lock"
LOG_FILE = RUNTIME_DIR / "launcher.log"
SERVER_LOG_FILE = RUNTIME_DIR / "server.log"
STATE_FILE = RUNTIME_DIR / "server.json"
PROJECT_ID = "kyfxgjnq"
DATASET = "production"
ORIGIN = "http://localhost:3000"
ADMIN_URL = f"{ORIGIN}/dashboard/"
PORT = 3000
# ponytail: fixed targets are the safety boundary; add configuration only if a second lane is approved.


class ControllerError(RuntimeError):
    pass


def ensure_runtime_dir() -> None:
    RUNTIME_DIR.mkdir(mode=0o700, exist_ok=True)
    os.chmod(RUNTIME_DIR, 0o700)


def append_log(message: str) -> None:
    ensure_runtime_dir()
    fd = os.open(LOG_FILE, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as handle:
        handle.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")


def find_tool(name: str) -> str:
    candidates = [
        Path("/opt/homebrew/bin") / name,
        Path("/usr/local/bin") / name,
        Path("/usr/bin") / name,
        Path("/usr/sbin") / name,
    ]
    nvm_root = Path.home() / ".nvm" / "versions" / "node"
    if nvm_root.is_dir():
        candidates[:0] = sorted(nvm_root.glob(f"v*/bin/{name}"), reverse=True)
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    raise ControllerError(f"ไม่พบ {name} ในเครื่อง กรุณาติดต่อผู้ดูแลระบบ")


def runtime_env() -> dict[str, str]:
    node = Path(find_tool("node"))
    env = os.environ.copy()
    safe_path = [str(node.parent), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
    env["PATH"] = ":".join(dict.fromkeys(safe_path))
    env["CI"] = "1"
    env["SANITY_CLI_NO_UPDATE_NOTIFIER"] = "1"
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    return env


def run_capture(command: list[str], timeout: int = 45) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=APP_DIR,
        env=runtime_env(),
        stdin=subprocess.DEVNULL,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    append_log(f"command={Path(command[0]).name} exit={result.returncode}")
    return result


def sanity_command(*args: str) -> subprocess.CompletedProcess[str]:
    sanity = APP_DIR / "node_modules" / ".bin" / "sanity"
    if not sanity.exists():
        raise ControllerError("ไม่พบ Sanity CLI กรุณาติดต่อผู้ดูแลระบบ")
    result = run_capture([str(sanity), *args])
    if result.returncode != 0:
        raise ControllerError("เชื่อมต่อ Sanity ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตหรือเข้าสู่ระบบ Sanity แล้วลองอีกครั้ง")
    return result


def cors_origins() -> set[str]:
    result = sanity_command("cors", "list", "--project-id", PROJECT_ID)
    return {line.strip() for line in result.stdout.splitlines() if line.strip().startswith("http")}


def cors_headers() -> tuple[str, str]:
    query = urllib.parse.urlencode({"query": "1"})
    url = f"https://{PROJECT_ID}.api.sanity.io/v2026-01-01/data/query/{DATASET}?{query}"
    curl = find_tool("curl")
    result = run_capture(
        [
            curl,
            "--max-time",
            "15",
            "--silent",
            "--show-error",
            "--dump-header",
            "-",
            "--output",
            "/dev/null",
            "--header",
            f"Origin: {ORIGIN}",
            url,
        ],
        timeout=20,
    )
    if result.returncode != 0:
        raise ControllerError("ตรวจสอบ Sanity CORS ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต")
    headers: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if ":" in line:
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
    return headers.get("access-control-allow-origin", ""), headers.get("access-control-allow-credentials", "")


def remove_cors() -> bool:
    if ORIGIN not in cors_origins():
        return False
    sanity_command("cors", "delete", ORIGIN, "--project-id", PROJECT_ID)
    if ORIGIN in cors_origins():
        raise ControllerError("ปิด Sanity CORS ไม่สำเร็จ กรุณาลองกดปิดระบบอีกครั้ง")
    append_log("cors=removed")
    return True


def enable_cors(normalize: bool) -> None:
    present = ORIGIN in cors_origins()
    if present and normalize:
        remove_cors()
        present = False
    if not present:
        sanity_command("cors", "add", ORIGIN, "--credentials", "--project-id", PROJECT_ID)
    if ORIGIN not in cors_origins():
        raise ControllerError("เปิด Sanity CORS ไม่สำเร็จ")
    allow_origin, allow_credentials = cors_headers()
    if allow_origin != ORIGIN or allow_credentials.lower() != "true":
        try:
            remove_cors()
        finally:
            raise ControllerError("Sanity CORS ไม่ได้เปิดแบบปลอดภัย ระบบจึงยกเลิกการเริ่มทำงาน")
    append_log("cors=enabled credentials=true")


def port_is_busy() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex(("127.0.0.1", PORT)) == 0


def process_details(pid: int) -> tuple[int, str, str] | None:
    result = subprocess.run(
        ["/bin/ps", "-p", str(pid), "-o", "pgid=", "-o", "lstart=", "-o", "command="],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    parts = result.stdout.strip().split(maxsplit=6)
    if len(parts) != 7:
        return None
    return int(parts[0]), " ".join(parts[1:6]), parts[6]


def owned_process() -> tuple[int, int] | None:
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        pid = int(state["pid"])
        details = process_details(pid)
        if details is None:
            return None
        pgid, started_at, command = details
        command_ok = command.startswith("npm run local:production:draft") or command == (
            f"node {find_tool('npm')} run local:production:draft"
        )
        if pgid != pid or started_at != state["startedAt"] or not command_ok:
            return None
        return pid, pgid
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def start_process() -> None:
    npm = find_tool("npm")
    log_fd = os.open(SERVER_LOG_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(log_fd, "w", encoding="utf-8") as log_handle:
        process = subprocess.Popen(
            [npm, "run", "local:production:draft"],
            cwd=APP_DIR,
            env=runtime_env(),
            stdin=subprocess.DEVNULL,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            text=True,
        )
    details = None
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        details = process_details(process.pid)
        if details is not None and details[0] == process.pid:
            break
        time.sleep(0.05)
    if details is None or details[0] != process.pid:
        process.terminate()
        raise ControllerError("CCPun Admin เริ่มทำงานไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ")
    state = {"pid": process.pid, "startedAt": details[1]}
    temporary = STATE_FILE.with_suffix(".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(state, handle)
    os.replace(temporary, STATE_FILE)


def stop_process() -> bool:
    owned = owned_process()
    if owned is None:
        STATE_FILE.unlink(missing_ok=True)
        return False
    pid, pgid = owned
    os.killpg(pgid, signal.SIGTERM)
    deadline = time.monotonic() + 15
    while process_details(pid) is not None and time.monotonic() < deadline:
        time.sleep(0.25)
    if process_details(pid) is not None:
        os.killpg(pgid, signal.SIGKILL)
    STATE_FILE.unlink(missing_ok=True)
    deadline = time.monotonic() + 5
    while port_is_busy() and time.monotonic() < deadline:
        time.sleep(0.25)
    if port_is_busy():
        raise ControllerError("เซิร์ฟเวอร์ CCPun Admin ยังไม่หยุด กรุณากดปิดอีกครั้ง")
    append_log("server=stopped")
    return True


def listener_is_loopback_only() -> bool:
    lsof = find_tool("lsof")
    result = subprocess.run(
        [lsof, "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN"],
        text=True,
        capture_output=True,
        check=False,
    )
    lines = [line for line in result.stdout.splitlines()[1:] if line.strip()]
    return bool(lines) and all(f"127.0.0.1:{PORT}" in line for line in lines)


def wait_for_server(timeout: int = 75) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if owned_process() is None:
            raise ControllerError("CCPun Admin เริ่มทำงานไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ")
        try:
            request = urllib.request.Request(ADMIN_URL, method="GET")
            response = urllib.request.urlopen(request, timeout=2)
            response.close()
            if listener_is_loopback_only():
                return
        except (urllib.error.URLError, TimeoutError, socket.timeout, ControllerError):
            pass
        time.sleep(0.5)
    raise ControllerError("CCPun Admin ใช้เวลาเปิดนานเกินไป ระบบจึงยกเลิก")


def open_admin() -> str:
    if owned_process() and port_is_busy() and listener_is_loopback_only():
        enable_cors(normalize=False)
        wait_for_server()
        return "CCPun Admin เปิดอยู่แล้ว และพร้อมใช้งาน"
    if owned_process():
        stop_process()
    if port_is_busy():
        raise ControllerError("พอร์ต 3000 ถูกโปรแกรมอื่นใช้อยู่ ระบบจะไม่ปิดหรือแทนที่โปรแกรมนั้น")

    try:
        enable_cors(normalize=True)
    except ControllerError:
        try:
            remove_cors()
        except ControllerError:
            pass
        raise
    try:
        start_process()
        wait_for_server()
    except Exception:
        try:
            stop_process()
        except ControllerError:
            pass
        try:
            remove_cors()
        except ControllerError:
            pass
        raise

    append_log("server=ready loopback=true")
    return "เปิด CCPun Admin แล้ว ใช้งานได้เฉพาะบน Mac เครื่องนี้"


def close_admin() -> str:
    warnings: list[str] = []
    try:
        removed = stop_process()
        if not removed and port_is_busy():
            warnings.append("พบโปรแกรมอื่นที่พอร์ต 3000 และไม่ได้ปิดโปรแกรมนั้น")
    except ControllerError as error:
        warnings.append(str(error))

    try:
        remove_cors()
    except ControllerError as error:
        warnings.append(str(error))

    if warnings:
        raise ControllerError("; ".join(warnings))
    return "ปิด CCPun Admin และถอด Sanity CORS แล้ว"


def status() -> str:
    running = bool(owned_process()) and port_is_busy() and listener_is_loopback_only()
    try:
        allow_origin, allow_credentials = cors_headers()
        cors = "เปิด" if allow_origin == ORIGIN and allow_credentials.lower() == "true" else "ปิด"
    except ControllerError:
        cors = "ตรวจสอบไม่ได้"
    return f"Server: {'เปิด' if running else 'ปิด'} | Sanity CORS: {cors}"


def self_test() -> str:
    package = json.loads((APP_DIR / "package.json").read_text(encoding="utf-8"))
    script = package["scripts"]["local:production:draft"]
    assert ORIGIN == "http://localhost:3000"
    assert PROJECT_ID == "kyfxgjnq" and DATASET == "production"
    assert "--hostname 127.0.0.1" in script and "--port 3000" in script
    assert "CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=1" in script
    assert "*" not in ORIGIN
    assert STATE_FILE.name == "server.json"
    return "PASS local admin controller self-test"


def main() -> int:
    action = sys.argv[1] if len(sys.argv) == 2 else ""
    if action == "--self-test":
        print(self_test())
        return 0
    if action not in {"start", "stop", "status"}:
        print("ใช้คำสั่ง start, stop หรือ status เท่านั้น", file=sys.stderr)
        return 2

    ensure_runtime_dir()
    lock_fd = os.open(LOCK_FILE, os.O_WRONLY | os.O_CREAT, 0o600)
    with os.fdopen(lock_fd, "w", encoding="utf-8") as lock_handle:
        try:
            fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("ระบบกำลังเปิดหรือปิดอยู่ กรุณารอสักครู่", file=sys.stderr)
            return 1
        try:
            result = {"start": open_admin, "stop": close_admin, "status": status}[action]()
            print(result)
            return 0
        except ControllerError as error:
            append_log(f"error={type(error).__name__}")
            print(str(error), file=sys.stderr)
            return 1
        except Exception as error:
            append_log(f"unexpected={type(error).__name__}")
            print(f"เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาส่งไฟล์ {LOG_FILE.name} ให้ผู้ดูแลระบบ", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
