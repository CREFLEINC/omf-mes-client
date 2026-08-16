import {
  Button,
  Checkbox,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { hasAnyPartnerFilter } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { Partner, PartnerFilters } from './types';

const t = messages.commonCode;

/** 탭을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_PARTNER_FILTERS: PartnerFilters = { q: '', includeInactive: false };

export interface PartnerListPaneProps {
  partners: Partner[];
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 */
  appliedFilters: PartnerFilters;
  /** 조회 버튼·Enter·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: PartnerFilters) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedPartnerId: number | null;
  onSelect: (partnerId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 거래처가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 좌 페인 — 거래처를 찾아 고르는 자리.
 *
 * **열은 둘뿐이다**(거래처코드·거래처명). 「사용 여부」를 열로 두지 않고 이름 뒤 접미로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다(같은 화면의 다른 좌 목록과 같은 규율).
 *
 * **거래처를 더하거나 고치는 컨트롤이 없다.** 거래처 본체는 ERP 수신 마스터라 계약에 등록·수정·
 * 사용 중지 경로가 아예 없다 — 잠긴 버튼으로도 두지 않는다(잠근 버튼은 「언젠가 풀린다」는 뜻이다).
 *
 * **조건 칩을 두지 않는다.** 이 탭의 조건은 검색어와 미사용 포함 둘뿐이고 그 둘이 컨트롤에
 * 그대로 실려 있다 — 칩은 조건이 컨트롤 밖(선택 축 등)으로 나갈 때 필요한 표시다.
 *
 * **정렬 가능한 열을 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없어
 * 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 되어 사용자를 속인다.
 */
export const PartnerListPane = ({
  partners,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  onChangePage,
  selectedPartnerId,
  onSelect,
  loadError,
}: PartnerListPaneProps) => {
  /*
   * 트리거 모델: 검색어는 모아서 적용, 미사용 포함은 즉시.
   * 편집 중인 값은 draft에만 있다 — 적용된 조건은 주소가 들고 있다.
   */
  const [draft, setDraft] = useState<PartnerFilters>(appliedFilters);
  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const columns: Column<Partner>[] = [
    {
      key: 'partnerCode',
      header: t.partner.fields.partnerCode,
      width: '160px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.partnerId === selectedPartnerId ? 'true' : undefined}
          onClick={() => onSelect(row.partnerId)}
        >
          {row.partnerCode}
        </button>
      ),
    },
    {
      key: 'partnerName',
      header: t.partner.fields.partnerName,
      render: (row) =>
        row.isActive ? row.partnerName : `${row.partnerName}${t.values.inactiveSuffix}`,
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다 — 돌아갈 길(첫 쪽으로)을 함께 준다.
   * ② 조건이 걸린 0건: 조건을 줄이면 나올 수 있다.
   * ③ 조건 없는 0건: 정말로 아무것도 없다 — **어디서 오는 자료인지**만 밝히고
   *   없는 조치(「거래처 추가」)를 지시하지 않는다.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={() => onChangePage(1)}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (hasAnyPartnerFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.partner.empty.noMatchTitle}
          description={t.partner.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_PARTNER_FILTERS)}>
              {messages.common.reset}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.partner.empty.noneTitle}
        description={t.partner.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.partners}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <Table
          density="compact"
          columns={columns}
          rows={partners}
          /*
           * 행 식별자를 주지 않으면 인덱스가 React key가 되어, 앞 줄이 사라질 때
           * 누르고 있던 줄의 DOM 노드가 대신 지워진다 — 포커스가 말없이 다른 거래처로 옮겨 붙는다.
           */
          getRowId={(row) => String(row.partnerId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.partner}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.partnerSearchLabel}
          placeholder={t.filters.partnerSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1). */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_PARTNER_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      {listSlot()}
    </section>
  );
};
