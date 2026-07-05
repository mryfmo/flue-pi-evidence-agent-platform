/** OpenTelemetry file exporter used by release-gated local validation. */
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type {
  ReadableSpan,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
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

class WarningSpanExporter implements SpanExporter {
  private warned = false;

  constructor(private readonly exporter: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number }) => void,
  ): void {
    let completed = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (failed: boolean) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timer);
      if (failed) {
        this.warnOnce();
      }
      resultCallback({ code: 0 });
    };
    timer = setTimeout(() => finish(true), 1_000);
    timer.unref();
    try {
      this.exporter.export(spans, (result) => finish(result.code !== 0));
    } catch {
      finish(true);
    }
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown();
  }

  private warnOnce(): void {
    if (!this.warned) {
      this.warned = true;
      console.warn('OTLP trace export failed; dropping spans.');
    }
  }
}

let registered = false;

export function configureTelemetry(tracePath: string): string {
  if (!registered) {
    const spanProcessors: SpanProcessor[] = [
      new SimpleSpanProcessor(new JsonlSpanExporter(tracePath)),
    ];
    const otlpEndpoint = process.env.EAP_OTLP_ENDPOINT?.trim();
    if (otlpEndpoint) {
      spanProcessors.push(
        new BatchSpanProcessor(
          new WarningSpanExporter(
            new OTLPTraceExporter({ url: otlpEndpoint }) as SpanExporter,
          ),
          { maxExportBatchSize: 1, maxQueueSize: 64, scheduledDelayMillis: 10 },
        ),
      );
    }
    const provider = new NodeTracerProvider({
      spanProcessors,
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
