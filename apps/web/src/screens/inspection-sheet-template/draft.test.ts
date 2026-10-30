import { describe, expect, it } from 'vitest';

import {
  composeStructure,
  emptyDraft,
  layoutSteps,
  parseStructure,
  toBody,
  validateDraft,
} from './draft';

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
        : { ...step, enabled: false },
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

  it('새 기준은 공정검사1을 켜고 재료 기본 글을 채운 채로 시작한다(사용자 지시 2026-10-30)', () => {
    const draft = emptyDraft(2);
    expect(draft.materialText).toBe(
      '프레임 및 기타 금속 부품은 통상 상태에서 위험하지 않은 재료를 사용하고 방청 처리함',
    );
    expect(draft.steps.filter((step) => step.enabled).map((step) => step.stepCode)).toEqual([
      'PROCESS_1',
    ]);
  });

  it('모델·단계·항목 번호·항목 이름이 비면 칸 오류를 낸다', () => {
    const draft = emptyDraft(2);
    expect(
      validateDraft({ ...draft, steps: draft.steps.map((step) => ({ ...step, enabled: false })) }),
    ).toMatchObject({
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

describe('구조 및 중량 칸 (사용자 지시 2026-10-30)', () => {
  it('W · D · H · 중량을 한 글로 합치고 다시 칸으로 푼다', () => {
    const text = composeStructure({ w: '300', d: '200', h: '150', weight: '2.3' });
    expect(text).toBe('W 300 × D 200 × H 150 mm / 2.3 kg');
    expect(parseStructure(text)).toEqual({ w: '300', d: '200', h: '150', weight: '2.3' });
    expect(composeStructure({ w: '', d: '', h: '', weight: '1.5' })).toBe('1.5 kg');
    expect(parseStructure('1.5 kg')).toEqual({ w: '', d: '', h: '', weight: '1.5' });
    expect(parseStructure('')).toEqual({ w: '', d: '', h: '', weight: '' });
  });

  it('예전에 손으로 쓴 글은 칸으로 풀지 않는다', () => {
    expect(parseStructure('강판 1.2t, 약 3kg')).toBeNull();
  });
});
