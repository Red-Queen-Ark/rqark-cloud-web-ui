export const PROJECT_ORDER_CONFIG_KEY = 'project_order';

export function parseProjectOrder(value: unknown): string[] | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const order = (value as Record<string, unknown>).order;
  if (!Array.isArray(order)) {
    return undefined;
  }

  return order.filter((id): id is string => typeof id === 'string' && id !== '');
}

export function toProjectOrderValue(order: readonly string[]): Record<string, unknown> {
  return { order: [...order] };
}

export function orderProjects<T extends { id?: string }>(projects: readonly T[], order: readonly string[]): T[] {
  if (order.length === 0) {
    return [...projects];
  }

  const rank = new Map<string, number>();
  order.forEach((id, index) => {
    if (!rank.has(id)) {
      rank.set(id, index);
    }
  });

  const unranked = Number.MAX_SAFE_INTEGER;

  return projects
    .map((project, index) => ({
      project,
      index,
      rank: project.id === undefined ? unranked : (rank.get(project.id) ?? unranked),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.project);
}

export function movedOrder(projects: readonly { id?: string }[], from: number, to: number): string[] | undefined {
  if (from === to || from < 0 || to < 0 || from >= projects.length || to >= projects.length) {
    return undefined;
  }

  const ids = projects.flatMap((project) => (project.id === undefined ? [] : [project.id]));
  if (ids.length !== projects.length) {
    return undefined;
  }

  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}
