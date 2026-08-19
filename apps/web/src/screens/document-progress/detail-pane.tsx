import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { judgeScreenOpen, type ScreenRouteTable } from './screen-routes';
import { StepsPane } from './steps-pane';
import { SuccessorsPane } from './successors-pane';
import type { DocumentProgressDetailView } from './types';

const t = messages.documentProgress;

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

/** 이름·값 짝을 한 덩어리로 낸다. 폼이 아니라 **값 표기**다(전례 `stock-status/lot-detail-pane`). */
const SummaryList = ({ label, items }: { label: string; items: SummaryItem[] }) => (
  <div role="group" aria-label={label}>
    <dl className="filter-bar">
      {items.map((item) => (
        <div className="field-cell" key={item.key}>
          <dt className="field-label">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

export interface DetailPaneProps {
  detail: DocumentProgressDetailView;
  /** 화면 ID → 주소 표. **인자로 받는다** — 표를 채우면 열기가 살아나는 것을 잴 수 있어야 한다. */
  routes: ScreenRouteTable;
  /** 열 수 있을 때만 불린다. 어디로 가는지는 화면이 정한다 — 부품은 주소를 모른다. */
  onOpen: (path: string) => void;
}

/**
 * 고른 문서의 상세 — **목록 아래 구획**이다.
 *
 * 드로어도 창도 아니다. 디자인 시스템에 드로어가 없고(설치본 실측), 창으로 대체하면 목록이
 * 가려져 「고르고 다시 목록으로 돌아가는」 이 화면의 반복 조회가 매번 열고 닫는 일이 된다.
 *
 * ⭐ **요약을 목록 행이 아니라 상세 응답의 `progress`에서 그린다**(계획 갈래 18). 두 조회의
 * 시점이 갈릴 수 있어, 목록 행을 다시 그리면 같은 화면의 위아래가 서로 다른 수량을 말한다.
 * 그 사실을 안내 한 줄로 밝히는 것이 짝이다.
 *
 * ⭐ **조회만 한다.** 취소 요청·승인 진행·취소 실행은 이 회차에 없다 — 그 조작이 실제로 생기는
 * 회차(단위 ③④)에서 이 구획 안에 자리를 얻는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DetailPane = ({ detail, routes, onOpen }: DetailPaneProps) => {
  const { progress } = detail;
  const openState = judgeScreenOpen(detail.screenId ?? '', routes);

  const items: SummaryItem[] = [
    { key: 'documentType', label: t.detail.documentType, value: progress.documentTypeCode },
    { key: 'documentNo', label: t.detail.documentNo, value: progress.documentNo },
    { key: 'documentDate', label: t.detail.documentDate, value: progress.documentDate },
    {
      key: 'subType',
      label: t.detail.subType,
      /* 없이 오는 문서가 실재한다 — 빈 칸으로 두면 화면이 빠뜨린 것과 구분되지 않는다. */
      value: progress.documentSubTypeCode ?? t.values.empty,
    },
    { key: 'status', label: t.detail.status, value: progress.statusCode },
    { key: 'plannedQty', label: t.detail.plannedQty, value: String(progress.plannedQty) },
    { key: 'processedQty', label: t.detail.processedQty, value: String(progress.processedQty) },
    { key: 'remainingQty', label: t.detail.remainingQty, value: String(progress.remainingQty) },
  ];

  return (
    <>
      <SummaryList label={t.detail.summary(progress.documentNo)} items={items} />

      {/*
       * ⛔ **열 수 없으면 손잡이를 아예 만들지 않는다**(계획 갈래 23). 잠긴 버튼을 두면
       * 사용자가 눌러 보다 마는데, 지금은 어떤 문서로도 풀리지 않는 잠금이다 — 대신 사유를
       * 글자로 밝힌다.
       */}
      {openState.kind === 'open' ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              onOpen(openState.path);
            }}
          >
            {t.actions.openDocument}
          </Button>
        </div>
      ) : (
        <p className="field-note">{t.detail.openBlocked}</p>
      )}

      <p className="field-note">{t.detail.summaryNote}</p>

      <StepsPane steps={detail.steps} />

      <SuccessorsPane successors={detail.successors} routes={routes} onOpen={onOpen} />
    </>
  );
};
