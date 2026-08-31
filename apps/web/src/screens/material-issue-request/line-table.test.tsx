import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

const renderTable = (rows = lineDraftsFromShortage(shortageFixtures.map(toShortageLineView))) =>
  render(
    <LineTable
      rows={rows}
      errors={{}}
      itemLookup={itemLookup}
      uomLookup={uomLookup}
      itemOptions={itemOptions}
      uomOptions={uomOptions}
      onPatch={vi.fn()}
      onRemove={vi.fn()}
    />,
  );

describe('LineTable', () => {
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
