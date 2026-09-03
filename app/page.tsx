/**
 * EXAMPLE CODE — replace the contents of this file before building a real app.
 *
 * This page exists to demonstrate how to read Teambridge data and render
 * it with the design system. It is not a foundation to extend. When you
 * start building, replace this content (along with create-shift-modal.tsx
 * and actions.ts). See AGENTS.md.
 */
import Link from 'next/link';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileEditIcon,
  InboxIcon,
  UserIcon,
} from 'lucide-react';
import { getTBContext, TBClient, getCredentialsForAccount } from '@/lib/teambridge';
import type { Field } from '@/lib/teambridge/client/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CreateShiftModal } from './create-shift-modal';

type FilterStatus = 'all' | 'published' | 'draft';

type ShiftFieldMapping = {
  startAt?: string;
  endAt?: string;
  userId?: string;
  published?: string;
};

const SHIFT_FIELD_NAMES = {
  startAt: 'Start Time',
  endAt: 'End Time',
  userId: 'Assignee',
  published: 'Published',
} as const;

type UserFieldMapping = {
  firstName?: string;
  lastName?: string;
};

function buildUserFieldMapping(fields: Field[]): UserFieldMapping {
  const mapping: UserFieldMapping = {};
  for (const f of fields) {
    if (f.name === 'First Name') mapping.firstName = f.id;
    else if (f.name === 'Last Name') mapping.lastName = f.id;
  }
  return mapping;
}

function extractUserName(record: Record<string, unknown>, mapping: UserFieldMapping): string {
  const first = (mapping.firstName ? record[mapping.firstName] : undefined) as string | undefined;
  const last = (mapping.lastName ? record[mapping.lastName] : undefined) as string | undefined;
  return [first, last].filter(Boolean).join(' ').trim();
}

function buildShiftFieldMapping(fields: Field[]): ShiftFieldMapping {
  const mapping: ShiftFieldMapping = {};
  for (const f of fields) {
    if (f.name === SHIFT_FIELD_NAMES.startAt) mapping.startAt = f.id;
    else if (f.name === SHIFT_FIELD_NAMES.endAt) mapping.endAt = f.id;
    else if (f.name === SHIFT_FIELD_NAMES.userId) mapping.userId = f.id;
    else if (f.name === SHIFT_FIELD_NAMES.published) mapping.published = f.id;
  }
  return mapping;
}

function mapRecordToShift(
  record: Record<string, unknown> & { id: string },
  mapping: ShiftFieldMapping,
): { id: string; userId: string | null; startAt?: string; endAt?: string; published: boolean } {
  const rawPublished = mapping.published ? record[mapping.published] : undefined;
  let published = false;
  if (typeof rawPublished === 'boolean') {
    published = rawPublished;
  } else if (typeof rawPublished === 'string') {
    published = /published|active|live|yes|true/i.test(rawPublished);
  }
  return {
    id: record.id,
    userId: ((mapping.userId ? record[mapping.userId] : undefined) as string | null | undefined) ?? null,
    startAt: mapping.startAt ? String(record[mapping.startAt] ?? '') : undefined,
    endAt: mapping.endAt ? String(record[mapping.endAt] ?? '') : undefined,
    published,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { accountId, user, userContext } = await getTBContext();
  const params = await searchParams;
  const currentFilter = (params.status as FilterStatus) || 'all';

  type ShiftsResponse = Awaited<ReturnType<TBClient['collections']['records']['list']>>;
  let shiftsResponse: ShiftsResponse | null = null;
  let error: string | null = null;

  const credentials = getCredentialsForAccount();

  const userNames: Record<string, string> = {};
  const usersList: { id: string; name: string }[] = [];
  let shiftFieldMapping: ShiftFieldMapping = {};

  if (credentials) {
    try {
      const client = new TBClient({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseUrl: process.env.TB_OPEN_API_BASE_URL!,
        authUrl: process.env.TB_AUTH_URL!,
        audience: process.env.TB_AUDIENCE!,
        userContext,
      });

      const collections = await client.collections.list();
      const shiftsCollection = collections.find((c) => c.name.toLowerCase() === 'shifts');
      if (!shiftsCollection) {
        throw new Error(
          'No custom Shifts collection found. Create a custom collection (not the built-in shifts) in Teambridge to use with this app.',
        );
      }

      const [fieldsResponse, recordsResponse] = await Promise.all([
        client.collections.getFields(shiftsCollection.id),
        client.collections.records.list(shiftsCollection.id, { page: 0, pageSize: 50 }),
      ]);
      shiftFieldMapping = buildShiftFieldMapping(fieldsResponse);
      shiftsResponse = recordsResponse;

      const usersCollection = collections.find((c) => c.name.toLowerCase() === 'users');
      if (usersCollection) {
        const userFields = await client.collections.getFields(usersCollection.id);
        const userFieldMapping = buildUserFieldMapping(userFields);
        const usersResponse = await client.collections.records.list(usersCollection.id, { page: 0, pageSize: 50 });
        for (const r of usersResponse.data) {
          const record = r as Record<string, unknown> & { id: string };
          const name = extractUserName(record, userFieldMapping);
          if (name) {
            usersList.push({ id: record.id, name });
            userNames[record.id] = name;
          }
        }
        usersList.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch shifts';
    }
  }

  const rawRecords = shiftsResponse?.data ?? [];
  type MappedShift = ReturnType<typeof mapRecordToShift>;
  const allShifts: MappedShift[] = rawRecords.map((r) =>
    mapRecordToShift(r as Record<string, unknown> & { id: string }, shiftFieldMapping),
  );
  const publishedShifts = allShifts.filter((s) => s.published);
  const draftShifts = allShifts.filter((s) => !s.published);
  const totalCount = allShifts.length;
  const publishedCount = publishedShifts.length;
  const draftCount = draftShifts.length;

  const filteredShifts =
    currentFilter === 'published'
      ? publishedShifts
      : currentFilter === 'draft'
        ? draftShifts
        : allShifts;

  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen bg-secondary">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-xl font-semibold">
          {greeting}, {firstName}
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CalendarDaysIcon />}
            value={totalCount}
            label="Total Shifts"
            tone="warning"
          />
          <StatCard
            icon={<CheckCircle2Icon />}
            value={publishedCount}
            label="Published"
            tone="success"
          />
          <StatCard
            icon={<FileEditIcon />}
            value={draftCount}
            label="Drafts"
            tone="info"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClockIcon className="size-4 text-muted-foreground" />
              Shifts Overview
            </CardTitle>
            <CreateShiftModal users={usersList} />
          </CardHeader>

          <FilterTabs current={currentFilter} />

          <CardContent>
            {!credentials ? (
              <Alert>
                <AlertTriangleIcon />
                <AlertTitle>Configuration required</AlertTitle>
                <AlertDescription>
                  No credentials found for account{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{accountId}</code>.
                  Set <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">TB_CLIENT_ID</code> and{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">TB_CLIENT_SECRET</code> in your{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code>, or add
                  account-specific credentials.
                </AlertDescription>
              </Alert>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Error loading shifts</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : filteredShifts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <Assignee
                          userId={shift.userId}
                          userName={shift.userId ? userNames[shift.userId] : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        {shift.startAt ? new Date(shift.startAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        {shift.endAt ? new Date(shift.endAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge published={shift.published} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/?rid=${encodeURIComponent(shift.id)}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState filter={currentFilter} />
            )}
          </CardContent>

          {shiftsResponse && shiftsResponse.totalCount > 0 && (
            <CardFooter className="text-xs text-muted-foreground">
              Showing {filteredShifts.length} of {shiftsResponse.totalCount} shifts
              {currentFilter !== 'all' && ` (filtered by ${currentFilter})`}
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserIcon className="size-4 text-muted-foreground" />
              Session Info
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">User</p>
              <p className="mt-1">{user.name || user.email || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account ID</p>
              <p className="mt-1 font-mono">{accountId || 'No account'}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: 'warning' | 'success' | 'info';
}) {
  const toneClasses = {
    warning: 'bg-orange-100 text-orange-600',
    success: 'bg-green-100 text-green-700',
    info: 'bg-blue-100 text-blue-700',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full [&>svg]:size-5',
            toneClasses,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xl font-medium">{value}</p>
          <p className="text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterTabs({ current }: { current: FilterStatus }) {
  return (
    <div className="border-b px-6">
      <div className="-mb-px flex gap-1">
        <FilterTab href="/" label="All" active={current === 'all'} />
        <FilterTab href="/?status=published" label="Published" active={current === 'published'} />
        <FilterTab href="/?status=draft" label="Draft" active={current === 'draft'} />
      </div>
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center border-b-2 px-4 py-3 text-sm transition-colors',
        active
          ? 'border-foreground font-medium text-foreground'
          : 'border-transparent text-slate-800 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function Assignee({ userId, userName }: { userId: string | null; userName?: string }) {
  if (!userId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Avatar className="size-6">
          <AvatarFallback>
            <UserIcon className="size-3.5" />
          </AvatarFallback>
        </Avatar>
        <span className="italic">Unassigned</span>
      </div>
    );
  }

  const initials = userName
    ? userName
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="bg-blue-100 text-xs text-blue-700">
          {initials ?? <UserIcon className="size-3.5" />}
        </AvatarFallback>
      </Avatar>
      <span>{userName || <span className="font-mono text-xs">{userId.slice(0, 8)}…</span>}</span>
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Published</Badge>
  ) : (
    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Draft</Badge>
  );
}

function EmptyState({ filter }: { filter: FilterStatus }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <InboxIcon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {filter === 'all' ? 'No shifts found' : `No ${filter} shifts`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filter === 'all'
          ? 'Create some shifts in Teambridge to see them here'
          : 'Try selecting a different filter'}
      </p>
    </div>
  );
}
