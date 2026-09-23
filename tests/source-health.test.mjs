import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, classifyPage, monitorUrlAllowed } from '../src/source-health.mjs';

const source = {
  id: 'S21',
  url: 'https://www.weather.gov/documentation/services-web-api',
  observedOn: '2026-09-22',
  monitor: true,
};
const body =
  '<html><head><title>NWS API service</title></head><body>Documentation for a public service.</body></html>';

test('monitor only allows a fixed set of credential-free HTTPS documentation hosts', () => {
  assert.ok(monitorUrlAllowed(source.url));
  for (const url of [
    'https://www.linestarapp.com/',
    'https://api.linestarapp.com/',
    'https://linestar.gitbook.io/',
    'https://localhost/',
    'http://www.weather.gov/',
    'https://username:password@github.com/',
    'https://github.com:444/',
    'https://github.com.evil.test/',
    'https://127.0.0.1/',
  ])
    assert.equal(monitorUrlAllowed(url), false, url);
});
test('disabled source performs zero network operations', async () => {
  let called = false;
  const report = await checkSource(
    { ...source, monitor: false },
    {
      fetcher: () => {
        called = true;
      },
    },
  );
  assert.equal(called, false);
  assert.equal(report.status, 'skipped-policy');
});
test('unapproved source performs zero network operations', async () => {
  let called = false;
  const report = await checkSource(
    { ...source, url: 'https://www.linestarapp.com/' },
    {
      fetcher: () => {
        called = true;
      },
    },
  );
  assert.equal(called, false);
  assert.equal(report.status, 'blocked-policy');
});
test('healthy page means reachable, never semantically re-verified', async () => {
  const report = await checkSource(source, {
    fetcher: async () => new Response(body, { status: 200 }),
  });
  assert.equal(report.status, 'reachable-not-reverified');
  assert.equal(report.reviewedOn, source.observedOn);
  assert.match(report.responseTextSha256, /^[a-f0-9]{64}$/);
});
test('HTTP 200 soft errors and access challenges are not successes', () => {
  for (const title of [
    '404 Not Found',
    'Page Not Found',
    'Access Denied',
    'Just a moment',
    'Verify you are human',
  ])
    assert.equal(classifyPage(200, `<title>${title}</title><p>Missing.</p>`), 'soft-error-page');
  assert.equal(classifyPage(200, ''), 'empty-or-unexpected');
  assert.equal(classifyPage(404), 'http-error');
  for (const status of [401, 403, 429]) assert.equal(classifyPage(status), 'access-or-rate-limit');
});
test('redirects cannot escape the allowlist or downgrade HTTPS', async () => {
  for (const location of [
    'https://www.linestarapp.com/Projections',
    'http://www.weather.gov/',
    'https://localhost/',
  ]) {
    let calls = 0;
    const report = await checkSource(source, {
      fetcher: async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location } });
      },
    });
    assert.equal(report.status, 'blocked-redirect');
    assert.equal(calls, 1);
  }
});
test('redirect cycles and missing location fail with bounded requests', async () => {
  let calls = 0;
  const report = await checkSource(source, {
    fetcher: async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: source.url } });
    },
  });
  assert.equal(report.status, 'redirect-limit');
  assert.equal(calls, 4);
  assert.equal(
    (await checkSource(source, { fetcher: async () => new Response(null, { status: 302 }) }))
      .status,
    'invalid-redirect',
  );
});
test('oversized content, network failures and rate limits are flagged without bypass', async () => {
  const large = await checkSource(source, {
    fetcher: async () => new Response('x'.repeat(128)),
    maxBytes: 64,
  });
  assert.equal(large.status, 'size-limit');
  let calls = 0;
  const denied = await checkSource(source, {
    fetcher: async () => {
      calls++;
      return new Response(null, { status: 429 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(denied.status, 'access-or-rate-limit');
  const error = await checkSource(source, {
    fetcher: async () => {
      throw new Error('Network unavailable');
    },
  });
  assert.equal(error.status, 'network-error');
  assert.equal(error.reviewedOn, '2026-09-22');
});
