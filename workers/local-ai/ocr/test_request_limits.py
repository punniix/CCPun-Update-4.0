"""Synthetic ASGI checks; OCR engine is mocked, never run or downloaded.

Run: python workers/local-ai/ocr/test_request_limits.py
Requires only the sidecar's declared FastAPI and Pillow versions.
"""
import asyncio
import hashlib
import io
import json
import subprocess
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from starlette.requests import Request

import app as worker


def scope(headers=None):
    return {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": "/v1/ocr",
        "raw_path": b"/v1/ocr", "query_string": b"",
        "headers": headers if headers is not None else [
            (b"authorization", b"Bearer " + b"synthetic-only-" * 4),
            (b"content-type", b"image/png"),
        ],
        "client": ("127.0.0.1", 1), "server": ("synthetic", 80),
    }


async def response(receive, headers=None):
    sent = []

    async def send(message):
        sent.append(message)

    await worker.app(scope(headers), receive, send)
    return sent[0]["status"], json.loads(sent[-1]["body"])


def complete(body):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return receive


class RequestLimits(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.patches = [
            patch.object(worker, "TOKEN", "synthetic-only-" * 4),
            patch.object(worker, "_gate", asyncio.Semaphore(1)),
            patch.object(worker, "safe_log"),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    async def test_empty_and_release(self):
        self.assertEqual(await response(complete(b"")), (413, {"detail": "image-too-large"}))
        self.assertFalse(worker._gate.locked())

    async def test_exact_limit_stream_without_content_length(self):
        body = b"x" * worker.MAX_BYTES
        request = Request(scope(), complete(body))
        self.assertEqual(await worker.read_image_body(request), body)

    async def test_chunked_cumulative_limit(self):
        received = 0

        async def receive():
            nonlocal received
            received += 1
            return {"type": "http.request", "body": b"x" * (worker.MAX_BYTES // 2 + 1), "more_body": True}

        self.assertEqual(await response(receive), (413, {"detail": "image-too-large"}))
        self.assertEqual(received, 2)
        self.assertFalse(worker._gate.locked())

    async def test_limit_plus_one_single_chunk(self):
        self.assertEqual(await response(complete(b"x" * (worker.MAX_BYTES + 1))), (413, {"detail": "image-too-large"}))
        self.assertFalse(worker._gate.locked())

    async def test_many_chunks_exact_limit(self):
        parts = [b"x" * 1024] * (worker.MAX_BYTES // 1024)
        calls = 0

        async def receive():
            nonlocal calls
            calls += 1
            return {"type": "http.request", "body": parts[calls - 1], "more_body": calls < len(parts)}

        self.assertEqual(len(await worker.read_image_body(Request(scope(), receive))), worker.MAX_BYTES)

    async def test_body_deadline_is_total_not_per_chunk(self):
        async def receive():
            await asyncio.sleep(0.006)
            return {"type": "http.request", "body": b"x", "more_body": True}

        with patch.object(worker, "BODY_TIMEOUT", 0.02):
            self.assertEqual(await response(receive), (408, {"detail": "image-read-timeout"}))
        self.assertFalse(worker._gate.locked())

    async def test_busy_concurrent_request_never_reads_body(self):
        started = asyncio.Event()

        async def slow_receive():
            started.set()
            await asyncio.Future()

        first = asyncio.create_task(response(slow_receive))
        await started.wait()
        calls = 0

        async def forbidden_receive():
            nonlocal calls
            calls += 1
            raise AssertionError("busy request must not read body")

        try:
            self.assertEqual(await response(forbidden_receive), (503, {"detail": "ocr-busy"}))
            self.assertEqual(calls, 0)
        finally:
            first.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await first
        self.assertFalse(worker._gate.locked())
        self.assertEqual(await response(complete(b"")), (413, {"detail": "image-too-large"}))

    async def test_receive_exception_releases_admission(self):
        async def failed_receive():
            raise OSError("synthetic disconnect")

        with self.assertRaises(OSError):
            await response(failed_receive)
        self.assertFalse(worker._gate.locked())

    async def test_auth_and_mime_reject_before_receive(self):
        async def forbidden_receive():
            raise AssertionError("rejected request must not read body")

        self.assertEqual((await response(forbidden_receive, []))[0], 401)
        headers = scope()["headers"][:1] + [(b"content-type", b"application/json")]
        self.assertEqual((await response(forbidden_receive, headers))[0], 415)
        self.assertFalse(worker._gate.locked())

    async def test_invalid_image_releases_and_unlinks(self):
        self.assertEqual(await response(complete(b"not-an-image")), (422, {"detail": "invalid-image"}))
        self.assertFalse(worker._gate.locked())

    async def test_valid_image_engine_mock_and_cleanup(self):
        data = io.BytesIO()
        Image.new("RGB", (4, 4)).save(data, "PNG")
        body = data.getvalue()
        seen = []

        def engine(command, **kwargs):
            image_path = Path(command[-1])
            seen.append(image_path)
            self.assertTrue(image_path.exists())
            self.assertEqual(kwargs["timeout"], 90)
            return SimpleNamespace(returncode=0, stdout='{"lines": []}')

        with patch.object(worker.subprocess, "run", engine):
            status, result = await response(complete(body))
        self.assertEqual(status, 200)
        self.assertEqual(result["imageDigestSha256"], hashlib.sha256(body).hexdigest())
        self.assertTrue(all(not path.exists() for path in seen))
        self.assertFalse(worker._gate.locked())

    async def test_engine_failure_and_timeout_release(self):
        data = io.BytesIO()
        Image.new("RGB", (4, 4)).save(data, "PNG")
        cases = [
            (SimpleNamespace(returncode=1, stdout=""), None, 503),
            (SimpleNamespace(returncode=0, stdout="not-json"), None, 503),
            (None, subprocess.TimeoutExpired("synthetic", 90), 504),
        ]
        for result, error, expected in cases:
            with patch.object(worker.subprocess, "run", return_value=result, side_effect=error):
                self.assertEqual((await response(complete(data.getvalue())))[0], expected)
            self.assertFalse(worker._gate.locked())

    async def test_engine_cancellation_keeps_slot_and_file_until_thread_finishes(self):
        data = io.BytesIO()
        Image.new("RGB", (4, 4)).save(data, "PNG")
        started = asyncio.Event()
        finish = threading.Event()
        loop = asyncio.get_running_loop()
        seen = []

        def engine(command, **kwargs):
            seen.append(Path(command[-1]))
            loop.call_soon_threadsafe(started.set)
            if not finish.wait(2):
                raise RuntimeError("synthetic test engine was not released")
            return SimpleNamespace(returncode=0, stdout='{"lines": []}')

        with patch.object(worker.subprocess, "run", engine):
            first = asyncio.create_task(response(complete(data.getvalue())))
            await asyncio.wait_for(started.wait(), 1)
            try:
                for _ in range(2):
                    first.cancel()
                    await asyncio.sleep(0)
                    self.assertTrue(worker._gate.locked())
                    self.assertTrue(seen[0].exists())
                    self.assertFalse(first.done())

                async def forbidden_receive():
                    raise AssertionError("engine still owns admission")

                self.assertEqual(await response(forbidden_receive), (503, {"detail": "ocr-busy"}))
            finally:
                finish.set()
                with self.assertRaises(asyncio.CancelledError):
                    await asyncio.wait_for(first, 1)
        self.assertFalse(worker._gate.locked())
        self.assertFalse(seen[0].exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
