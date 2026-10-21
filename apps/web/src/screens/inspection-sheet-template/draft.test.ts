import { describe, expect, it } from 'vitest';

import { emptyDraft, layoutSteps, toBody, validateDraft } from './draft';

describe('검사표 기준 입력 모양', () => {
  it('양식의 단계를 모두 줄로 두고 꺼 둔다 — 서명은 기본으로 켜고, 이름은 두 언어로 채운다', () => {
    const op = layoutSteps('OP');

    expect(op.map((step) => step.stepCode)).toEqual([
      'PROCESS_1',
      'PROCESS_2',
      'PROCESS_3',
      'PROCESS_4',
      'PROCESS_5',
      'SHIPMENT',
      'CROSS_CHECK',
    ]);
    expect(op.every((step) => !step.enabled && step.signRequired)).toBe(true);
    expect(op[0]).toMatchObject({ nameKo: '공정검사1', nameVi: 'Kiểm tra 1' });
    expect(layoutSteps('PP').map((step) => step.stepCode)).toContain('SAMPLING');
  });

  it('양식을 바꿔도 이미 적은 단계는 남긴다', () => {
    const kept = layoutSteps('OP').map((step) =>
      step.stepCode === 'PROCESS_1' ? { ...step, enabled: true, nameKo: '조립 검사' } : step,
    );

    expect(layoutSteps('PP', kept)[0]).toMatchObject({ enabled: true, nameKo: '조립 검사' });
  });

  it('보낼 때는 켠 단계만 양식 순서로 싣고, OP 양식이면 PP 전용 칸을 비운다', () => {
    const draft = emptyDraft(2);
    draft.itemId = 5;
    draft.productNameText = 'FS-532';
    draft.steps = draft.steps.map((step) =>
      step.stepCode === 'SHIPMENT'
        ? {
            ...step,
            enabled: true,
            items: [
              {
                key: 'a',
                checkItemCode: ' S 403 ',
                nameKo: '배선',
                nameVi: '',
                methodCode: 'SAMPLE',
              },
            ],
          }
        : step,
    );

    const body = toBody(draft);

    expect(body.productNameText).toBeNull();
    expect(body.steps).toEqual([
      {
        stepCode: 'SHIPMENT',
        nameKo: '출하검사',
        nameVi: 'Kiểm tra xuất hàng',
        signRequired: true,
        items: [{ checkItemCode: 'S 403', nameKo: '배선', nameVi: null, methodCode: 'SAMPLE' }],
      },
    ]);
  });

  it('모델·단계·항목 번호·항목 이름이 비면 칸 오류를 낸다', () => {
    const draft = emptyDraft(2);
    expect(validateDraft(draft)).toMatchObject({
      item: expect.any(String),
      steps: expect.any(String),
    });

    draft.itemId = 5;
    draft.steps = draft.steps.map((step) =>
      step.stepCode === 'PROCESS_1'
        ? {
            ...step,
            enabled: true,
            nameKo: ' ',
            items: [{ key: 'k1', checkItemCode: '', nameKo: '', nameVi: '', methodCode: 'FULL' }],
          }
        : step,
    );

    expect(Object.keys(validateDraft(draft)).sort()).toEqual([
      'PROCESS_1.name',
      'k1.code',
      'k1.name',
    ]);
  });
});
