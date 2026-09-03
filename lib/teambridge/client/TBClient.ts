import type {
  TBClientConfig,
  TokenResponse,
  PaginationOptions,
  PaginatedResponse,
  Collection,
  Field,
  DataRecord,
  Timezone,
  Document,
  DocumentUploadOptions,
} from './types';

const DEFAULT_BASE_URL = 'https://open-api.teambridge.com';
const DEFAULT_AUTH_URL = 'https://teambridge.us.auth0.com/oauth/token';
const DEFAULT_AUDIENCE = 'https://api.teambridge.com/openapi/';

/**
 * Teambridge API client for making authenticated requests to the Teambridge API.
 *
 * Uses OAuth2 Client Credentials flow to obtain access tokens from Auth0.
 *
 * @example
 * ```ts
 * const client = new TBClient({
 *   clientId: process.env.TB_CLIENT_ID!,
 *   clientSecret: process.env.TB_CLIENT_SECRET!,
 * });
 *
 * // List collections and fetch records
 * const collections = await client.collections.list();
 * const records = await client.collections.records.list(collectionId, { page: 0, pageSize: 50 });
 * ```
 */
export class TBClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly authUrl: string;
  private readonly audience: string;
  private readonly userContext: string | undefined;

  // Token cache
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: TBClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.authUrl = config.authUrl || DEFAULT_AUTH_URL;
    this.audience = config.audience || DEFAULT_AUDIENCE;
    this.userContext = config.userContext;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    // Request new token using client credentials flow
    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to obtain access token: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const tokenResponse: TokenResponse = await response.json();

    // Cache the token
    this.accessToken = tokenResponse.access_token;
    this.tokenExpiresAt = Date.now() + tokenResponse.expires_in * 1000;

    return this.accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    }
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = new URL(path, this.baseUrl);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (this.userContext) {
      requestHeaders['X-User-Context'] = this.userContext;
    }

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Teambridge API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = await response.json();
    // API wraps responses in a `data` object
    return json.data as T;
  }

  private paginationParams(options?: PaginationOptions) {
    return {
      page: options?.page,
      size: options?.pageSize, // API uses 'size', we accept 'pageSize' for ergonomics
    };
  }

  /**
   * Normalize API records response to DataRecord[].
   * Handles: { metadata: { recordId }, data: { [fieldId]: value } }[]
   * or column-oriented: { [fieldId]: values[] } or record-oriented: { [recordId]: { [fieldId]: value } }.
   */
  private normalizeRecordsData(
    data: unknown
  ): Array<Record<string, unknown> & { id: string }> {
    if (Array.isArray(data)) {
      return data.map((item: unknown) => {
        const record = item as { metadata?: { recordId?: string }; data?: Record<string, unknown> };
        if (record?.metadata?.recordId != null && record?.data && typeof record.data === 'object') {
          return {
            id: record.metadata.recordId,
            ...record.data,
          } as Record<string, unknown> & { id: string };
        }
        return item as Record<string, unknown> & { id: string };
      });
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const entries = Object.entries(obj);

      // Column-oriented: { [fieldId]: [v1, v2, ...] } - first array determines length
      const firstArray = entries.find(([, v]) => Array.isArray(v))?.[1] as unknown[] | undefined;
      if (firstArray) {
        const fieldIds = entries.map(([k]) => k);
        return firstArray.map((_, i) => {
          const record: Record<string, unknown> = {};
          for (const fieldId of fieldIds) {
            const vals = obj[fieldId];
            record[fieldId] = Array.isArray(vals) ? vals[i] : vals;
          }
          record.id = (record.id ?? record.Id ?? record.recordId ?? String(i)) as string;
          return record as Record<string, unknown> & { id: string };
        });
      }

      // Record-oriented: { [recordId]: { [fieldId]: value } }
      return entries.map(([id, fields]) => ({
        id,
        ...(typeof fields === 'object' && fields && !Array.isArray(fields)
          ? (fields as Record<string, unknown>)
          : {}),
      })) as Array<Record<string, unknown> & { id: string }>;
    }

    return [];
  }

  /**
   * Collections API - access custom data tables
   */
  collections = {
    /**
     * List all collections in the account
     */
    list: async (): Promise<Collection[]> => {
      const response = await this.request<Collection[] | { collections?: Collection[]; items?: Collection[] }>(
        'GET',
        '/v1/collections'
      );
      if (Array.isArray(response)) return response;
      return response.collections ?? response.items ?? [];
    },

    /**
     * Get field definitions for a collection
     */
    getFields: async (collectionId: string): Promise<Field[]> => {
      const response = await this.request<Field[] | { fields?: Field[]; items?: Field[] }>(
        'GET',
        `/v1/collections/${collectionId}/fields`
      );
      if (Array.isArray(response)) return response;
      return response.fields ?? response.items ?? [];
    },

    /**
     * Record operations within a collection
     */
    records: {
      /**
       * List records in a collection
       */
      list: async (
        collectionId: string,
        options?: PaginationOptions
      ): Promise<PaginatedResponse<DataRecord>> => {
        const response = await this.request<{
          data?: unknown;
          page?: number;
          size?: number;
          totalCount?: number;
        }>('GET', `/v1/collections/${collectionId}/records`, {
          params: this.paginationParams(options),
        });
        const data = this.normalizeRecordsData(response.data ?? response);
        return {
          data: data as DataRecord[],
          page: response.page ?? 0,
          size: response.size ?? data.length,
          totalCount: response.totalCount ?? data.length,
        };
      },

      /**
       * Get a specific record
       */
      get: async (
        collectionId: string,
        recordId: string
      ): Promise<DataRecord> => {
        const response = await this.request<Record<string, unknown>>(
          'GET',
          `/v1/collections/${collectionId}/records/${recordId}`
        );
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
          return response as unknown as DataRecord;
        }
        // Normalize { metadata: { recordId }, data: { [fieldId]: value } } to flat { id, ...data }
        const normalized = this.normalizeRecordsData([response]);
        const record = normalized[0];
        if (record) {
          return { ...record, id: record.id ?? recordId } as DataRecord;
        }
        return { ...response, id: (response.id as string) ?? recordId } as DataRecord;
      },

      /**
       * Create a new record.
       * Body must be a map of field UUIDs to values (use /fields to discover IDs and writeFormatHint).
       * API docs: https://docs.teambridge.com/#tag/Collections-(Unified-API)
       */
      create: async (
        collectionId: string,
        data: Record<string, unknown>
      ): Promise<{ id: string }> => {
        const response = await this.request<string | { id?: string }>(
          'POST',
          `/v1/collections/${collectionId}/records`,
          { body: { data } }
        );
        if (typeof response === 'object' && response?.id) {
          return { id: response.id };
        }
        const idMatch = typeof response === 'string' && response.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return { id: idMatch ? idMatch[0] : '' };
      },

      /**
       * Update an existing record
       * Body should contain only fields to update, keyed by field UUID.
       */
      update: async (
        collectionId: string,
        recordId: string,
        data: Record<string, unknown>
      ): Promise<DataRecord> => {
        const response = await this.request<Record<string, unknown>>(
          'PUT',
          `/v1/collections/${collectionId}/records/${recordId}`,
          { body: { data } }
        );
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
          return response as unknown as DataRecord;
        }
        return { ...response, id: (response.id as string) ?? recordId } as DataRecord;
      },
    },
  };

  /**
   * Timezones API
   */
  timezones = {
    /**
     * List available timezones
     */
    list: (): Promise<Timezone[]> => {
      return this.request<Timezone[]>('GET', '/v1/timezones');
    },
  };

  /**
   * Documents API
   */
  documents = {
    /**
     * Upload a document
     */
    upload: async (
      file: File,
      options?: DocumentUploadOptions
    ): Promise<Document> => {
      const accessToken = await this.getAccessToken();
      const formData = new FormData();
      formData.append('file', file);
      if (options?.roles) {
        formData.append('roles', JSON.stringify(options.roles));
      }

      const response = await fetch(`${this.baseUrl}/v1/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Teambridge API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return response.json();
    },
  };
}
