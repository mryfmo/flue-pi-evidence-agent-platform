/** OpenTelemetry file exporter used by release-gated local validation. */
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

class JsonlSpanExporter implements SpanExporter {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number }) => void,
  ): void {
    for (const span of spans) {
      appendFileSync(
        this.path,
        `${JSON.stringify({
          name: span.name,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          attributes: span.attributes,
          status: span.status,
        })}\n`,
        'utf8',
      );
    }
    resultCallback({ code: 0 });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

let registered = false;

export function configureTelemetry(tracePath: string): string {
  if (!registered) {
    const provider = new NodeTracerProvider({
      spanProcessors: [
        new SimpleSpanProcessor(new JsonlSpanExporter(tracePath)),
      ],
    });
    provider.register();
    registered = true;
  }
  return tracePath;
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  body: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer('flue-pi-evidence-platform');
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await body();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}
