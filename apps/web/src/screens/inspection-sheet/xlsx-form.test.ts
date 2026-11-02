import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { InspectionSheet } from '@omf-mes/api-client';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { fillSheetWorkbook } from './xlsx-form';

const sheet = (overrides: Partial<InspectionSheet> = {}): InspectionSheet => ({
  inspectionSheetId: 9,
  serialNumberId: 3,
  serialNo: 'SN-0001',
  itemId: 5,
  itemCode: 'AAR4',
  itemName: 'FS-539',
  lotId: 40,
  lotNo: 'PL-001',
  workOrderId: 70,
  workOrderNo: 'WO-070',
  inspectionSheetTemplateId: 11,
  templateVersion: 1,
  formLayoutCode: 'OP',
  statusCode: 'IN_PROGRESS',
  modelText: 'AAR4',
  specText: 'WY5',
  destinationText: null,
  pcbLotNo: 'PCB-1',
  sdLotNo: null,
  stapleLotNo: null,
  fwProductionVersion: '1.02',
  fwQualityVersion: null,
  materialText: null,
  structureText: null,
  rohsFlag: true,
  productNameText: null,
  powerText: null,
  motorText: null,
  tempPackNote: null,
  overallResultCode: null,
  lotCandidates: { pcb: [], sd: [], staple: [] },
  fourMChanges: [
    {
      lotNo: 'ML-4M',
      itemCode: 'F537',
      itemName: 'PCB ASSY',
      changeTypeCode: 'MATERIAL',
      remarks: '공급처 변경',
    },
  ],
  writtenWorkerNo: 'W-1',
  writtenWorkerName: '작업자',
  createdAt: '2026-10-21T01:00:00Z',
  approvedBy: null,
  approvedByName: null,
  approvedAt: null,
  checkedBy: null,
  checkedByName: null,
  checkedAt: null,
  steps: [
    {
      stepCode: 'PROCESS_1',
      sequenceNo: 1,
      nameKo: '공정검사1',
      nameVi: null,
      signRequired: true,
      result: {
        firstJudgmentCode: 'NG',
        finalJudgmentCode: 'OK',
        sourceCode: 'SHEET',
        inspectedWorkerNo: 'W-1',
        inspectedWorkerName: '작업자',
        inspectedAt: '2026-10-21T02:00:00Z',
        signedBy: null,
        signedByName: null,
        signedAt: null,
      },
      items: [
        {
          inspectionSheetTemplateItemId: 101,
          sequenceNo: 1,
          checkItemCode: 'S 403',
          nameKo: '배선',
          nameVi: null,
          methodCode: 'FULL',
          judgmentCode: 'NG',
        },
      ],
    },
  ],
  ngs: [
    {
      sequenceNo: 1,
      foundDepartmentCode: 'QUALITY',
      foundStepCode: 'PROCESS_1',
      occurrenceProcessText: null,
      standardNo: null,
      checkItemCode: 'S 403',
      ngContent: '배선 정리 불량',
      investigationText: null,
      ngTypeCode: 'WORK',
      repairDepartmentCode: 'PRODUCTION',
      repairWorkerNo: 'W-1',
      repairWorkerName: '작업자',
      repairedAt: null,
      recheckResultCode: 'OK',
      recheckWorkerNo: null,
      recheckWorkerName: null,
      recheckedAt: null,
    },
  ],
  events: [],
  ...overrides,
});

const template = async (name: string): Promise<ArrayBuffer> => {
  const file = await readFile(join(__dirname, 'templates', name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
};

const readBack = async (content: ArrayBuffer) => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(content);
  const ws = book.worksheets[0]!;
  return (address: string): string => {
    const cell = ws.getCell(address);
    return String((cell.isMerged ? cell.master : cell).value ?? '');
  };
};

/* 고객 양식(B-05-101)에 값을 채운 엑셀(사용자 결정 2026-11-02 · #217). */
describe('제품 검사표 엑셀 — 고객 양식 채우기', () => {
  it('OP 양식: 머리 · 바코드 시리얼 · NG · 단계 판정 · 항목을 양식 칸에 채운다', async () => {
    const cell = await readBack(
      await fillSheetWorkbook(new ExcelJS.Workbook(), await template('op-ko.xlsx'), sheet()),
    );

    expect(cell('B2')).toBe('AAR4');
    expect(cell('B3')).toBe('WY5');
    expect(cell('B5')).toBe('*SN-0001*');
    expect(cell('C11')).toBe('PCB-1');
    expect(cell('C13')).toBe('1.02');
    // NG 1 블록 — 발견 부문은 상자에 칠한다.
    expect(cell('B19')).toContain('■ 품질');
    expect(cell('B24')).toBe('배선 정리 불량');
    expect(cell('B36')).toContain('■ 작업');
    // 빈 NG 블록 · 값 없는 칸은 양식의 안내 글(□ 상자 · 빈칸 틀)이 그대로다.
    expect(cell('D36')).toContain('□ 작업');
    expect(cell('D37')).toContain('□ 기술');
    expect(cell('A10')).toContain('구조 : (');
    expect(cell('H39')).toBe('출하검사');
    // 단계 판정 — 1차 NG 뒤 재검 OK.
    expect(cell('H19')).toBe('공정검사1');
    expect(cell('I19')).toContain('■ NG');
    expect(cell('I19')).toContain('→ ■ OK');
    // 항목 칸 — 단계 · 항목 번호 · 이름 · 전수 판정(NG 는 ×).
    expect(cell('N4')).toBe('공정검사1');
    expect(cell('O4')).toBe('S 403');
    expect(cell('P4')).toBe('배선');
    expect(cell('S4')).toBe('×');
  });

  it('PP 양식은 PP 칸 자리에 채운다', async () => {
    const cell = await readBack(
      await fillSheetWorkbook(
        new ExcelJS.Workbook(),
        await template('pp-ko.xlsx'),
        sheet({ formLayoutCode: 'PP' }),
      ),
    );

    expect(cell('B5')).toBe('*SN-0001*');
    expect(cell('G15')).toBe('공정검사1');
    expect(cell('B19')).toBe('배선 정리 불량');
    expect(cell('J4')).toBe('공정검사1');
    expect(cell('K4')).toBe('S 403');
  });
});
