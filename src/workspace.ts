import { canonical, normalize, object, publicationIssues, validateCatalog, type Catalog, type Workspace } from './model.ts';

export function validateWorkspace(input: unknown): Workspace {
  const workspace = object(input, 'workspace', ['revision', 'data', 'history']) as Workspace;
  if (!Number.isSafeInteger(workspace.revision) || workspace.revision < 0 || !Array.isArray(workspace.history)) throw new Error('Invalid workspace metadata');
  for (const item of workspace.history) {
    const h = object(item, 'history entry', ['revision', 'at', 'note', 'changes']);
    if (!Number.isSafeInteger(h.revision) || h.revision < 1 || h.revision > workspace.revision || typeof h.at !== 'string' || Number.isNaN(Date.parse(h.at)) || typeof h.note !== 'string' || !Array.isArray(h.changes)) throw new Error('Invalid workspace history');
    for (const input of h.changes) {
      const c = object(input, 'history change', ['section', 'id', 'action']);
      if (typeof c.section !== 'string' || typeof c.id !== 'string' || !['added', 'changed', 'removed'].includes(c.action)) throw new Error('Invalid workspace history change');
    }
  }
  return { ...workspace, data: validateCatalog(workspace.data) };
}

export function exportContent(data: Catalog) {
  const catalog = normalize(validateCatalog(data));
  const issues = publicationIssues(catalog);
  if (issues.length) throw new Error(issues.join('\n'));
  return { filename: `khmer-calendar-data-${catalog.dataVersion}.json`, content: canonical(catalog) + '\n', dataVersion: catalog.dataVersion, schemaVersion: catalog.schemaVersion };
}

export type ExportManifest = { schemaVersion: number; dataVersion: string; engineVersion: string; file: string; sha256: string; bytes: number };
export type ExportBundle = { filename: string; content: string; manifest: ExportManifest };
