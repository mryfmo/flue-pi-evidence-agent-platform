import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export function listenLoopback(server: Server): Promise<AddressInfo> {
  return new Promise<AddressInfo>((resolve, reject) => {
    const controller = new AbortController();
    let state: 'pending' | 'listening' | 'failed' | 'timed_out' = 'pending';
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
    };

    const fail = (nextState: 'failed' | 'timed_out', error: unknown) => {
      if (state !== 'pending') return;
      state = nextState;
      cleanup();
      controller.abort();
      reject(error);
    };

    const onError = (error: Error) => fail('failed', error);
    const onListening = () => {
      if (state !== 'pending') return;
      let address: ReturnType<Server['address']>;
      try {
        address = server.address();
      } catch (error) {
        fail('failed', error);
        return;
      }
      if (
        !address ||
        typeof address === 'string' ||
        address.address !== '127.0.0.1' ||
        !Number.isInteger(address.port) ||
        address.port < 1 ||
        address.port > 65_535
      ) {
        fail('failed', new Error('invalid loopback listen address'));
        return;
      }

      state = 'listening';
      cleanup();
      resolve(address);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    timer = setTimeout(() => {
      fail('timed_out', new Error('loopback listen timed out after 2000ms'));
    }, 2_000);

    try {
      server.listen({
        host: '127.0.0.1',
        port: 0,
        signal: controller.signal,
      });
    } catch (error) {
      fail('failed', error);
    }
  });
}
