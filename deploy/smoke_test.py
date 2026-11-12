"""Read-only checks of a deployed SlotBook. Credentials and cookies are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    Exits non-zero (failing the workflow) if a check fails. Each public check is retried up to
    5 times, 3 seconds apart, to tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/health    -> 200 {"status": "ok"}
      2. GET /api/ready     -> 200 {"status": "ready", "database": "connected"} (the DB answers)
      3. GET /              -> 200 and the page contains "SlotBook" (the SPA is served)
      4. GET /api/services  -> 401 without a session (access control is on)
      5. OPTIONAL sign-in   -> only if BOTH SMOKE_EMAIL and SMOKE_PASSWORD are set: log in,
         GET /api/services with the session cookie -> 200 and a non-empty list, then log out
         (always, even if a check fails).

    Uses only the Python standard library. Offline unit tests: deploy/tests/test_smoke.py
    Adapted from the Lab 5 starter kit: SlotBook uses a session cookie, not a bearer token.
"""
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request


def request(base, path, data=None, opener=None):
    """Returns (status, body). HTTP errors are returned, not raised; network errors raise."""
    headers = {'Content-Type': 'application/json'} if data is not None else {}
    req = urllib.request.Request(base + path, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with (opener or urllib.request.build_opener()).open(req, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def is_json(body, **expected):
    data = json.loads(body)
    return all(data.get(key) == value for key, value in expected.items())


PUBLIC_CHECKS = (
    ('/api/health', lambda status, body: status == 200 and is_json(body, status='ok')),
    ('/api/ready', lambda status, body: status == 200 and is_json(body, status='ready', database='connected')),
    ('/', lambda status, body: status == 200 and b'SlotBook' in body),
    ('/api/services', lambda status, body: status == 401),
)


def check(base):
    for path, predicate in PUBLIC_CHECKS:
        for attempt in range(5):
            try:
                if not predicate(*request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP sign-in: optional smoke credentials not configured')
        return
    # The session cookie lives only in this opener's jar.
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    try:
        status, _ = request(base, '/api/auth/login', {'email': email, 'password': password}, opener=opener)
        if status != 200:
            raise ValueError('login')
        status, body = request(base, '/api/services', opener=opener)
        if status != 200 or not json.loads(body).get('services'):
            raise ValueError('services')
        print('PASS sign-in and authenticated /api/services')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        request(base, '/api/auth/logout', data={}, opener=opener)
        print('PASS logout')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
