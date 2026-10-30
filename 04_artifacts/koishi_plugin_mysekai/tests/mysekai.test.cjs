'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseMapQuery, internalImageUrl, migrationRecords } = require('../index.cjs');
test('invalid map tails cannot trigger a four-map render', () => {
  for (const raw of ['site 4', 'site 9', 'site 6 extra', 'all extra', 'site -1']) assert.equal(parseMapQuery(raw).valid, false);
  assert.deepEqual(parseMapQuery('site 6'), { valid: true, siteId: '6' });
  assert.deepEqual(parseMapQuery(''), { valid: true, siteId: null });
});
test('images are fetched from the configured backend', () => {
  assert.equal(internalImageUrl('http://public.example:3939/api/plugin/mysekai/file?name=map.png', 'http://receiver:3939'), 'http://receiver:3939/api/plugin/mysekai/file?name=map.png');
  assert.throws(() => internalImageUrl('file:///etc/passwd', 'http://receiver:3939'));
  assert.throws(() => internalImageUrl('https://example.com/admin', 'http://receiver:3939'));
});
test('binding migration preserves string IDs and rejects lossy numeric IDs', () => {
  const gameId = '1234567890123456789012345';
  assert.deepEqual(migrationRecords({ bindings: { '123456': gameId } }), [{ qqId: '123456', gameId }]);
  assert.throws(() => migrationRecords({ bindings: { '123456': 1234567890123456789 } }));
});

test('real Koishi/SQLite import, command dispatch and unbind survive a restart', async () => {
  const { App, Bot } = require('koishi');
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const plugin = require('../index.cjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'koishi-mysekai-'));
  const importFile = path.join(dir, 'bindings.json');
  await fs.writeFile(importFile, JSON.stringify({ bindings: { '200000': '1234567890123456789012345' } }));
  async function start() {
    const app = new App({ prefix: ['', '/', '!'] });
    app.plugin(require('@koishijs/plugin-http').default);
    app.plugin(require('@koishijs/plugin-database-sqlite').default, { path: path.join(dir, 'koishi.db') });
    app.plugin(plugin, { importBindingsPath: importFile });
    class TestBot extends Bot {
      // This test bot owns no transport; avoid Satori's disposed-context teardown.
      dispose() {}
      constructor(ctx, config) {
        super(ctx, config, 'onebot');
        this.user = { id: '100000', name: 'test' };
      }
    }
    app.plugin(TestBot, {});
    await app.start();
    const bot = app.bots[0];
    const session = bot.session({ type: 'message', platform: 'onebot', user: { id: '200000' }, channel: { id: '200000', type: 1 }, message: { content: '' } });
    return { app, session };
  }
  let current;
  try {
    current = await start();
    assert.equal((await current.app.database.get('mysekai_binding', {})).length, 1);
    assert.match((await current.session.execute('mysk whoami', true)).join(''), /1234567890123456789012345/);
    assert.match((await current.session.execute('mysk unbind', true)).join(''), /已解除绑定/);
    await current.app.stop();
    current = null;
    current = await start();
    assert.equal((await current.app.database.get('mysekai_binding', {})).length, 0);
    assert.match((await current.session.execute('mysk bind 9999999999999999999', true)).join(''), /绑定成功/);
    assert.equal((await current.app.database.get('mysekai_binding', {}))[0].gameId, '9999999999999999999');
  } finally {
    if (current) await current.app.stop();
    // Only the uniquely created test directory is removed.
    await fs.rm(dir, { recursive: true, force: true });
  }
});
