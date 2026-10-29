import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { compareItems, compareSettings } from './version-compare';

const base = (overrides: Partial<InspectionSheetTemplate> = {}): InspectionSheetTemplate => ({
  inspectionSheetTemplateId: 1,
  itemId: 5,
  itemCode: 'AAR4',
  itemName: 'OA 본체',
  templateVersion: 1,
  businessUnitId: 8301,
  formLayoutCode: 'OP',
  statusCode: 'CONFIRMED',
  materialText: 'ABS',
  structureText: null,
  rohsFlag: true,
  productNameText: null,
  powerText: null,
  motorText: null,
  remarks: null,
  confirmedBy: 1,
  confirmedAt: '2026-10-29T00:00:00Z',
  lotSources: [],
  steps: [
    {
      stepCode: 'PROCESS_1',
      sequenceNo: 1,
      nameKo: '1공정',
      nameVi: null,
      signRequired: true,
      items: [
        {
          inspectionSheetTemplateItemId: 1,
          sequenceNo: 1,
          checkItemCode: 'A1',
          nameKo: '외관',
          nameVi: null,
          methodCode: 'FULL',
        },
        {
          inspectionSheetTemplateItemId: 2,
          sequenceNo: 2,
          checkItemCode: 'A2',
          nameKo: '치수',
          nameVi: null,
          methodCode: 'FULL',
        },
      ],
    },
  ],
  ...overrides,
});

describe('검사표 기준 버전 비교(#208)', () => {
  it('상단 정보는 바뀐 칸만 changed 다', () => {
    const rows = compareSettings(base(), base({ materialText: 'PC' }));

    expect(rows.find((row) => row.key === 'material')).toMatchObject({
      base: 'ABS',
      target: 'PC',
      changed: true,
    });
    expect(rows.filter((row) => row.changed)).toHaveLength(1);
  });

  it('검사 항목은 단계 · 항목 번호로 짝지어 추가 · 삭제 · 변경 · 같음을 가른다', () => {
    const next = base();
    next.steps![0]!.items = [
      { ...next.steps![0]!.items[0]!, methodCode: 'SAMPLE' },
      {
        inspectionSheetTemplateItemId: 3,
        sequenceNo: 3,
        checkItemCode: 'A3',
        nameKo: '포장',
        nameVi: null,
        methodCode: 'FULL',
      },
    ];

    const rows = compareItems(base(), next);
    const changeOf = (code: string) => rows.find((row) => row.code === code)?.change;

    expect(changeOf('A1')).toBe('changed');
    expect(changeOf('A2')).toBe('removed');
    expect(changeOf('A3')).toBe('added');
  });
});
