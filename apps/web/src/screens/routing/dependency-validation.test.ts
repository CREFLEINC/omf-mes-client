import { describe, expect, it } from 'vitest';

import { createDependencyDraft, validateDependencies } from './dependency-validation';

const label = (id: string): string => `공정${id}`;

const row = (predecessorId: string, successorId: string) =>
  createDependencyDraft({ predecessorId, successorId });

describe('validateDependencies', () => {
  /* 빠진 칸만 짚는다 — 둘 다 비면 한 문장(사용자 지시 · #231). */
  it('빈 칸은 빠진 쪽을 말하고, 둘 다 비면 한 문장으로 말한다', () => {
    const both = row('', '');
    const noSuccessor = row('1', '');
    const errors = validateDependencies([both, noSuccessor], label);

    expect(errors[both.draftId]).toBe('선행·후행 공정을 선택해 주세요.');
    expect(errors[noSuccessor.draftId]).toBe('후행 공정을 선택해 주세요.');
  });

  it('빈 칸·자기 자신·중복을 그 줄에 하나씩 짚는다', () => {
    const empty = row('', '2');
    const self = row('1', '1');
    const first = row('1', '2');
    const duplicate = row('1', '2');

    const errors = validateDependencies([empty, self, first, duplicate], label);

    expect(errors[empty.draftId]).toBe('선행 공정을 선택해 주세요.');
    expect(errors[self.draftId]).toBe(
      '선행과 후행에 같은 공정을 고를 수 없습니다. 다른 공정을 고르세요.',
    );
    expect(errors[first.draftId]).toBeUndefined();
    expect(errors[duplicate.draftId]).toBe(
      '같은 선후행이 이미 있습니다(공정1 → 공정2). 한 줄을 지우세요.',
    );
  });

  it('여러 줄에 걸친 순환은 경로를 보이고 그 경로의 줄만 짚는다', () => {
    const ab = row('1', '2');
    const bc = row('2', '3');
    const ca = row('3', '1');
    const outside = row('3', '4');

    const errors = validateDependencies([ab, bc, outside, ca], label);
    const message =
      '선후행이 순환합니다(공정1 → 공정2 → 공정3 → 공정1). 이 중 한 줄을 지우거나 방향을 바꾸세요.';

    expect(errors[ab.draftId]).toBe(message);
    expect(errors[bc.draftId]).toBe(message);
    expect(errors[ca.draftId]).toBe(message);
    expect(errors[outside.draftId]).toBeUndefined();
  });

  it('갈라졌다 다시 모이는 관계는 순환이 아니다', () => {
    expect(
      validateDependencies([row('1', '2'), row('1', '3'), row('2', '4'), row('3', '4')], label),
    ).toEqual({});
  });
});
