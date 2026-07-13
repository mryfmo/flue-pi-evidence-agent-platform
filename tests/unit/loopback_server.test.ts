import { createServer, get, type Server } from 'node:http';
import type { AddressInfo, ListenOptions } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenLoopback } from '../helpers/loopback-server.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('listenLoopback', () => {
  it('preserves the original bind error and aborts startup', async () => {
    vi.useFakeTimers();
    const server = createServer();
    const originalListen = server.listen;
    const error = Object.assign(new Error('bind denied'), { code: 'EPERM' });
    const baselineErrorListeners = server.listenerCount('error');
    const baselineListeningListeners = server.listenerCount('listening');
    let options: ListenOptions | undefined;
    let abortedAtListen: boolean | undefined;

    server.listen = ((nextOptions: ListenOptions) => {
      options = nextOptions;
      abortedAtListen = nextOptions.signal?.aborted;
      server.emit('error', error);
      return server;
    }) as Server['listen'];

    let rejectionCount = 0;
    try {
      const started = listenLoopback(server).catch((caught: unknown) => {
        rejectionCount += 1;
        throw caught;
      });

      await expect(started).rejects.toBe(error);
      expect(options).toMatchObject({ host: '127.0.0.1', port: 0 });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(abortedAtListen).toBe(false);
      expect(options?.signal?.aborted).toBe(true);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(rejectionCount).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(server.listenerCount('error')).toBe(baselineErrorListeners);
      expect(server.listenerCount('listening')).toBe(
        baselineListeningListeners,
      );
    } finally {
      server.listen = originalListen;
    }
  });

  it('aborts a pending listen at exactly 2000ms without a late server', async () => {
    vi.useFakeTimers();
    const server = createServer();
    const originalListen = server.listen;
    const observedListening = vi.fn();
    server.on('listening', observedListening);
    const baselineErrorListeners = server.listenerCount('error');
    const baselineListeningListeners = server.listenerCount('listening');
    let options: ListenOptions | undefined;
    let outcome: 'pending' | 'resolved' | 'rejected' = 'pending';
    let rejectionCount = 0;

    server.listen = ((nextOptions: ListenOptions) => {
      options = nextOptions;
      setTimeout(() => {
        if (!nextOptions.signal?.aborted) server.emit('listening');
      }, 3_000);
      return server;
    }) as Server['listen'];

    try {
      const started = listenLoopback(server);
      void started.then(
        () => {
          outcome = 'resolved';
        },
        () => {
          outcome = 'rejected';
          rejectionCount += 1;
        },
      );

      await vi.advanceTimersByTimeAsync(1_999);
      expect(outcome).toBe('pending');
      expect(options?.signal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(started).rejects.toThrow('2000ms');
      expect(outcome).toBe('rejected');
      expect(options?.signal?.aborted).toBe(true);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(observedListening).not.toHaveBeenCalled();
      expect(server.listening).toBe(false);
      expect(rejectionCount).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(server.listenerCount('error')).toBe(baselineErrorListeners);
      expect(server.listenerCount('listening')).toBe(
        baselineListeningListeners,
      );
    } finally {
      server.listen = originalListen;
      server.removeListener('listening', observedListening);
    }
  });

  it('preserves a synchronous listen throw and cleans up', async () => {
    vi.useFakeTimers();
    const server = createServer();
    const originalListen = server.listen;
    const error = new Error('synchronous listen failure');
    const baselineErrorListeners = server.listenerCount('error');
    const baselineListeningListeners = server.listenerCount('listening');
    let options: ListenOptions | undefined;

    server.listen = ((nextOptions: ListenOptions) => {
      options = nextOptions;
      throw error;
    }) as Server['listen'];

    try {
      await expect(listenLoopback(server)).rejects.toBe(error);
      expect(options?.signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      expect(server.listenerCount('error')).toBe(baselineErrorListeners);
      expect(server.listenerCount('listening')).toBe(
        baselineListeningListeners,
      );
    } finally {
      server.listen = originalListen;
    }
  });

  it('preserves an address read error after listening and cleans up', async () => {
    vi.useFakeTimers();
    const server = createServer();
    const originalListen = server.listen;
    const originalAddress = server.address;
    const error = new Error('address read failure');
    const baselineErrorListeners = server.listenerCount('error');
    const baselineListeningListeners = server.listenerCount('listening');
    let options: ListenOptions | undefined;
    let rejectionCount = 0;

    server.address = (() => {
      throw error;
    }) as Server['address'];
    server.listen = ((nextOptions: ListenOptions) => {
      options = nextOptions;
      setTimeout(() => server.emit('listening'), 1);
      return server;
    }) as Server['listen'];

    try {
      const started = listenLoopback(server).catch((caught: unknown) => {
        rejectionCount += 1;
        throw caught;
      });
      const rejected = expect(started).rejects.toBe(error);

      await vi.advanceTimersByTimeAsync(1);
      await rejected;
      expect(options?.signal?.aborted).toBe(true);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(rejectionCount).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(server.listenerCount('error')).toBe(baselineErrorListeners);
      expect(server.listenerCount('listening')).toBe(
        baselineListeningListeners,
      );
    } finally {
      server.listen = originalListen;
      server.address = originalAddress;
    }
  });

  it('serves a real loopback response and closes in finally', async () => {
    const responseBytes = Buffer.from('loopback-ok');
    const server = createServer((_request, response) => {
      response.end(responseBytes);
    });
    const address: AddressInfo = await listenLoopback(server);

    try {
      const body = await new Promise<Buffer>((resolve, reject) => {
        get(
          { host: '127.0.0.1', port: address.port, path: '/' },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.once('end', () => resolve(Buffer.concat(chunks)));
          },
        ).once('error', reject);
      });

      expect(address.address).toBe('127.0.0.1');
      expect(body).toEqual(responseBytes);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    expect(server.listening).toBe(false);
  });
});
