import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4387);
const app = await createApp({ root, dataDirectory: process.env.MANAGER_DATA_DIR ?? resolve(root, 'data'), dev: process.argv.includes('--dev') });
app.server.listen(port, '127.0.0.1', () => console.log(`Khmer Calendar Manager: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
