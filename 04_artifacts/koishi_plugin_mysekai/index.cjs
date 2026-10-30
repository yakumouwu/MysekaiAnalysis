'use strict';
const fs = require('node:fs/promises');
const { Schema, h } = require('koishi');

exports.name = 'mysekai';
exports.inject = ['database', 'http'];
exports.Config = Schema.object({
  backendBaseUrl: Schema.string().default('http://pjsk-receiver-dev:3939'),
  backendApiKey: Schema.string().role('secret').default(''),
  queryCooldownSeconds: Schema.number().min(1).max(3600).default(60),
  requestTimeoutSeconds: Schema.number().min(1).max(120).default(45),
  maxBindings: Schema.number().min(1).max(10000).default(25),
  importBindingsPath: Schema.string().default('data/import-bindings.json'),
});

function parseMapQuery(raw = '') {
  if (!raw.trim()) return { valid: true, siteId: null };
  const match = /^(?:site\s+)?([5-8])$/.exec(raw.trim());
  return { valid: !!match, siteId: match ? match[1] : null };
}
function internalImageUrl(raw, backendBaseUrl) {
  const image = new URL(raw);
  if (!['http:', 'https:'].includes(image.protocol) || image.pathname !== '/api/plugin/mysekai/file' || !image.searchParams.get('name')) {
    throw new Error('unsupported backend image URL');
  }
  const result = new URL('/api/plugin/mysekai/file', backendBaseUrl);
  result.searchParams.set('name', image.searchParams.get('name'));
  return result.toString();
}
function migrationRecords(payload) {
  if (!payload?.bindings || typeof payload.bindings !== 'object' || Array.isArray(payload.bindings)) throw new Error('invalid bindings object');
  return Object.entries(payload.bindings).map(([qqId, gameId]) => {
    if (!/^\d+$/.test(qqId) || typeof gameId !== 'string' || !/^\d{6,25}$/.test(gameId)) throw new Error('IDs must be decimal strings');
    return { qqId, gameId };
  });
}
Object.assign(exports, { parseMapQuery, internalImageUrl, migrationRecords });

exports.apply = function apply(ctx, config) {
  const logger = ctx.logger('mysekai');
  const lastQueries = new Map();
  let queryBusy = false;
  let bindingTail = Promise.resolve();
  ctx.model.extend('mysekai_binding', { qqId: 'string', gameId: 'string', updatedAt: 'timestamp' }, { primary: 'qqId' });
  const identity = session => {
    const id = session?.event?.user?.id || session?.userId;
    return session?.platform === 'onebot' && /^\d+$/.test(id || '') ? String(id) : null;
  };
  const mutateBinding = task => {
    const result = bindingTail.then(task);
    bindingTail = result.catch(() => {});
    return result;
  };
  ctx.on('ready', async () => {
    try {
      const records = migrationRecords(JSON.parse(await fs.readFile(config.importBindingsPath, 'utf8')));
      let imported = 0;
      for (const record of records) {
        if (!(await ctx.database.get('mysekai_binding', { qqId: record.qqId })).length) {
          await ctx.database.create('mysekai_binding', { ...record, updatedAt: new Date() });
          imported++;
        }
      }
      // A completed import must never undo an unbind after a later restart.
      await fs.rename(config.importBindingsPath, config.importBindingsPath + '.imported');
      logger.info('Imported %d legacy bindings', imported);
    } catch (error) {
      if (error.code !== 'ENOENT') logger.error('Binding import failed: %s', error.message);
    }
  });

  ctx.command('mysk', 'Mysekai 绑定和地图查询').action(() => 'mysk ping\nmysk bind <游戏ID>\nmysk unbind\nmysk whoami\nmysk map\nmysk map site <5|6|7|8>');
  ctx.command('mysk.ping', '检查插件状态').action(() => 'mysk pong：Koishi 插件运行正常');
  ctx.command('mysk.bind <gameId:string>', '绑定游戏账号', { checkArgCount: true }).action(async ({ session }, gameId) => {
    const qqId = identity(session);
    if (!qqId) return '请在 QQ 中使用此命令。';
    if (!/^\d{6,25}$/.test(gameId || '')) return '用法：mysk bind <6–25 位游戏ID>';
    return mutateBinding(async () => {
      const current = await ctx.database.get('mysekai_binding', { qqId });
      if (!current.length && (await ctx.database.get('mysekai_binding', {})).length >= config.maxBindings) return '绑定数量已达到上限。';
      await ctx.database.upsert('mysekai_binding', [{ qqId, gameId, updatedAt: new Date() }]);
      return `绑定成功：${gameId}`;
    });
  });
  ctx.command('mysk.unbind', '解除自己的绑定', { checkArgCount: true }).action(async ({ session }) => {
    const qqId = identity(session);
    if (!qqId) return '请在 QQ 中使用此命令。';
    return mutateBinding(async () => {
      const result = await ctx.database.remove('mysekai_binding', { qqId });
      return result.matched ? '已解除绑定。' : '尚未绑定游戏账号。';
    });
  });
  ctx.command('mysk.whoami', '查看自己的绑定', { checkArgCount: true }).action(async ({ session }) => {
    const qqId = identity(session);
    if (!qqId) return '请在 QQ 中使用此命令。';
    const [record] = await ctx.database.get('mysekai_binding', { qqId });
    return record ? `QQ：${qqId}\n游戏ID：${record.gameId}` : '尚未绑定，请使用 mysk bind <游戏ID>。';
  });
  ctx.command('mysk.map [query:text]', '查询资源地图').action(async ({ session }, raw) => {
    const qqId = identity(session);
    if (!qqId) return '请在 QQ 中使用此命令。';
    const parsed = parseMapQuery(raw);
    if (!parsed.valid) return '用法：mysk map 或 mysk map site <5|6|7|8>';
    const [record] = await ctx.database.get('mysekai_binding', { qqId });
    if (!record) return '尚未绑定，请使用 mysk bind <游戏ID>。';
    if (queryBusy) return '正在处理地图查询，请稍后重试。';
    const remaining = config.queryCooldownSeconds * 1000 - (Date.now() - (lastQueries.get(qqId) || 0));
    if (remaining > 0) return `查询冷却中，请 ${Math.ceil(remaining / 1000)} 秒后重试。`;
    queryBusy = true;
    lastQueries.set(qqId, Date.now());
    try {
      const url = new URL('/api/plugin/mysekai/map', config.backendBaseUrl);
      url.searchParams.set('mysekai_user_id', record.gameId);
      url.searchParams.set('requester_qq', qqId);
      if (parsed.siteId) url.searchParams.set('site_id', parsed.siteId);
      const result = await ctx.http.get(url.toString(), {
        headers: config.backendApiKey ? { 'X-API-Key': config.backendApiKey } : {},
        timeout: config.requestTimeoutSeconds * 1000,
      });
      if (!result?.ok) return '地图查询失败：接收器未返回可用结果。';
      const images = result.data?.images;
      if (!Array.isArray(images) || !images.length || images.length > 4) return '地图查询失败：没有可用图片。';
      if (parsed.siteId && result.data.text) await session.send(result.data.text);
      for (const image of images) {
        const buffer = await ctx.http.get(internalImageUrl(image, config.backendBaseUrl), {
          responseType: 'arraybuffer', timeout: config.requestTimeoutSeconds * 1000,
          maxContentLength: 8 * 1024 * 1024,
        });
        await session.send(h.image(Buffer.from(buffer), 'image/png'));
      }
    } catch (error) {
      logger.warn('Map query failed (%s)', error.name);
      return '地图查询失败，请确认已上传完整 Mysekai 数据，或稍后重试。';
    } finally {
      queryBusy = false;
    }
  });
  ctx.setInterval(() => {
    for (const [id, timestamp] of lastQueries) {
      if (Date.now() - timestamp > config.queryCooldownSeconds * 1000) lastQueries.delete(id);
    }
  }, 60_000);
};
