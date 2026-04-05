// EOMA: Startup diagnostics — track where the backend hangs/crashes
process.on('uncaughtException', (err) => { console.error('EOMA: UNCAUGHT EXCEPTION:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('EOMA: UNHANDLED REJECTION:', reason); });
console.log('EOMA: [1/6] main.ts top-level executing...');

import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
try {
  initializeSentry('backend', true);
  console.log('EOMA: [2/6] Sentry initialized (or skipped — no DSN)');
} catch (e: any) {
  console.error('EOMA: Sentry init failed:', e?.message || e);
}

import compression from 'compression';

import { loadSwagger } from '@gitroom/helpers/swagger/load.swagger';
import { json } from 'express';
console.log('EOMA: [3/6] Importing @temporalio/worker...');
import { Runtime } from '@temporalio/worker';
try {
  Runtime.install({ shutdownSignals: [] });
  console.log('EOMA: [4/6] Temporal Runtime installed');
} catch (e: any) {
  console.error('EOMA: Temporal Runtime.install() failed:', e?.message || e);
}

process.env.TZ = 'UTC';

import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { SubscriptionExceptionFilter } from '@gitroom/backend/services/auth/permissions/subscription.exception';
import { HttpExceptionFilter } from '@gitroom/nestjs-libraries/services/exception.filter';
import { ConfigurationChecker } from '@gitroom/helpers/configuration/configuration.checker';
import { startMcp } from '@gitroom/nestjs-libraries/chat/start.mcp';

async function start() {
  console.log('EOMA: [5/6] Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: {
      ...(!process.env.NOT_SECURED ? { credentials: true } : {}),
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'auth',
        'showorg',
        'impersonate',
        'x-copilotkit-runtime-client-gql-version',
        'x-org-id', // EOMA: org context header from proxy
      ],
      exposedHeaders: [
        'reload',
        'onboarding',
        'activate',
        'x-copilotkit-runtime-client-gql-version',
        ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
      ],
      origin: [
        process.env.FRONTEND_URL,
        'http://localhost:6274',
        ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
        // EOMA: allow EOMA backend proxy and frontend redirect origins
        ...(process.env.BACKEND_PROXY_URL ? [process.env.BACKEND_PROXY_URL] : []),
        ...(process.env.FRONTEND_REDIRECT_URL ? [process.env.FRONTEND_REDIRECT_URL] : []),
      ],
    },
  });

  if (process.env.ENABLE_AI === 'true') {
    await startMcp(app);
  } else {
    console.log('AI/MCP features disabled (set ENABLE_AI=true to enable)');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.use(['/copilot/*', '/posts'], (req: any, res: any, next: any) => {
    json({ limit: '50mb' })(req, res, next);
  });

  app.use(cookieParser());
  app.use(compression());
  app.useGlobalFilters(new SubscriptionExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  loadSwagger(app);

  const port = process.env.PORT || 3000;

  try {
    console.log('EOMA: [6/6] Calling app.listen(' + port + ')...');
    await app.listen(port);
    console.log('Backend started successfully on port ' + port);

    checkConfiguration(); // Do this last, so that users will see obvious issues at the end of the startup log without having to scroll up.

    Logger.log(`🚀 Backend is running on: http://localhost:${port}`);
  } catch (e) {
    Logger.error(`Backend failed to start on port ${port}`, e);
  }
}

function checkConfiguration() {
  const checker = new ConfigurationChecker();
  checker.readEnvFromProcess();
  checker.check();

  if (checker.hasIssues()) {
    for (const issue of checker.getIssues()) {
      Logger.warn(issue, 'Configuration issue');
    }

    Logger.warn('Configuration issues found: ' + checker.getIssuesCount());
  } else {
    Logger.log('Configuration check completed without any issues');
  }
}

start();
