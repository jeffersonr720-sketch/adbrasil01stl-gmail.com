import { Member, Ministry, Schedule } from '../types';

export interface RoleDraftItem {
  id: string;
  originalName: string | null;
  name: string;
}

export function normalizeRoleName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateRoleName(
  name: string,
  existingRoles: string[],
  ignoreIndex?: number
): string | null {
  const normalized = normalizeRoleName(name);
  if (normalized.length < 2) {
    return 'Informe o nome do posto ou função (mínimo 2 caracteres).';
  }
  const lower = normalized.toLowerCase();
  const isDuplicate = existingRoles.some((role, idx) => {
    if (ignoreIndex !== undefined && idx === ignoreIndex) return false;
    return normalizeRoleName(role).toLowerCase() === lower;
  });
  if (isDuplicate) {
    return `O posto "${normalized}" já existe neste departamento.`;
  }
  return null;
}

export function createRoleDraftsFromLocais(locais: string[]): RoleDraftItem[] {
  return locais.map((local, idx) => ({
    id: `role-${idx}-${local}`,
    originalName: local,
    name: local
  }));
}

export function validateRoleDrafts(drafts: RoleDraftItem[]): string | null {
  const cleanNames: string[] = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const normalized = normalizeRoleName(drafts[i].name);
    if (normalized.length < 2) {
      return `Preencha um nome válido para o posto #${i + 1} (mínimo 2 caracteres).`;
    }
    const duplicate = cleanNames.some((n) => n.toLowerCase() === normalized.toLowerCase());
    if (duplicate) {
      return `O posto "${normalized}" está duplicado.`;
    }
    cleanNames.push(normalized);
  }
  if (cleanNames.length === 0) {
    return 'Adicione pelo menos um posto ou função para este departamento.';
  }
  return null;
}

export function applyMinistryRoleChanges(params: {
  ministry: Ministry;
  drafts: RoleDraftItem[];
  members: Member[];
  schedules: Schedule[];
}): {
  updatedMinistry: Ministry;
  updatedMembers: Member[];
  updatedSchedules: Schedule[];
  renames: Array<{ from: string; to: string }>;
  removed: string[];
} {
  const { ministry, drafts, members, schedules } = params;

  const nextLocais: string[] = [];
  const seen = new Set<string>();
  const renameMap = new Map<string, string>();
  const renames: Array<{ from: string; to: string }> = [];

  for (const draft of drafts) {
    const clean = normalizeRoleName(draft.name);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      nextLocais.push(clean);
    }
    if (draft.originalName && draft.originalName !== clean) {
      renameMap.set(draft.originalName, clean);
      renames.push({ from: draft.originalName, to: clean });
    }
  }

  const nextLowerSet = new Set(nextLocais.map((l) => l.toLowerCase()));
  const removed = ministry.locais.filter(
    (orig) => !renameMap.has(orig) && !nextLowerSet.has(normalizeRoleName(orig).toLowerCase())
  );
  const removedSet = new Set(removed);

  const updatedMinistry: Ministry = {
    ...ministry,
    locais: nextLocais
  };

  const updatedMembers: Member[] = members.map((member) => {
    if (member.ministryId !== ministry.id) return member;
    const mappedLocais: string[] = [];
    const memberSeen = new Set<string>();

    for (const loc of member.locais) {
      if (removedSet.has(loc)) continue;
      const nextName = renameMap.get(loc) ?? loc;
      const lowerKey = nextName.toLowerCase();
      if (!memberSeen.has(lowerKey)) {
        memberSeen.add(lowerKey);
        mappedLocais.push(nextName);
      }
    }

    return {
      ...member,
      locais: mappedLocais
    };
  });

  const updatedSchedules: Schedule[] =
    renameMap.size === 0
      ? schedules
      : schedules.map((sch) => {
          const deptAssignments = sch.assignments[ministry.id];
          if (!deptAssignments || deptAssignments.length === 0) return sch;
          let changed = false;
          const nextAssignments = deptAssignments.map((as) => {
            const renamed = renameMap.get(as.local);
            if (!renamed) return as;
            changed = true;
            return { ...as, local: renamed };
          });
          if (!changed) return sch;
          return {
            ...sch,
            assignments: {
              ...sch.assignments,
              [ministry.id]: nextAssignments
            }
          };
        });

  return {
    updatedMinistry,
    updatedMembers,
    updatedSchedules,
    renames,
    removed
  };
}

export function addQuickMinistryRole(
  ministry: Ministry,
  roleName: string
): { updatedMinistry?: Ministry; normalizedName?: string; error?: string } {
  const normalizedName = normalizeRoleName(roleName);
  const error = validateRoleName(normalizedName, ministry.locais);
  if (error) {
    return { error };
  }
  return {
    normalizedName,
    updatedMinistry: {
      ...ministry,
      locais: [...ministry.locais, normalizedName]
    }
  };
}
