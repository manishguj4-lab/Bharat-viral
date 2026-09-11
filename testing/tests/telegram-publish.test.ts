import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('telegram-publish', () => {
  it('should return 405 for non-POST requests', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', { method: 'GET' });
    const response = await handler(req, {});
    assert.strictEqual(response.status, 405);
  });

  it('should return 401 if missing Authorization header', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', { method: 'POST' });
    const response = await handler(req, {});
    assert.strictEqual(response.status, 401);
  });

  it('should return 401 if invalid Authorization header', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
      method: 'POST',
      headers: { 'Authorization': 'Basic 123' }
    });
    const response = await handler(req, {});
    assert.strictEqual(response.status, 401);
  });

  it('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: '' };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' }
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 500);
    } finally {
      process.env = originalEnv;
    }
  });

  it('should return 401 if user resolution fails', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key' };

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: false };
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' }
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 401);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should return 403 if user is not admin', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key' };

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([]) }; // No admin roles
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' }
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 403);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should return 400 for malformed json body', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key' };

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: 'invalid json'
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 400);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should send Photo and return 200 when image_url is provided by valid admin', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };

    const originalFetch = global.fetch;
    let telegramApiUrl = '';
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      if (url.includes('api.telegram.org')) {
        telegramApiUrl = url;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: JSON.stringify({ title: 'Test', image_url: 'https://example.com/image.jpg' })
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 200);
      assert.ok(telegramApiUrl.includes('sendPhoto'));
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should send Message and return 200 when image_url is not provided by valid admin', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };

    const originalFetch = global.fetch;
    let telegramApiUrl = '';
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      if (url.includes('api.telegram.org')) {
        telegramApiUrl = url;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: JSON.stringify({ title: 'Test' }) // No image
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 200);
      assert.ok(telegramApiUrl.includes('sendMessage'));
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should return 500 when Telegram API returns ok: false', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      if (url.includes('api.telegram.org')) {
        return { ok: true, json: async () => ({ ok: false }) }; // API failure
      }
      return { ok: true };
    };

    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: JSON.stringify({ title: 'Test' })
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 500);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });
  it('should return 400 for invalid article URL protocol', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;
    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      return { ok: true };
    };
    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: JSON.stringify({ title: 'Test', url: 'javascript:alert(1)' })
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 400);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });

  it('should return 400 for invalid image URL protocol', async () => {
    const module = await import('../../netlify/functions/api/telegram-publish.js');
    const handler = module.default;
    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '123' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'admin' }]) };
      return { ok: true };
    };
    try {
      const req = new Request('https://bharatviralnews.netlify.app/api/telegram-publish', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer 123' },
        body: JSON.stringify({ title: 'Test', image_url: 'data:image/png;base64,123' })
      });
      const response = await handler(req, {});
      assert.strictEqual(response.status, 400);
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });
});
