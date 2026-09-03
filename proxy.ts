import { tbMiddleware } from '@/lib/teambridge/middleware';

export default tbMiddleware({
  webhookSecret: process.env.TB_WEBHOOK_SECRET!,
});

export const config = {
  // Match all routes except:
  // - /api/teambridge/* (lifecycle webhooks handle their own auth)
  // - /_next/* (Next.js internals)
  // - /favicon.ico, etc.
  matcher: ['/((?!api/teambridge|_next|favicon.ico).*)'],
};
