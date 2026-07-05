/** Local OpenAI-compatible gateway used to exercise Flue/Pi without external LLM calls. */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { registerProvider } from '@flue/runtime';

export interface LocalGatewayHandle {
  baseUrl: string;
  close(): Promise<void>;
  requests: unknown[];
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function writeSseChunk(res: ServerResponse, body: unknown): void {
  res.write(`data: ${JSON.stringify(body)}\n\n`);
}

export async function startLocalGateway(
  responseText: string,
): Promise<LocalGatewayHandle> {
  const requests: unknown[] = [];
  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const body = await readJson(req);
        requests.push({ url: req.url, method: req.method, body });
        if (req.url?.includes('/chat/completions')) {
          const bodyRecord = body as { stream?: boolean };
          if (bodyRecord.stream) {
            res.writeHead(200, {
              'content-type': 'text/event-stream',
              'cache-control': 'no-cache',
              connection: 'keep-alive',
            });
            const base = {
              id: 'chatcmpl-local',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'fixbot',
            };
            writeSseChunk(res, {
              ...base,
              choices: [
                { index: 0, delta: { role: 'assistant' }, finish_reason: null },
              ],
            });
            writeSseChunk(res, {
              ...base,
              choices: [
                {
                  index: 0,
                  delta: { content: responseText },
                  finish_reason: null,
                },
              ],
            });
            writeSseChunk(res, {
              ...base,
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            });
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'chatcmpl-local',
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: 'fixbot',
              choices: [
                {
                  index: 0,
                  message: { role: 'assistant', content: responseText },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            }),
          );
          return;
        }
        if (req.url?.includes('/models')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              object: 'list',
              data: [{ id: 'fixbot', object: 'model' }],
            }),
          );
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('gateway did not bind');
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  registerProvider('local-gateway', {
    api: 'openai-completions',
    baseUrl,
    apiKey: 'test-key',
    models: { fixbot: { contextWindow: 16000, maxTokens: 4096 } },
  });
  return {
    baseUrl,
    requests,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
