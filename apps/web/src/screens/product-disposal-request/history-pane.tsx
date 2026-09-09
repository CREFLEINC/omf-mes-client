import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  type StepperItem,
  Stepper,
  Table,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import { formatDateTime, isProductDisposal, type IssueRow } from './types';

const t = messages.productDisposalRequest;

/**
 * 고른 전표의 결재 상태.
 *
 * ⛔ **「상신하지 않았다」와 「못 물었다」를 가른다.** 둘을 같은 말로 적으면 사용자가 결재함에
 * 가서 없는 요청을 찾는다.
 */
export type ApprovalView =
  | { kind: 'idle' }
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'failed' }
  | { kind: 'loaded'; summary: string; steps: readonly StepperItem[] };

const ApprovalBlock = ({ approval }: { approval: ApprovalView }) => {
  switch (approval.kind) {
    case 'idle':
      return <p className="field-note">{t.approval.pickRow}</p>;
    case 'none':
      return <p className="field-note">{t.approval.notSubmitted}</p>;
    case 'pending':
      return (
        <div role="status" aria-label={t.approval.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    case 'failed':
      return <AlertBanner variant="error">{t.approval.loadFailed}</AlertBanner>;
    case 'loaded':
      return (
        <>
          <p className="field-note">{approval.summary}</p>
          {/*
           * §7 — 결재선 진행은 «세로» `Stepper` 다. 칸의 글이 사람 이름과 판정 두 줄이라
           * 가로로 두면 이름이 잘린다.
           *
           * **이름을 붙이지 않는다** — 감싼 구획이 이미 「결재 진행」으로 불리고 있어, 목록에도
           * 같은 이름을 주면 스크린리더가 두 번 읽는다.
           */}
          <Stepper orientation="vertical" size="sm" steps={[...approval.steps]} />
        </>
      );
  }
};

/**
 * 「기타출고 처리」 — **승인이 끝난 전표를 실제 출고로 만든다.**
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 여기서 다시 눌러야 한다.
 * ⛔ 승인 «상태»로 잠그지 않는다 — 서버의 400 이 말한다(통지 `#674` · §8-6).
 */
export interface PostAction {
  /** 막는 사유. 없으면 열려 있다. **승인 여부는 여기 들지 않는다.** */
  lock: string | undefined;
  isSaving: boolean;
  error: ApiError | null;
  onPost: () => void;
}

export interface HistoryPaneProps {
  rows: readonly IssueRow[];
  selectedId: number | null;
  isLoading: boolean;
  error: ReactNode;
  reasons: LookupSource;
  onSelect: (goodsIssueId: number | null) => void;
  approval: ApprovalView;
  post: PostAction;
}

/**
 * 「처리 이력」 탭.
 *
 * ⛔ **여기서 승인·반려하지 않는다**(J-10) — 결재함(`W-CO-09`) 몫이다. 이 자리는 **어디까지
 * 왔는가**를 읽기만 한다.
 *
 * ⚠ **자재 폐기 전표가 섞여 온다** — 목록 질의에 원천 문서 유형 축이 없다. 거르지 않고
 * **열로 보이고 그 사실을 적는다**(A-11 · L-11).
 */
export const HistoryPane = ({
  rows,
  selectedId,
  isLoading,
  error,
  reasons,
  onSelect,
  approval,
  post,
}: HistoryPaneProps) => {
  const columns: Column<IssueRow>[] = [
    { key: 'no', header: t.history.fields.no, render: (row) => row.goodsIssueNo },
    {
      /* ⭐ 이 화면이 만든 것과 자재 폐기 것을 «보이게» 가른다 — 감추지 않고 표시한다. */
      key: 'source',
      header: t.history.fields.source,
      render: (row) => (
        <Chip status={isProductDisposal(row) ? 'info' : 'idle'}>
          {isProductDisposal(row) ? t.history.sourceProduct : t.history.sourceOther}
        </Chip>
      ),
    },
    {
      key: 'issuedAt',
      header: t.history.fields.issuedAt,
      render: (row) => formatDateTime(row.issuedAt),
    },
    {
      /*
       * ⭐ **싣기만 하던 값을 열로 낸다** — 전기된 전표인지 사람이 볼 수 있어야 한다.
       *
       * ⛔ **잠금 축으로 쓰지 않는다.** `statusCode` 가 계약에서 열린 문자열이라 「이미
       * 전기됐다」를 값으로 판정할 수 없다 — 앞질러 막으면 다른 상태까지 함께 막힌다.
       * 두 번째 전기는 서버가 막고, 화면은 그 400 을 그대로 낸다(J-8 과 같은 규율).
       */
      key: 'status',
      header: t.history.fields.status,
      render: (row) => row.statusCode,
    },
    {
      key: 'reason',
      header: t.history.fields.reason,
      render: (row) =>
        row.reasonCode === null
          ? messages.common.reference.unknown
          : lookupDisplayLabel(reasons, row.reasonCode),
    },
    {
      /* ⭐ 「상신됐는가」는 요청 번호가 «있는가»로 본다 — 상태 코드 문자열을 비교하지 않는다. */
      key: 'approval',
      header: t.history.fields.approval,
      render: (row) =>
        row.approvalRequestId === null ? t.approval.notSubmitted : t.approval.submitted,
    },
  ];

  /*
   * ⛔ **오류·로딩에서도 랜드마크와 표제를 남긴다.** 조기 반환을 감싸개 «밖»에 두면 그 두
   * 상태에서 구획 이름과 제목이 접근성 트리에서 통째로 빠진다 — 화면을 소리로 읽는 사람은
   * 여기가 어디인지 알 수 없다.
   */
  const body =
    error !== null && error !== undefined ? (
      error
    ) : isLoading ? (
      <div role="status" aria-label={t.history.loading}>
        <SkeletonText lines={4} />
      </div>
    ) : (
      <Table
        density="compact"
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.goodsIssueId)}
        /*
         * ⭐ **DS 의 선택 축을 그대로 쓴다** — 한 줄만 고르므로 배열의 마지막 것을 취한다.
         * 같은 줄을 다시 누르면 빈 배열이 와서 고름이 풀린다.
         */
        selectable
        selectedIds={selectedId === null ? [] : [String(selectedId)]}
        onSelectionChange={(ids) => {
          const last = ids.at(-1);
          onSelect(last === undefined ? null : Number(last));
        }}
        empty={<EmptyState size="sm" live title={t.history.emptyTitle} />}
      />
    );

  return (
    <section className="pane" aria-label={t.panes.history}>
      <h2>{t.panes.history}</h2>

      {/* A-11 — 못 좁힌다는 사실을 «목록 위에» 적는다. 밑에 적으면 다 읽고 나서 안다. */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.history.mixedNotice}</AlertBanner>
      </div>

      {body}

      <div className="pane-block">
        <h3>{t.approval.title}</h3>
        <ApprovalBlock approval={approval} />
      </div>

      <div className="pane-block">
        <h3>{t.issue.submit}</h3>
        {/* §5-4 · J-8 — 승인이 끝나도 출고는 «여기서 다시» 누른다는 사실을 적는다. */}
        <div className="banner-slot">
          <AlertBanner variant="info">{t.issue.unlockNote}</AlertBanner>
        </div>
        <SaveErrorBanner error={post.error} />
        {post.lock !== undefined && (
          <div className="banner-slot">
            <AlertBanner variant="info">{post.lock}</AlertBanner>
          </div>
        )}
        <div className="form-actions">
          <Button disabled={post.lock !== undefined} onClick={post.onPost}>
            {t.issue.submit}
          </Button>
        </div>
      </div>
    </section>
  );
};
