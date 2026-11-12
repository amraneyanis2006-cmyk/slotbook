"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml).

Covers: the public checks pass and login is skipped without credentials; a database that is not
ready, a page that is not SlotBook, or an API that answers without a session each fail; with
credentials the session cookie reaches /api/services and the session is logged out even if a check fails.
Adapted from the starter kit (SlotBook uses a session cookie, not a bearer token).
"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)

CREDENTIALS = {'SMOKE_EMAIL': 'smoke@example.test', 'SMOKE_PASSWORD': 'test-only'}


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, opener=None):
        """(status, body) of a healthy deployment; /api/services needs the session (opener)."""
        if path == '/api/services':
            return (200, b'{"services":[{"id":1}]}') if opener else (401, b'{"error":"UNAUTHENTICATED"}')
        return {
            '/api/health': (200, b'{"status":"ok","database":"up"}'),
            '/api/ready': (200, b'{"status":"ready","database":"connected"}'),
            '/': (200, b'<!doctype html><title>SlotBook</title>'),
            '/api/auth/login': (200, b'{"user":{"id":3}}'),
            '/api/auth/logout': (204, b''),
        }[path]

    def failing(self, broken_path, answer):
        def fake(base, path, data=None, opener=None):
            return answer if path == broken_path else self.response(base, path, data, opener)
        return fake

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
        self.assertEqual([c.args[1] for c in req.call_args_list], ['/api/health', '/api/ready', '/', '/api/services'])

    @patch.dict('os.environ', {}, clear=True)
    def test_each_public_check_fails_on_a_wrong_answer(self):
        cases = {
            '/api/ready': (503, b'{"status":"not_ready"}'),
            '/': (200, b'<html>Some other app</html>'),
            '/api/services': (200, b'{"services":[]}'),  # answered without a session: auth is broken
            '/api/health': (200, b'{"status":"degraded"}'),
        }
        for path, answer in cases.items():
            with self.subTest(path=path), patch.object(smoke, 'request', side_effect=self.failing(path, answer)), \
                    patch.object(smoke.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, path):
                    smoke.check('https://demo.test')

    @patch.dict('os.environ', CREDENTIALS, clear=True)
    def test_login_uses_the_session_cookie_then_logs_out(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
        calls = [(c.args[1], c.kwargs.get('opener') is not None) for c in req.call_args_list[4:]]
        self.assertEqual(calls, [('/api/auth/login', True), ('/api/services', True), ('/api/auth/logout', True)])

    @patch.dict('os.environ', CREDENTIALS, clear=True)
    def test_session_is_logged_out_even_if_services_fails(self):
        def broken(base, path, data=None, opener=None):
            if path == '/api/services' and opener:
                return (500, b'{"error":"INTERNAL_ERROR"}')
            return self.response(base, path, data, opener)
        with patch.object(smoke, 'request', side_effect=broken) as req:
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
        self.assertEqual(req.call_args.args[1], '/api/auth/logout')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test'}, clear=True)
    def test_only_one_credential_is_an_error(self):
        with patch.object(smoke, 'request', side_effect=self.response):
            with self.assertRaisesRegex(RuntimeError, 'both SMOKE_EMAIL and SMOKE_PASSWORD'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', CREDENTIALS, clear=True)
    def test_password_is_never_printed(self):
        with patch.object(smoke, 'request', side_effect=self.response), patch('builtins.print') as out:
            smoke.check('https://demo.test')
        self.assertNotIn('test-only', ' '.join(str(c) for c in out.call_args_list))


if __name__ == '__main__':
    unittest.main()
