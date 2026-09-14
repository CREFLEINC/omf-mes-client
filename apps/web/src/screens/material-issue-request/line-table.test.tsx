import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import { emptyLineDraft, lineDraftsFromShortage } from './line-draft';
import { LineTable } from './line-table';
import { shortageFixtures } from './fixtures';
import type { ItemLookupResult, LookupResult } from './lookups';
import { toShortageLineView } from './types';

const t = messages.materialIssueRequest;

/** 최소 갈래 — 역할·라벨이 서는지만 본다. 흐름 스위트를 만들지 않는다. */

const itemLookup: ItemLookupResult = {
  entries: [
    { value: '7401', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: true, baseUomId: 7501 },
    { value: '7402', label: 'SAMPLE-ITEM-02 · 합성 품목 나', isActive: true, baseUomId: 7501 },
    { value: '7403', label: 'SAMPLE-ITEM-03 · 합성 품목 다', isActive: true, baseUomId: 7502 },
  ],
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
};

const uomLookup: LookupResult = {
  entries: [{ value: '7501', label: 'SAMPLE-UOM-EA · 개', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
};

const itemOptions = itemLookup.entries.map((entry) => ({
  value: entry.value,
  label: entry.label,
}));
const uomOptions = uomLookup.entries.map((entry) => ({ value: entry.value, label: entry.label }));

const renderTable = (
  rows = lineDraftsFromShortage(shortageFixtures.map(toShortageLineView)),
  itemNameSources: ReadonlyMap<string, LookupSource> = new Map(),
) =>
  render(
    <LineTable
      rows={rows}
      errors={{}}
      itemLookup={itemLookup}
      itemNameSources={itemNameSources}
      uomLookup={uomLookup}
      itemOptions={itemOptions}
      uomOptions={uomOptions}
      onPatch={vi.fn()}
      onRemove={vi.fn()}
    />,
  );

describe('LineTable', () => {
  it('표가 구획 제목으로 식별된다', () => {
    renderTable();

    expect(screen.getByRole('table', { name: t.panes.lines })).toBeInTheDocument();
  });

  it('6열 머리가 선다', () => {
    renderTable();

    for (const header of [
      t.lineTable.item,
      t.lineTable.requiredQty,
      t.lineTable.issuedQty,
      t.lineTable.shortageQty,
      t.lineTable.requestedQty,
      t.lineTable.uom,
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('BOM 유래 줄은 요청 수량만 고칠 수 있고 품목·단위는 읽기 전용 글자다', () => {
    renderTable();

    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toBeEnabled();
    expect(screen.queryByLabelText(t.lineTable.itemLabel(1))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.lineTable.uomLabel(1))).not.toBeInTheDocument();
    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
  });

  it('BOM 소요·기출고·부족 세 열에 입력칸이 없다 — 서버가 낸 값이다', () => {
    renderTable();

    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('BOM 밖 줄에 경고 표식이 서되 입력칸은 잠기지 않는다', () => {
    renderTable();

    expect(screen.getAllByText(t.warnings.outsideBom)).toHaveLength(1);
    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(3))).toBeEnabled();
  });

  /*
   * 소요 응답은 itemId 만 준다(문의 047). 품목 목록 한 쪽에 BOM 품목이 없어도 상세로 푼 이름이
   * 서야 한다 — 목록으로만 풀면 품목이 많은 환경에서 전부 「알 수 없음」이 된다.
   */
  it('BOM 유래 줄의 품목 이름은 품목 목록에 없어도 상세로 푼 이름으로 선다', () => {
    const named = (value: string, label: string): LookupSource => ({
      entries: [{ value, label, isActive: true }],
      isError: false,
      isLoading: false,
    });

    renderTable(
      lineDraftsFromShortage(shortageFixtures.map(toShortageLineView)),
      new Map<string, LookupSource>([
        ['7401', named('7401', 'BOM-ITEM-01 · 상세 품목 가')],
        ['7402', { entries: [], isError: true, isLoading: false }],
        ['7403', { entries: [], isError: false, isLoading: true }],
      ]),
    );

    expect(screen.getByText('BOM-ITEM-01 · 상세 품목 가')).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-ITEM-01 · 합성 품목 가')).not.toBeInTheDocument();
    /* 줄마다 따로 판정한다 — 한 품목의 실패가 다른 줄의 이름을 지우지 않는다. */
    expect(screen.getByText(messages.common.reference.failed)).toBeInTheDocument();
    expect(screen.getByText(messages.common.reference.loading)).toBeInTheDocument();
  });

  it('손으로 더한 줄은 품목·단위를 고른다', () => {
    renderTable([emptyLineDraft()]);

    expect(screen.getByLabelText(t.lineTable.itemLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.uomLabel(1))).toBeInTheDocument();
  });

  it('줄이 없으면 무엇을 하면 되는지 말한다', () => {
    renderTable([]);

    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });
});
