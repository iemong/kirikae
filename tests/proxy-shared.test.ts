import { describe, expect, it } from 'bun:test';
import {
  buildUpstreamHttpUrl,
  buildUpstreamWebSocketUrl,
  getActiveEnvironmentBase,
  buildHttpForwardHeaders,
  buildWebSocketForwardHeaders,
} from '../src/proxy-shared';
import type { EnvironmentStore } from '../src/environment-store';

describe('buildUpstreamHttpUrl', () => {
  it('keeps the hash and query string', () => {
    const base = new URL('http://localhost:4000/base');
    const incoming = new URL('http://proxy.local/path?x=1#hash');
    expect(buildUpstreamHttpUrl(base, incoming)).toBe('http://localhost:4000/base/path?x=1#hash');
  });
});

describe('buildUpstreamWebSocketUrl', () => {
  it('switches protocol and drops hash', () => {
    const base = new URL('https://example.com/base');
    const incoming = new URL('http://proxy.local/ws?token=1#hash');
    expect(buildUpstreamWebSocketUrl(base, incoming)).toBe('wss://example.com/base/ws?token=1');
  });

  it('uses ws protocol for http base', () => {
    const base = new URL('http://example.com/base');
    const incoming = new URL('http://proxy.local/ws');
    expect(buildUpstreamWebSocketUrl(base, incoming)).toBe('ws://example.com/base/ws');
  });
});

describe('getActiveEnvironmentBase', () => {
  it('returns null when no active environment', () => {
    const store = {
      getActiveSelection: () => ({ url: null }),
    } as EnvironmentStore;
    expect(getActiveEnvironmentBase(store)).toBeNull();
  });

  it('returns URL when active environment exists', () => {
    const store = {
      getActiveSelection: () => ({ url: 'http://localhost:3000' }),
    } as EnvironmentStore;
    const result = getActiveEnvironmentBase(store);
    expect(result).not.toBeNull();
    expect(result?.toString()).toBe('http://localhost:3000/');
  });
});

describe('buildHttpForwardHeaders', () => {
  it('sets forwarding headers correctly', () => {
    const requestHeaders = new Headers({
      'user-agent': 'test-agent',
      'content-type': 'application/json',
    });
    const incomingUrl = new URL('http://proxy.local/api');
    const environmentBase = new URL('http://backend:8080');

    const result = buildHttpForwardHeaders(requestHeaders, incomingUrl, environmentBase);

    expect(result.get('host')).toBe('backend:8080');
    expect(result.get('x-forwarded-host')).toBe('proxy.local');
    expect(result.get('x-forwarded-proto')).toBe('http');
    expect(result.get('x-forwarded-for')).toBe('127.0.0.1');
    expect(result.get('user-agent')).toBe('test-agent');
    expect(result.get('content-type')).toBe('application/json');
  });

  it('preserves existing x-forwarded-for header', () => {
    const requestHeaders = new Headers({
      'x-forwarded-for': '192.168.1.1',
    });
    const incomingUrl = new URL('http://proxy.local/api');
    const environmentBase = new URL('http://backend:8080');

    const result = buildHttpForwardHeaders(requestHeaders, incomingUrl, environmentBase);

    expect(result.get('x-forwarded-for')).toBe('192.168.1.1');
  });
});

describe('buildWebSocketForwardHeaders', () => {
  it('filters hop-by-hop headers and sets host', () => {
    const headers = new Headers({
      'user-agent': 'test-agent',
      'connection': 'upgrade',
      'upgrade': 'websocket',
      'sec-websocket-key': 'test-key',
      'sec-websocket-version': '13',
      'custom-header': 'custom-value',
    });
    const environmentBase = new URL('https://backend:8080');

    const result = buildWebSocketForwardHeaders(headers, environmentBase);

    expect(result.host).toBe('backend:8080');
    expect(result['user-agent']).toBe('test-agent');
    expect(result['custom-header']).toBe('custom-value');
    expect(result.connection).toBeUndefined();
    expect(result.upgrade).toBeUndefined();
    expect(result['sec-websocket-key']).toBeUndefined();
    expect(result['sec-websocket-version']).toBeUndefined();
    expect(result.origin).toBe('https://backend:8080');
  });

  it('sets origin when not present in headers', () => {
    const headers = new Headers({
      'user-agent': 'test-agent',
    });
    const environmentBase = new URL('http://backend:8080');

    const result = buildWebSocketForwardHeaders(headers, environmentBase);

    expect(result.origin).toBe('http://backend:8080');
  });

  it('preserves existing origin header', () => {
    const headers = new Headers({
      'origin': 'http://original-origin',
    });
    const environmentBase = new URL('http://backend:8080');

    const result = buildWebSocketForwardHeaders(headers, environmentBase);

    expect(result.origin).toBe('http://original-origin');
  });
});
