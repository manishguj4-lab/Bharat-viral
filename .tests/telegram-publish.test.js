const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

const handler = async (event, ctx) => {
  const context = {
    env: { TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID },
    request: { method: event.httpMethod, json: async () => typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {}) }
  };
  const { onRequest } = await import('../functions/api/telegram-publish.js');
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
      TELEGRAM_CHAT_ID: 'test-chat-id'
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

  test('should return 500 if environment variables are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const req = { httpMethod: 'POST', body: '{}' };
    const response = await handler(req);
    assert.strictEqual(response.status, 500);
  });

  test('should send Photo and return 200 when image_url is provided', async () => {
    let fetchUrl;
    global.fetch = async (url) => {
      fetchUrl = url;
      return { ok: true, json: async () => ({ ok: true }) };
    };

    const req = {
      httpMethod: 'POST',
      body: JSON.stringify({ title: 'Test Title', image_url: 'http://example.com/image.jpg' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(fetchUrl, 'https://api.telegram.org/bottest-token/sendPhoto');
  });

  test('should send Message and return 200 when image_url is not provided', async () => {
    let fetchUrl;
    let fetchBody;
    global.fetch = async (url, options) => {
      fetchUrl = url;
      fetchBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    };

    const req = {
      httpMethod: 'POST',
      body: JSON.stringify({ title: 'Test Title' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(fetchUrl, 'https://api.telegram.org/bottest-token/sendMessage');
    assert.ok(fetchBody.text.includes('Test Title'));
  });

  test('should return 500 when Telegram API returns ok: false', async () => {
    global.fetch = async () => {
      return { ok: false, json: async () => ({ ok: false, description: 'Error' }) };
    };

    const req = {
      httpMethod: 'POST',
      body: JSON.stringify({ title: 'Test Title' })
    };

    const response = await handler(req);
    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error, 'Telegram API error');
  });
});