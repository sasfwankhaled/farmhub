/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleDataError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
  console.error(`[DB] ${operationType} on '${path}' failed:`, errMsg);
  throw new Error(errMsg);
}

const toSnakeCase = (input: string) => input.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamelCase = (input: string) => input.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const mapKeysDeep = (value: any, mapper: (k: string) => string): any => {
  if (Array.isArray(value)) return value.map((v) => mapKeysDeep(v, mapper));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([k, v]) => {
      // Robust DB Edge Sanitization:
      // Exclude empty strings for all UUID FK relations or just drop empty strings entirely:
      if (v === '') {
        out[mapper(k)] = null;
      } else if (typeof v === 'number' && isNaN(v)) {
        out[mapper(k)] = null;
      } else {
        out[mapper(k)] = mapKeysDeep(v, mapper);
      }
    });
    return out;
  }
  return value;
};


export const getCollection = async <T>(path: string, columns: string = '*') => {
  try {
    const { data, error } = await supabase.from(path).select(columns);
    if (error) throw error;
    return (data || []).map((row) => mapKeysDeep(row, toCamelCase) as T);
  } catch (error) {
    handleDataError(error, OperationType.LIST, path);
  }
};

export const subscribeToCollection = <T>(
  path: string, 
  callback: (data: T[]) => void, 
  columns: string = '*'
) => {
  let active = true;
  const fetchLatest = async () => {
    try {
      const rows = await getCollection<T>(path, columns);
      if (active && rows) {
        callback(rows);
      }
    } catch (error) {
      handleDataError(error, OperationType.GET, path);
    }
  };

  fetchLatest();
  const channelName = `realtime:${path}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  
  // Debug mode logging
  // eslint-disable-next-line no-console
  console.log(`[DB Ver 2.1] Subscribing to realtime:${path}...`);

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: path }, (payload) => {
      // eslint-disable-next-line no-console
      console.log(`[DB Ver 2.1] Realtime event on '${path}':`, payload.eventType, payload.new);
      fetchLatest();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // eslint-disable-next-line no-console
        console.log(`[DB Ver 2.1] Subscribed to '${path}' successfully.`);
      } else if (status === 'CLOSED') {
        // eslint-disable-next-line no-console
        if (active) {
          console.warn(`[DB Ver 2.1] Subscription for '${path}' was closed unexpectedly.`);
        } else {
          console.log(`[DB Ver 2.1] Subscription for '${path}' closed normally.`);
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[DB Ver 2.1] Subscription error for '${path}': Connection failed or RLS denied.`);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[DB Ver 2.1] Subscription status for '${path}':`, status);
      }
    });

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
};

export const getDocument = async <T>(path: string, id: string, columns: string = '*') => {
  try {
    const { data, error } = await supabase.from(path).select(columns).eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) return mapKeysDeep(data, toCamelCase) as T;
    return null;
  } catch (error) {
    handleDataError(error, OperationType.GET, `${path}/${id}`);
  }
};

export const createDocument = async <T extends object>(path: string, data: T, id?: string) => {
  try {
    const payload = mapKeysDeep(data, toSnakeCase);
    const docId = id || crypto.randomUUID();
    const row = { id: docId, ...payload };
    const { data: inserted, error } = await supabase
      .from(path)
      .upsert(row, { onConflict: 'id' })
      .select('id')
      .single();
    if (error) throw error;
    return inserted.id as string;
  } catch (error) {
    handleDataError(error, OperationType.CREATE, path);
  }
};

export const updateDocument = async <T extends object>(path: string, id: string, data: Partial<T>) => {
  try {
    const payload = mapKeysDeep(data, toSnakeCase);
    const { error } = await supabase.from(path).update(payload).eq('id', id);
    if (error) throw error;
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, `${path}/${id}`);
  }
};

export const deleteDocument = async (path: string, id: string) => {
  try {
    const { error } = await supabase.from(path).delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    handleDataError(error, OperationType.DELETE, `${path}/${id}`);
  }
};

