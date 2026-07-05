/** Flue application entrypoint with OpenTelemetry observer registration. */
import { createOpenTelemetryObserver } from '@flue/opentelemetry';
import { observe } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

observe(createOpenTelemetryObserver());

const app = new Hono();
app.get('/health', (c) => c.json({ ok: true }));
app.route('/', flue());

export default app;
