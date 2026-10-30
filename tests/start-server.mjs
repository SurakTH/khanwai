import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'khanwai-e2e-'));
const app = createApp({ dataDirectory: directory });
const port = Number(process.env.TEST_PORT ?? 4187);
app.listen(port, '127.0.0.1', () => console.log(`Test server: http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  app.close(async () => { await rm(directory, { recursive:true, force:true }); process.exit(0); });
});
