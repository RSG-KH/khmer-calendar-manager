import { browserStore } from './browser-store.ts';

export const browserMode = import.meta.env.VITE_STORAGE === 'browser';

export async function api(path: string, input?: any) {
  if (browserMode) {
    if (path === 'workspace') return browserStore.read();
    if (path === 'save') return browserStore.save(input.data, input.expected, input.note);
    if (path === 'export') return browserStore.export(input.expected);
    throw new Error('Unknown workspace action');
  }
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, input === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-manager-request': '1' }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed');
  return result;
}
