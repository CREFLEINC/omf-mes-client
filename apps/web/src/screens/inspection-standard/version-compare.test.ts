import { describe, expect, it } from 'vitest';

import { inspectionItemSpecFixtures, inspectionPlanVersionFixtures } from './fixtures';
import { compareItems, compareSettings, type CompareLabels } from './version-compare';
import { versionToFormValues } from './version-mappers';

const labels: CompareLabels = {
  samplingMethod: (code) => `방식 ${code}`,
  inspectionFrequency: (code) => `주기 ${code}`,
  frequencyIntervalUom: (code) => `단위 ${code}`,
  dataType: (code) => `유형 ${code}`,
  uom: (id) => `단위 ${id}`,
  inspectionMethod: (code) => `방법 ${code}`,
  equipment: (id) => `장비 ${id}`,
};

const [specA, specB] = inspectionItemSpecFixtures;

describe('compareSettings', () => {
  it('칸마다 두 값을 나란히 두고 다른 칸만 바뀜으로 표시한다', () => {
    const base = versionToFormValues(inspectionPlanVersionFixtures[1]!);
    const target = versionToFormValues(inspectionPlanVersionFixtures[0]!);

    const rows = compareSettings(base, target, labels);
    const from = rows.find((row) => row.key === 'effectiveFrom');
    const method = rows.find((row) => row.key === 'samplingMethodCode');

    expect(from).toMatchObject({ base: '2026-07-01', target: '2026-08-01', changed: true });
    expect(method?.changed).toBe(false);
  });

  it('빈 값은 「—」로 낸다', () => {
    const base = versionToFormValues(inspectionPlanVersionFixtures[0]!);
    const rows = compareSettings(base, base, labels);

    expect(rows.find((row) => row.key === 'aqlValue')?.base).toBe('—');
  });
});

describe('compareItems', () => {
  it('항목코드로 짝지어 추가 · 삭제 · 변경 · 같음을 가른다', () => {
    const changedA = { ...specA!, targetValue: 12, requiredFlag: false };
    const added = { ...specB!, inspectionItemCode: 'SYN-NEW', inspectionItemName: '새 항목' };

    const rows = compareItems([specA!, specB!], [changedA, added], labels);

    expect(rows.map((row) => [row.code, row.status])).toEqual([
      [specA!.inspectionItemCode, 'changed'],
      ['SYN-NEW', 'added'],
      [specB!.inspectionItemCode, 'removed'],
    ]);
    expect(rows[0]?.changes).toEqual(['기준값: 10 → 12', '필수 검사 항목 여부: 예 → 아니요']);
  });

  it('순서만 달라도 같은 항목은 같음이다', () => {
    const rows = compareItems([specA!, specB!], [{ ...specB!, sequenceNo: 5 }, specA!], labels);

    expect(rows.every((row) => row.status === 'same')).toBe(true);
  });
});
