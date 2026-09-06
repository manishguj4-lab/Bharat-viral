import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import handler from '../netlify/functions/telegram-publish.js';

describe('telegram-publish', () => {
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    originalFetch = global.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    mock.restoreAll();
  });

  test('should return 405 for non-POST requests', async () => {
    const req = { method: 'GET' };
    const response = await handler(req);

    assert.strictEqual(response.status, 405);
    const text = await response.text();
    assert.strictEqual(text, 'Method Not Allowed');
  });

  test('should return 500 if environment variables are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const req = {
      method: 'POST',
      json: async () => ({ title: 'Test' })
    };

    const response = await handler(req);

    assert.strictEqual(response.status, 500);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.deepStrictEqual(body, { error: "Telegram environment variables missing" });
  });

  test('should send Photo and return 200 when image_url is provided', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    const req = {
      method: 'POST',
      json: async () => ({
        title: 'Test Title',
        description: 'Test Description',
        url: 'https://example.com/article',
        image_url: 'https://example.com/image.jpg'
      })
    };

    let fetchCalled = false;
    let fetchArgs = [];

    global.fetch = mock.fn(async (url, options) => {
      fetchCalled = true;
      fetchArgs = [url, options];
      return {
        json: async () => ({ ok: true })
      };
    });

    const response = await handler(req);

    assert.strictEqual(response.status, 200);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.deepStrictEqual(body, { success: true });

    assert.strictEqual(fetchCalled, true);
    assert.strictEqual(fetchArgs[0], 'https://api.telegram.org/bottest-token/sendPhoto');
    assert.strictEqual(fetchArgs[1].method, 'POST');

    const parsedBody = JSON.parse(fetchArgs[1].body);
    assert.strictEqual(parsedBody.chat_id, 'test-chat-id');
    assert.strictEqual(parsedBody.photo, 'https://example.com/image.jpg');
    assert.ok(parsedBody.caption.includes('Test Title'));
    assert.ok(parsedBody.caption.includes('Test Description'));
    assert.ok(parsedBody.caption.includes('https://example.com/article'));
  });

  test('should send Message and return 200 when image_url is not provided', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    const req = {
      method: 'POST',
      json: async () => ({
        title: 'Test Title',
        description: 'Test Description',
        url: 'https://example.com/article'
      })
    };

    global.fetch = mock.fn(async (url, options) => {
      return {
        json: async () => ({ ok: true })
      };
    });

    const response = await handler(req);

    assert.strictEqual(response.status, 200);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.deepStrictEqual(body, { success: true });

    assert.strictEqual(global.fetch.mock.calls.length, 1);
    const call = global.fetch.mock.calls[0];
    const url = call.arguments[0];
    const options = call.arguments[1];

    assert.strictEqual(url, 'https://api.telegram.org/bottest-token/sendMessage');
    assert.strictEqual(options.method, 'POST');

    const parsedBody = JSON.parse(options.body);
    assert.strictEqual(parsedBody.chat_id, 'test-chat-id');
    assert.strictEqual(parsedBody.photo, undefined);
    assert.strictEqual(parsedBody.text !== undefined, true);
    assert.ok(parsedBody.text.includes('Test Title'));
  });

  test('should return 500 when Telegram API returns ok: false', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    const req = {
      method: 'POST',
      json: async () => ({ title: 'Test' })
    };

    global.fetch = mock.fn(async (url, options) => {
      return {
        json: async () => ({ ok: false, description: 'Bad Request' })
      };
    });

    const response = await handler(req);

    assert.strictEqual(response.status, 500);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.strictEqual(body.error, 'Telegram API error');
    assert.deepStrictEqual(body.details, { ok: false, description: 'Bad Request' });
  });

  test('should return 500 on unexpected errors', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    const req = {
      method: 'POST',
      json: async () => {
        throw new Error('Invalid JSON');
      }
    };

    const response = await handler(req);

    assert.strictEqual(response.status, 500);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.strictEqual(body.error, 'Invalid JSON');
  });
});
