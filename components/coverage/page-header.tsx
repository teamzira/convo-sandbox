import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SeedDialog } from './seed-dialog';

const TABS = [
  { href: '/', label: 'Coverage' },
  { href: '/policies', label: 'Policies' },
] as const;

export function PageHeader({
  title,
  description,
  active,
  actions,
  showSeedAction,
}: {
  title: string;
  description: string;
  active: (typeof TABS)[number]['href'];
  actions?: React.ReactNode;
  /**
   * Renders the seed dialog here rather than through `actions`. Radix
   * components handed across an RSC prop boundary get a different `useId`
   * tree position on the server than on the client, which hydrates as a
   * mismatched `aria-controls`. Rendering it directly keeps the ids stable.
   */
  showSeedAction?: boolean;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {showSeedAction ? <SeedDialog /> : null}
        </div>
      </div>
      <nav className="border-b">
        <div className="-mb-px flex gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.href === active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center border-b-2 px-3 py-2 text-sm transition-colors',
                tab.href === active
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
