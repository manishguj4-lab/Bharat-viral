import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert';

const handler = async (event) => {
  const context = {
    env: {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_KEY: "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    request: {
      method: event.httpMethod,
      headers: new Headers(event.headers || {}),
      json: async () => typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {})
    }
  };
  const { onRequest } = await import('../../functions/api/telegram-publish.js');
  return onRequest(context);
};

describe('telegram-publish', () => {
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    originalEnv = process.env;
    originalFetch = global.fetch;
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat-id',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test('should return 405 for non-POST requests', async () => {
    const req = { httpMethod: 'GET' };
    const response = await handler(req);
    assert.strictEqual(response.status, 405);
  });

  test('should return 401 if missing Authorization header', async () => {
    const req = { httpMethod: 'POST', headers: {}, body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 401);
  });

  test('should return 401 if invalid Authorization header', async () => {
    const req = { httpMethod: 'POST', headers: { 'Authorization': 'Basic 123' }, body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 401);
  });

  test('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const req = { httpMethod: 'POST', headers: { 'Authorization': 'Bearer 123' }, body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 500);
  });

  test('should return 401 if user resolution fails', async () => {
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: false };
      return { ok: true, json: async () => ({}) };
    };
    const req = { httpMethod: 'POST', headers: { 'Authorization': 'Bearer 123' }, body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 401);
  });

  test('should return 403 if user is not admin', async () => {
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([]) }; // empty array = no role
      return { ok: true, json: async () => ({}) };
    };
    const req = { httpMethod: 'POST', headers: { 'Authorization': 'Bearer 123' }, body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 403);
  });

  test('should return 400 for malformed json body', async () => {
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'admin-1' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      return { ok: true, json: async () => ({}) };
    };
    const req = { httpMethod: 'POST', headers: { 'Authorization': 'Bearer 123' }, body: 'not json' };
    const response = await handler(req);
    assert.strictEqual(response.status, 400);
  });

  test('should send Photo and return 200 when image_url is provided by valid admin', async () => {
    let fetchUrl;
    global.fetch = async (url, options) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'admin-1' }) };
      if (url.includes('/rest/v1/user_roles')) {
        // Ensure service role key is used securely
        assert.strictEqual(options.headers.apikey, 'mock-service-role-key');
        assert.strictEqual(options.headers.Authorization, 'Bearer mock-service-role-key');
        return { ok: true, json: async () => ([{ role: 'admin' }]) };
      }
      fetchUrl = url;
      return { ok: true, json: async () => ({ ok: true }) };
    };

    const req = {
      httpMethod: 'POST',
      headers: { 'Authorization': 'Bearer valid-jwt' },
      body: JSON.stringify({ title: 'Test Title', image_url: 'http://example.com/image.jpg' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(fetchUrl, 'https://api.telegram.org/bottest-token/sendPhoto');
  });

  test('should send Message and return 200 when image_url is not provided by valid admin', async () => {
    let fetchUrl;
    let fetchBody;
    global.fetch = async (url, options) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'admin-1' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };

      fetchUrl = url;
      fetchBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    };

    const req = {
      httpMethod: 'POST',
      headers: { 'Authorization': 'Bearer valid-jwt' },
      body: JSON.stringify({ title: 'Test Title' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(fetchUrl, 'https://api.telegram.org/bottest-token/sendMessage');
    assert.ok(fetchBody.text.includes('Test Title'));
  });

  test('should return 500 when Telegram API returns ok: false', async () => {
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'admin-1' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };

      return { ok: false, json: async () => ({ ok: false, description: 'Error' }) };
    };

    const req = {
      httpMethod: 'POST',
      headers: { 'Authorization': 'Bearer valid-jwt' },
      body: JSON.stringify({ title: 'Test Title' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error, 'Telegram API error');
  });
});