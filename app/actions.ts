'use server';

/**
 * EXAMPLE CODE — replace or remove before building a real app. See AGENTS.md.
 */
import { getTBContext, TBClient, getCredentialsForAccount } from '@/lib/teambridge';
import type { Field } from '@/lib/teambridge/client/types';

export async function createShift(formData: FormData) {
  const startTime = formData.get('startTime') as string | null;
  const endTime = formData.get('endTime') as string | null;
  const assignee = (formData.get('assignee') as string | null)?.trim() || null;
  if (!startTime || !endTime) {
    return { error: 'Start time and end time are required.' };
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return { error: 'End time must be after start time.' };
  }

  const { userContext } = await getTBContext();
  const credentials = getCredentialsForAccount();

  if (!credentials) {
    return { error: 'No credentials found for this account.' };
  }

  try {
    const client = new TBClient({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      baseUrl: process.env.TB_OPEN_API_BASE_URL!,
      authUrl: process.env.TB_AUTH_URL!,
      audience: process.env.TB_AUDIENCE!,
      userContext,
    });

    // Find the shifts collection
    const collections = await client.collections.list();
    const shiftsCollection = collections.find(
      (c) => c.name.toLowerCase() === 'shifts'
    );

    if (!shiftsCollection) {
      return { error: 'No Shifts collection found. Create one in Teambridge first.' };
    }

    // Get field definitions to map names to IDs
    const fields: Field[] = await client.collections.getFields(shiftsCollection.id);
    const startField = fields.find((f) => f.name === 'Start Time');
    const endField = fields.find((f) => f.name === 'End Time');
    const assigneeField = fields.find((f) => f.name === 'Assignee');

    if (!startField || !endField) {
      return { error: 'Shifts collection is missing Start Time or End Time fields.' };
    }

    // Build the record data using field IDs
    const recordData: Record<string, unknown> = {
      [startField.id]: new Date(startTime).toISOString(),
      [endField.id]: new Date(endTime).toISOString(),
    };
    if (assignee && assigneeField) {
      recordData[assigneeField.id] = assignee;
    }

    await client.collections.records.create(shiftsCollection.id, recordData);

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create shift.' };
  }
}
