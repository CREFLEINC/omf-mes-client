import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { documentTypeName } from './document-types';
import type { CodeNameOf } from './queries';
import { judgeScreenOpen, type ScreenRouteTable } from './screen-routes';
import { StepsPane } from './steps-pane';
import { SuccessorsPane } from './successors-pane';
import type { DocumentProgressDetailView } from './types';

const t = messages.documentProgress;

export interface DetailPaneProps {
  detail: DocumentProgressDetailView;
  /** 화면 ID → 주소 표. **인자로 받는다** — 표를 채우면 열기가 살아나는 것을 잴 수 있어야 한다. */
  routes: ScreenRouteTable;
  /** 열 수 있을 때만 불린다. 어디로 가는지는 화면이 정한다 — 부품은 주소를 모른다. */
  onOpen: (path: string) => void;
  statusName: CodeNameOf;
  subTypeName: CodeNameOf;
  /** 머리 아래 · 처리 경과 위에 놓는 취소 구획(요청 · 승인 진행 · 실행). */
  children?: ReactNode;
}

/**
 * 고른 전표 — **다른 목록 · 상세 화면과 같은 사실 칸 짜임**(오른쪽 구획 · #360). 머리(유형 · 문서번호 + 사실 칸) 다음에
 * 취소 구획, 처리 경과, 후속 문서가 이어진다. 구획이 통째로 스크롤한다.
 *
 * ⭐ **요약은 상세 응답의 값이다**(계약 `DocumentProgressDetail.progress`) — 왼쪽 목록 행을 다시 그리지 않는다.
 *
 * ⭐ **문서 열기는 아직 없다** — 화면 ID → 주소 표(`SCREEN_ROUTES`)가 비어 있다. 열 수 없으면 단추를 두지
 * 않는다(사용자 지시 2026-11-19 — 구현되지 않은 기능은 걷는다 · C-4). 표에 줄이 생기면 그것만으로 살아난다.
 */
export const DetailPane = ({
  detail,
  routes,
  onOpen,
  statusName,
  subTypeName,
  children,
}: DetailPaneProps) => {
  const { progress } = detail;
  const openState = judgeScreenOpen(detail.screenId ?? '', routes);

  const facts: { key: string; label: string; value: string }[] = [
    {
      key: 'documentType',
      label: t.fields.documentType,
      value: documentTypeName(progress.documentTypeCode),
    },
    { key: 'documentNo', label: t.fields.q, value: progress.documentNo },
    { key: 'documentDate', label: t.detail.documentDate, value: progress.documentDate },
    {
      key: 'subType',
      label: t.detail.subType,
      /* 없이 오는 문서가 실재한다 — 빈 칸으로 두면 화면이 빠뜨린 것과 구분되지 않는다. */
      value:
        progress.documentSubTypeCode === null
          ? t.values.empty
          : subTypeName(progress.documentSubTypeCode),
    },
    { key: 'status', label: t.detail.status, value: statusName(progress.statusCode) },
    { key: 'plannedQty', label: t.detail.plannedQty, value: String(progress.plannedQty) },
    { key: 'processedQty', label: t.detail.processedQty, value: String(progress.processedQty) },
    { key: 'remainingQty', label: t.detail.remainingQty, value: String(progress.remainingQty) },
  ];

  return (
    <>
      {/*
       * 머리 = 사실 칸(이름 위 · 값 아래) — 공급사 반품 · 재고조정 이력 상세와 같은 짜임(#360). 단추는 그 아래 줄에 선다.
       */}
      <div role="group" aria-label={t.detail.summary(progress.documentNo)}>
        <dl className="filter-bar">
          {facts.map((fact) => (
            <div className="field-cell" key={fact.key}>
              <dt className="field-label">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {openState.kind === 'open' ? (
          <div className="filter-actions">
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
        ) : null}
      </div>

      {children}

      <StepsPane steps={detail.steps} stepName={statusName} />

      <SuccessorsPane successors={detail.successors} routes={routes} onOpen={onOpen} />
    </>
  );
};
