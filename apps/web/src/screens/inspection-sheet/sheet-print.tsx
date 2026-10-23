import type { InspectionSheet } from '@omf-mes/api-client';
import { ko, vi } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  itemColumns,
  itemMark,
  LEFT_ITEM_ROWS,
  ngSlots,
  type PrintItemRow,
  type PrintLang,
  stepJudgment,
} from './print-layout';

const LABELS = { ko: ko.inspectionSheetPrint, vi: vi.inspectionSheetPrint } as const;

/** 날짜 칸 — 현장 시각의 날짜만(양식의 작성일·수리일·재검일). */
const day = (iso: string | null): string =>
  iso === null ? '' : (formatPlantDateTime(iso) ?? '').slice(0, 10);

const ItemTable = ({
  rows,
  minRows,
  l,
}: {
  rows: PrintItemRow[];
  /** 양식처럼 빈 줄까지 그려 칸 높이를 채운다. */
  minRows: number;
  l: (typeof LABELS)[PrintLang];
}) => (
  <table className="sheet-print__items">
    <colgroup>
      <col className="sheet-print__col-step" />
      <col className="sheet-print__col-code" />
      <col />
      <col className="sheet-print__col-mark" />
      <col className="sheet-print__col-mark" />
    </colgroup>
    <thead>
      <tr>
        <th rowSpan={2}>{l.stepColumn}</th>
        <th rowSpan={2}>{l.itemNo}</th>
        <th rowSpan={2}>{l.item}</th>
        <th colSpan={2}>{l.judgment}</th>
      </tr>
      <tr>
        <th>{l.full}</th>
        <th>{l.sample}</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={`${row.code}-${index}`}>
          {row.step !== null && (
            <th rowSpan={row.step.span} className="sheet-print__step">
              {row.step.label}
            </th>
          )}
          <td className="sheet-print__code">{row.code}</td>
          <td>{row.name}</td>
          <td className="sheet-print__mark">{itemMark(row.full)}</td>
          <td className="sheet-print__mark">{itemMark(row.sample)}</td>
        </tr>
      ))}
      {Array.from({ length: Math.max(0, minRows - rows.length) }, (_, index) => (
        <tr key={`blank-${index}`} className="sheet-print__blank">
          <td />
          <td />
          <td />
          <td />
          <td />
        </tr>
      ))}
    </tbody>
  </table>
);

export interface SheetPrintProps {
  sheet: InspectionSheet;
  lang: PrintLang;
  /** 4M 변경 종류 코드 → 이름. */
  changeTypeLabel: (code: string) => string;
}

/**
 * 제품 검사표 A4 한 장 — 고객 종이 양식(B-05-101 · OP·PP향 제품검사표 공검및출하)과 같은 배치(담당자 결정 ④).
 * 왼쪽에 머리·서명·NG·단계 판정, 가운데와 오른쪽에 단계별 검사 항목. 빈 양식이 아니라 입력된 결과를 찍는다.
 */
export const SheetPrint = ({ sheet, lang, changeTypeLabel }: SheetPrintProps) => {
  const l = LABELS[lang];
  const pp = sheet.formLayoutCode === 'PP';
  const items = itemColumns(sheet, lang);
  const ng = ngSlots(sheet);
  const dept = (code: string | null) => (code === null ? '' : (l.departments[code] ?? code));
  const stepName = (code: string | null) => {
    const step = sheet.steps.find((s) => s.stepCode === code);
    return step === undefined
      ? (code ?? '')
      : lang === 'vi'
        ? (step.nameVi ?? step.nameKo)
        : step.nameKo;
  };
  const fourM =
    sheet.fourMChanges.length === 0
      ? l.fourMNone
      : `${l.fourMYes}, ${sheet.fourMChanges
          .map((c) =>
            c.changeTypeCode === undefined
              ? c.lotNo
              : `${changeTypeLabel(c.changeTypeCode)}, ${c.lotNo}`,
          )
          .join(', ')}`;
  const rohs = sheet.rohsFlag ? `■${l.rohsYes} □${l.rohsNo}` : `□${l.rohsYes} ■${l.rohsNo}`;
  /** 이름 · 값 두 쌍을 한 줄에 — 양식의 「생산부 F/W | 값 | 품질부 F/W | 값」 줄. */
  const pair = (a: [string, string | null], b: [string, string | null]) => (
    <tr key={a[0]}>
      <th>{a[0]}</th>
      <td colSpan={2}>{a[1] ?? ''}</td>
      <th colSpan={2}>{b[0]}</th>
      <td colSpan={2}>{b[1] ?? ''}</td>
    </tr>
  );
  const wide = (label: string, value: string | null, className?: string) => (
    <tr key={label}>
      <th>{label}</th>
      <td colSpan={6} className={className}>
        {value ?? ''}
      </td>
    </tr>
  );

  const ngRows: [string, (n: NonNullable<(typeof ng.slots)[number]>) => string][] = [
    [l.ngRows.foundDepartment, (n) => dept(n.foundDepartmentCode)],
    [l.ngRows.foundStep, (n) => stepName(n.foundStepCode)],
    [l.ngRows.occurrence, (n) => n.occurrenceProcessText ?? ''],
    [l.ngRows.standardNo, (n) => n.standardNo ?? ''],
    [l.ngRows.itemNo, (n) => n.checkItemCode ?? ''],
    [l.ngRows.content, (n) => n.ngContent],
    [l.ngRows.investigation, (n) => n.investigationText ?? ''],
    [
      l.ngRows.ngType,
      (n) => (n.ngTypeCode === null ? '' : (l.types[n.ngTypeCode] ?? n.ngTypeCode)),
    ],
    [l.ngRows.repairDepartment, (n) => dept(n.repairDepartmentCode)],
    [l.ngRows.repairWorker, (n) => n.repairWorkerName ?? n.repairWorkerNo ?? ''],
    [l.ngRows.repairedAt, (n) => day(n.repairedAt)],
    [l.ngRows.recheckResult, (n) => n.recheckResultCode ?? ''],
    [l.ngRows.recheckWorker, (n) => n.recheckWorkerName ?? n.recheckWorkerNo ?? ''],
    [l.ngRows.recheckedAt, (n) => day(n.recheckedAt)],
  ];

  return (
    <article
      className={`sheet-print sheet-print--${sheet.formLayoutCode.toLowerCase()}`}
      lang={lang}
    >
      <div className="sheet-print__left">
        {/* 양식 머리 — 왼쪽 Model·사양·발송지와 가운데 제목, 오른쪽 작성일·승인·확인·작성자 칸이 한 덩어리다. */}
        <table className="sheet-print__head">
          <colgroup>
            <col className="sheet-print__col-label" />
            <col />
            <col className="sheet-print__col-title" />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <th>{l.model}</th>
              <td>{sheet.modelText ?? ''}</td>
              <td rowSpan={3} className="sheet-print__title-cell">
                <h1 className="sheet-print__title">{l.title}</h1>
              </td>
              <th className="sheet-print__sign-head">{l.writtenAt}</th>
              <th className="sheet-print__sign-head">{l.approved}</th>
              <th className="sheet-print__sign-head">{l.checked}</th>
              <th className="sheet-print__sign-head">{l.writer}</th>
            </tr>
            <tr>
              <th>{l.spec}</th>
              <td>{sheet.specText ?? ''}</td>
              <td rowSpan={2} className="sheet-print__sign">
                {day(sheet.createdAt)}
              </td>
              <td rowSpan={2} className="sheet-print__sign">
                {sheet.approvedByName ?? ''}
              </td>
              <td rowSpan={2} className="sheet-print__sign">
                {sheet.checkedByName ?? ''}
              </td>
              <td rowSpan={2} className="sheet-print__sign">
                {sheet.writtenWorkerName ?? ''}
              </td>
            </tr>
            <tr>
              <th>{l.destination}</th>
              <td>{sheet.destinationText ?? ''}</td>
            </tr>
            {wide(l.serial, sheet.serialNo, 'sheet-print__serial')}
            {pp && wide(l.productName, sheet.productNameText)}
            {pp && pair([l.power, sheet.powerText], [l.motor, sheet.motorText])}
            {wide(l.material, sheet.materialText)}
            {pair([l.structure, sheet.structureText], [l.rohsHead, rohs])}
            {pp && wide(l.inputTime, formatPlantDateTime(sheet.createdAt))}
            {pair(
              [l.fwProduction, sheet.fwProductionVersion],
              [l.fwQuality, sheet.fwQualityVersion],
            )}
            {pair([l.pcbLot, sheet.pcbLotNo], [l.sdLot, sheet.sdLotNo])}
            {pair([l.stapleLot, sheet.stapleLotNo], [l.fourM, fourM])}
          </tbody>
        </table>

        <div className="sheet-print__middle">
          <table className="sheet-print__ngs">
            <thead>
              <tr>
                <th />
                {ng.slots.map((_, index) => (
                  <th key={index}>{l.ngTitle(index + 1)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ngRows.map(([label, value]) => (
                <tr key={label}>
                  <th>{label}</th>
                  {ng.slots.map((slot, index) => (
                    <td key={index}>{slot === null ? '' : value(slot)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <table className="sheet-print__steps">
            <thead>
              <tr>
                <th>{l.stepColumn}</th>
                <th>{l.judgment}</th>
                <th>{l.sign}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.steps.map((step) => (
                <tr key={step.stepCode}>
                  <th>{lang === 'vi' ? (step.nameVi ?? step.nameKo) : step.nameKo}</th>
                  <td className="sheet-print__mark sheet-print__boxes">{stepJudgment(step)}</td>
                  <td>{step.result?.signedByName ?? ''}</td>
                </tr>
              ))}
              <tr>
                <th>{l.rohs}</th>
                <td colSpan={2}>{rohs}</td>
              </tr>
              <tr>
                <th>{l.tempPack}</th>
                <td colSpan={2}>{sheet.tempPackNote ?? ''}</td>
              </tr>
              <tr>
                <th>{l.overall}</th>
                <td colSpan={2} className="sheet-print__mark">
                  {sheet.overallResultCode ?? ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {ng.more > 0 && <p className="sheet-print__more">{l.ngMore(ng.more)}</p>}
      </div>
      <ItemTable rows={items.left} minRows={LEFT_ITEM_ROWS[sheet.formLayoutCode]} l={l} />
      <ItemTable rows={items.right} minRows={LEFT_ITEM_ROWS[sheet.formLayoutCode]} l={l} />
      <footer className="sheet-print__footer">
        <p>{l.note}</p>
        <p>{l.formNo}</p>
      </footer>
    </article>
  );
};
