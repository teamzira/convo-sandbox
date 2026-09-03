/**
 * The policy behind every ranking on the coverage board.
 *
 * Read-only on purpose: these subpolicies are authored in Teambridge's Policy
 * Builder, where each one is written as a prompt and evaluated server-side.
 * The app's job is to show which rules are in force and what they did to a
 * given candidate — not to hold a second copy of the rules.
 */
import { InfoIcon, LockIcon, ScaleIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/coverage/page-header';
import { COVERAGE_POLICY } from '@/lib/sandbox/policy';
import type { Severity, SubPolicy } from '@/lib/sandbox/types';

const SEVERITY_CLASS: Record<Severity, string> = {
  BLOCK: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  AVOID: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200',
  FLAG: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  OPTIMIZE: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
};

export default function PoliciesPage() {
  const blocking = COVERAGE_POLICY.subpolicies.filter((s) => s.flag === 'BLOCK');
  const ranking = COVERAGE_POLICY.subpolicies.filter((s) => s.flag === 'WARN');

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Policies"
        description="The rules applied to every open shift before an offer goes out"
        active="/policies"
      />

      <Alert>
        <InfoIcon />
        <AlertTitle>Authored in Policy Builder, applied by the engine</AlertTitle>
        <AlertDescription>
          <p>
            {COVERAGE_POLICY.name} is a matching policy from{' '}
            <span className="font-medium">{COVERAGE_POLICY.primaryCollection}</span> to{' '}
            <span className="font-medium">{COVERAGE_POLICY.secondaryCollection}</span>. Each
            subpolicy is written as a plain-language rule, evaluated server-side against every
            interpreter, and returned with a pass/fail and a reason. Changing a rule is a Policy
            Builder edit — no engineering work and no change to this app.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PolicySection
          title="Blocking rules"
          icon={<LockIcon className="size-4 text-muted-foreground" />}
          description="A failure here removes the interpreter from the pool. These are the legal and contractual limits that must never be crossed."
          subpolicies={blocking}
        />
        <PolicySection
          title="Ranking rules"
          icon={<ScaleIcon className="size-4 text-muted-foreground" />}
          description="Failures do not exclude anyone — they decide the order offers go out in. The share of these an interpreter passes is their match percentage."
          subpolicies={ranking}
        />
      </div>
    </main>
  );
}

function PolicySection({
  title,
  icon,
  description,
  subpolicies,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  subpolicies: SubPolicy[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <span className="font-normal text-muted-foreground">({subpolicies.length})</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {subpolicies.map((subpolicy) => (
          <div key={subpolicy.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{subpolicy.name}</span>
              <Badge
                variant="secondary"
                className={`font-medium ${SEVERITY_CLASS[subpolicy.severity]}`}
              >
                {subpolicy.severity}
              </Badge>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {subpolicy.source}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{subpolicy.description}</p>
            <p className="rounded-sm bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {subpolicy.prompt}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
