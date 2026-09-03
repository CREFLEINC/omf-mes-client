import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LookupResult } from './lookups';
import { TargetPane } from './target-pane';
import { toWorkOrderView } from './types';
import { workOrderFixtures } from './fixtures';

const t = messages.materialIssueRequest;

/** 최소 갈래 — 역할·라벨이 서는지만 본다. */

const uomLookup: LookupResult = {
  entries: [{ value: '7501', label: 'SAMPLE-UOM-EA · 개', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
};

const workOrder = toWorkOrderView(workOrderFixtures[0]!);

const renderPane = (override: Partial<Parameters<typeof TargetPane>[0]> = {}) =>
  render(
    <TargetPane
      searchDraft=""
      onChangeSearchDraft={vi.fn()}
      onSearch={vi.fn()}
      isSearching={false}
      workOrderOptions={[
        { value: '7101', label: 'SAMPLE-WO-0001 · 합성 공정 가 · SAMPLE-ITEM-01' },
      ]}
      workOrderId="7101"
      onSelectWorkOrder={vi.fn()}
      selectedWorkOrder={workOrder}
      uomLookup={uomLookup}
      warehouseOptions={[{ value: '7201', label: 'SAMPLE-WH-01 · 합성 자재창고' }]}
      warehouseId="7201"
      onChangeWarehouse={vi.fn()}
      locationOptions={[{ value: '7301', label: 'SAMPLE-LOC-01 · 합성 위치 가' }]}
      destinationLocationId="7301"
      onChangeDestination={vi.fn()}
      requiredDate=""
      requiredTime=""
      onChangeRequiredDate={vi.fn()}
      onChangeRequiredTime={vi.fn()}
      headerErrors={{}}
      isLocked={false}
      {...override}
    />,
  );

describe('TargetPane', () => {
  it('대상 입력을 제목이 있는 구획으로 구분한다', () => {
    renderPane();

    expect(screen.getByRole('heading', { level: 2, name: t.panes.target })).toBeInTheDocument();
  });

  it('W/O 검색칸·선택칸·창고·도착 위치·필요 일자·필요 시각 라벨이 선다', () => {
    renderPane();

    for (const label of [
      t.formFields.workOrderSearch,
      t.formFields.workOrder,
      t.formFields.warehouse,
      t.formFields.destinationLocation,
      t.formFields.requiredDate,
      t.formFields.requiredTime,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('도착 위치가 필수 표식을 갖는다 — 계약이 NOT NULL 인 FK 다', () => {
    renderPane();

    expect(screen.getByLabelText(t.formFields.destinationLocation)).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('고른 W/O 의 지시수량과 유형 글자를 서버가 준 그대로 보인다', () => {
    renderPane();

    expect(screen.getByText(t.values.orderQty('120', 'SAMPLE-UOM-EA · 개'))).toBeInTheDocument();
    expect(
      screen.getByText(t.values.workOrderType(workOrder.workOrderTypeCode)),
    ).toBeInTheDocument();
  });

  it('필요 시각 오류를 보이는 글자로 낸다', () => {
    renderPane({ headerErrors: { requiredAt: t.errors.requiredTimeMissing } });

    expect(screen.getByText(t.errors.requiredTimeMissing)).toBeInTheDocument();
  });

  /**
   * 목이 `page.total` 을 항상 1 로 주어 브라우저에서 확인하지 못한 자리다(검증 발견 7).
   * 「목록에 없다」와 「목록이 잘렸다」는 사용자가 할 일이 다르므로, 잘림을 말하지 않으면
   * 찾는 W/O 가 아예 없는 것으로 읽힌다.
   */
  it('검색 결과가 잘리면 좁히라고 말한다', () => {
    renderPane({ workOrderNote: t.filters.workOrderTruncated });

    expect(screen.getByText(t.filters.workOrderTruncated)).toBeInTheDocument();
  });

  it('선택지 조회가 실패하면 그 사실을 말한다 — 「없다」로 읽히지 않게 한다', () => {
    renderPane({ workOrderNote: t.filters.lookupFailed });

    expect(screen.getByText(t.filters.lookupFailed)).toBeInTheDocument();
  });
});
