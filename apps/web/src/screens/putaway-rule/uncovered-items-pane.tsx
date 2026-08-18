import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import type { UncoveredItem } from './types';

const t = messages.putawayRule;

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 마지막 입고 시각의 표기.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 입고가 일어난 곳의 시각이고,
 * 보는 사람의 시간대로 옮기면 같은 입고가 사람마다 다른 시각에 일어난 것으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 —
 * 「—」로 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * **형식을 새로 짓지 않았다.** 이 저장소가 여러 화면에서 쓰는 규칙 그대로다(연·월·일 + 시·분).
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export interface UncoveredItemsPaneProps {
  items: UncoveredItem[];
  /** 서버가 센 전체 건수. 받은 목록보다 클 수 있고 그때는 잘린 것이다. */
  total: number;
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 건수도 목록도 내지 않는다. */
  loadError: ReactNode;
}

/**
 * 규칙 없는 품목 — **이 화면이 목록만큼 중요하게 다뤄야 하는 자리다.**
 *
 * 적치 규칙이 없는 품목은 현장에서 위치 검증 없이 통과한다. 등록된 규칙만 보이면 그 사실이
 * 화면 어디에도 드러나지 않으므로(공유계약 G-12) 건수를 **펼치기 전에** 먼저 보인다.
 *
 * **0건은 좋은 상태다.** 경고 톤을 쓰지 않는다 — 조치할 것이 없는데 조치를 재촉하는 화면은
 * 그다음 진짜 경고까지 함께 무디게 만든다.
 *
 * **실패했으면 건수를 내지 않는다.** 0을 내면 「규칙 없는 품목이 없다」는 좋은 소식으로 읽히는데
 * 실제로는 그것을 확인하지 못한 것이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const UncoveredItemsPane = ({
  items,
  total,
  isLoading,
  loadError,
}: UncoveredItemsPaneProps) => {
  const paneId = useId();
  const bodyId = `${paneId}-body`;
  const [isExpanded, setIsExpanded] = useState(false);

  const columns: Column<UncoveredItem>[] = [
    { key: 'itemCode', header: t.fields.itemCode, width: '160px' },
    { key: 'itemName', header: t.fields.itemName },
    {
      key: 'lastReceivedAt',
      header: t.fields.lastReceivedAt,
      width: '160px',
      /* 계약이 이 값을 선택으로 두었다 — 없는 것을 대시로 뭉개면 못 알아본 것과 갈리지 않는다. */
      render: (row) =>
        row.lastReceivedAt === null || row.lastReceivedAt === undefined
          ? t.values.neverReceived
          : formatDateTime(row.lastReceivedAt),
    },
  ];

  const body = (): ReactNode => {
    /* 실패 → 로딩 → 본 판정 순서다(사본 대조 추가 ①). */
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.uncovered}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (total === 0) {
      return (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            /* 0건은 조치가 필요 없는 상태다 — 라이브 강도를 assertive로 올리지 않는다. */
            assertive={false}
            title={t.uncovered.noneTitle}
          >
            {t.uncovered.noneDescription}
          </AlertBanner>
        </div>
      );
    }

    return (
      <>
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.uncovered.countTitle(total)}>
            {t.uncovered.countDescription}
          </AlertBanner>
        </div>

        <div className="form-actions">
          <div className="field-cell">
            <Button
              variant="text"
              aria-expanded={isExpanded}
              /*
               * **접혀 있는 동안에는 가리키지 않는다.** 본문이 조건부 렌더라 접히면 그 id를
               * 가진 요소가 DOM에 없는데, `aria-controls`는 존재하는 요소를 가리켜야 한다 —
               * 없는 id를 가리키면 보조기술이 그 관계를 버린다. 상태는 `aria-expanded`가 말한다.
               */
              aria-controls={isExpanded ? bodyId : undefined}
              onClick={() => {
                setIsExpanded((prev) => !prev);
              }}
            >
              {isExpanded ? t.actions.collapseUncovered : t.actions.expandUncovered}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div id={bodyId}>
            <Table
              density="compact"
              columns={columns}
              rows={items}
              getRowId={(row) => String(row.itemId)}
              /* 건수와 목록이 어긋난 상태를 감추지 않는다 — 그 자체가 알려야 할 사실이다. */
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={t.uncovered.emptyListTitle}
                  description={t.uncovered.emptyListDescription}
                />
              }
            />
            {total > items.length && <p className="field-note">{t.uncovered.truncated}</p>}
          </div>
        )}
      </>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.uncovered}>
      {body()}
    </section>
  );
};
