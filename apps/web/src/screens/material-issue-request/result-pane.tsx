import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CreatedRequestView } from './types';

const t = messages.materialIssueRequest;

export interface ResultPaneProps {
  /** 발행이 막힌 사유. `null`이면 열려 있다 */
  publishBlockReason: string | null;
  /** 저장 실패 배너. 인라인으로 소화하지 못한 오류만 남는다(`patterns/master`) */
  banner: ReactNode;
  /** 방금 발행한 요청. `null`이면 아직 성공하지 않았다 */
  created: CreatedRequestView | null;
  onPublish: () => void;
}

/**
 * 구획 ④ — 발행 액션과 결과.
 *
 * **되돌릴 수 없는 쓰기를 두 겹으로 막는다** — ① 전송 중 잠금 ② 성공 뒤 잠금. 누르면 화면이
 * 확인 창을 먼저 연다(#360, `publish-confirm-dialog.tsx`).
 *
 * **성공 뒤에도 결과를 지우지 않는다.** 이 화면에는 발행한 요청으로 돌아가는 진입점이 없어,
 * 요청번호를 화면에 남겨 두는 것이 사용자가 그 값을 잃지 않는 유일한 방법이다.
 *
 * **상태는 서버가 준 글자 그대로** 보인다(공유계약 G-2) — 값 목록이 확정되기 전에 「접수」·「완료」
 * 로 옮겨 적으면 화면이 뜻을 지어내는 것이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ResultPane = ({ publishBlockReason, banner, created, onPublish }: ResultPaneProps) => {
  const reasonId = useId();

  return (
    <section className="pane material-issue-request-pane" aria-label={t.panes.result}>
      <h2 className="pane-title">{t.panes.result}</h2>

      {created !== null && (
        <div className="banner-slot">
          {/* 출발 생산 창고별로 나뉘면 여러 장이다(계약 §1 배열 응답, screens/W-02-10.md 「발행 흐름」). */}
          <AlertBanner variant="success" title={t.result.splitTitle(created.requests.length)}>
            <ul className="material-issue-request-created">
              {created.requests.map((request) => (
                <li key={request.issueRequestNo}>
                  <span>{t.result.issueRequestNo(request.issueRequestNo)}</span>
                  {request.sourceWarehouseName !== null && (
                    <span>{request.sourceWarehouseName}</span>
                  )}
                  <Chip size="sm" status="info">
                    {request.statusLabel}
                  </Chip>
                  {request.lineCount !== null && (
                    <span>{t.result.lineCount(request.lineCount)}</span>
                  )}
                </li>
              ))}
            </ul>
            {created.overridden && <p className="field-note">{t.result.overrideNote}</p>}
            {created.fromUnsourced && <p className="field-note">{t.result.unsourcedNote}</p>}
          </AlertBanner>
        </div>
      )}

      {banner}

      {/*
       * 잠긴 사유는 `aria-describedby`로 잇는다. 입력으로 풀 수 없는 잠금(생산 창고 없음 · 이미 발행)만
       * 보이는 글로 두고, 나머지는 화면 읽기 도구에만 둔다(사용자 지시 2026-11-27 · #360).
       */}
      <div className="material-issue-request-publish-row">
        {publishBlockReason !== null && (
          <span
            id={reasonId}
            className={
              publishBlockReason === t.sourceWarehouse.none ||
              publishBlockReason === t.actionReasons.alreadyPublished
                ? 'field-note'
                : 'visually-hidden'
            }
          >
            {publishBlockReason}
          </span>
        )}

        <Button
          disabled={publishBlockReason !== null}
          aria-describedby={publishBlockReason === null ? undefined : reasonId}
          onClick={onPublish}
        >
          {t.actions.publish}
        </Button>
      </div>
    </section>
  );
};
