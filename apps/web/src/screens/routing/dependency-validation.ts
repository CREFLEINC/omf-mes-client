import { messages } from '@omf-mes/i18n';

const t = messages.routing.dependencies;

export const DEFAULT_DEPENDENCY_TYPE = 'FINISH_TO_START';

/** 선후행 한 줄. 선택칸 값이라 공정 식별자를 문자열로 든다 — 빈 문자열은 「아직 고르지 않음」이다. */
export interface DependencyDraft {
  draftId: string;
  predecessorId: string;
  successorId: string;
  typeCode: string;
}

let draftSequence = 0;

export const createDependencyDraft = (
  values: Partial<Omit<DependencyDraft, 'draftId'>> = {},
): DependencyDraft => {
  draftSequence += 1;

  return {
    draftId: `dependency-${String(draftSequence)}`,
    predecessorId: values.predecessorId ?? '',
    successorId: values.successorId ?? '',
    typeCode: values.typeCode ?? DEFAULT_DEPENDENCY_TYPE,
  };
};

export const isSameDependencies = (
  left: readonly DependencyDraft[],
  right: readonly DependencyDraft[],
): boolean =>
  left.length === right.length &&
  left.every((draft, index) => {
    const other = right[index];

    return (
      other !== undefined &&
      draft.predecessorId === other.predecessorId &&
      draft.successorId === other.successorId &&
      draft.typeCode === other.typeCode
    );
  });

/**
 * 순환 하나를 찾아 그 경로(처음 공정으로 되돌아오는 꼴)를 돌려준다. 없으면 null.
 * 서버도 순환을 막지만 어느 줄이 문제인지 말하지 않는다 — 화면이 먼저 줄을 짚는다.
 */
const findCycle = (edges: readonly (readonly [string, string])[]): string[] | null => {
  const next = new Map<string, string[]>();
  for (const [from, to] of edges) {
    next.set(from, [...(next.get(from) ?? []), to]);
  }

  const done = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    const onStack = stack.indexOf(node);
    if (onStack !== -1) return [...stack.slice(onStack), node];
    if (done.has(node)) return null;

    stack.push(node);
    for (const to of next.get(node) ?? []) {
      const cycle = visit(to);
      if (cycle !== null) return cycle;
    }
    stack.pop();
    done.add(node);

    return null;
  };

  for (const node of next.keys()) {
    const cycle = visit(node);
    if (cycle !== null) return cycle;
  }

  return null;
};

/**
 * 줄마다 하나의 문제만 돌려준다(줄 id → 문구). 순환은 다른 문제가 없는 줄들로만 따진다 —
 * 빈 줄·중복이 섞인 채로 경로를 그리면 사용자가 고칠 순서를 잡지 못한다.
 */
export const validateDependencies = (
  drafts: readonly DependencyDraft[],
  operationLabel: (operationId: string) => string,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();

  for (const draft of drafts) {
    if (draft.predecessorId === '' || draft.successorId === '') {
      errors[draft.draftId] = t.validation.required;
      continue;
    }

    if (draft.predecessorId === draft.successorId) {
      errors[draft.draftId] = t.validation.self;
      continue;
    }

    const pair = `${draft.predecessorId}>${draft.successorId}`;
    if (seen.has(pair)) {
      errors[draft.draftId] = t.validation.duplicate(
        operationLabel(draft.predecessorId),
        operationLabel(draft.successorId),
      );
      continue;
    }
    seen.add(pair);
  }

  const valid = drafts.filter((draft) => !(draft.draftId in errors));
  const cycle = findCycle(valid.map((draft) => [draft.predecessorId, draft.successorId] as const));

  if (cycle !== null) {
    const message = t.validation.cycle(cycle.map(operationLabel).join(' → '));

    for (let index = 0; index < cycle.length - 1; index += 1) {
      const from = cycle[index];
      const to = cycle[index + 1];
      const draft = valid.find((row) => row.predecessorId === from && row.successorId === to);
      if (draft !== undefined) errors[draft.draftId] = message;
    }
  }

  return errors;
};
