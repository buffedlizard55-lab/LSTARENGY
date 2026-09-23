import { digest } from './catalogue.mjs';

// An explicit documentation-only allowlist, not a generic crawler or ingestion API.
export const MONITOR_HOSTS = new Set([
  'nflreadr.nflverse.com',
  'github.com',
  'www.weather.gov',
  'www.uspto.gov',
  'docs.github.com',
]);
export function monitorUrlAllowed(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      MONITOR_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}
export function classifyPage(status, text = '') {
  if (status === 401 || status === 403 || status === 429) return 'access-or-rate-limit';
  if (status < 200 || status >= 300) return 'http-error';
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] ?? '';
  if (
    /\b(404|page not found|access denied|just a moment|captcha|verify you are human)\b/i.test(title)
  )
    return 'soft-error-page';
  if (text.trim().length < 32) return 'empty-or-unexpected';
  return 'reachable-not-reverified';
}

export async function checkSource(
  source,
  { fetcher = fetch, timeoutMs = 8000, maxBytes = 2000000 } = {},
) {
  const base = {
    sourceId: source.id,
    reviewedOn: source.observedOn,
    checkedAt: new Date().toISOString(),
  };
  if (source.monitor !== true)
    return {
      ...base,
      status: 'skipped-policy',
      detail: 'Automated monitoring disabled; no request made.',
    };
  if (!monitorUrlAllowed(source.url))
    return {
      ...base,
      status: 'blocked-policy',
      detail: 'URL is outside the documentation allowlist; no request made.',
    };
  try {
    let url = source.url;
    const signal = AbortSignal.timeout(timeoutMs); // One deadline includes redirects and body reading.
    for (let hop = 0; hop <= 3; hop += 1) {
      if (!monitorUrlAllowed(url))
        return {
          ...base,
          status: 'blocked-redirect',
          detail: 'Redirect outside allowlist; not followed.',
        };
      const response = await fetcher(url, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent':
            'LSTARENGY-SourceHealth/0.1 (https://github.com/buffedlizard55-lab/LSTARENGY)',
          Accept: 'text/html, text/plain;q=0.9',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return { ...base, status: 'invalid-redirect', httpStatus: response.status };
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return {
          ...base,
          status: classifyPage(response.status),
          httpStatus: response.status,
          finalUrl: url,
        };
      }
      if (!response.body)
        return { ...base, status: 'empty-or-unexpected', httpStatus: response.status };
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return { ...base, status: 'size-limit', httpStatus: response.status };
        }
        chunks.push(Buffer.from(value));
      }
      const body = Buffer.concat(chunks).toString('utf8');
      return {
        ...base,
        status: classifyPage(response.status, body),
        httpStatus: response.status,
        finalUrl: url,
        bytes: size,
        responseTextSha256: digest(body),
        detail:
          'Availability only. Response hash is not proof of source meaning, excerpt currency, licensing, or accuracy.',
      };
    }
    return { ...base, status: 'redirect-limit' };
  } catch (error) {
    return {
      ...base,
      status: 'network-error',
      detail:
        error instanceof Error ? error.message : 'Request failed. No retry or bypass attempted.',
    };
  }
}
