import { Breadcrumb, Checkbox, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { toApiError } from '../../patterns/request';
import { PAGE_SIZE } from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import { PageNav } from '../oqc-inspection/page-nav';
import { toPageView } from '../oqc-inspection/pagination';
import { useInspectionQueue } from '../oqc-inspection/queries';
import { QueueTable } from '../oqc-inspection/queue-table';
import { useDirectSubmitter } from '../pqc-panel/direct-submitter';
import { PqcPanel } from '../pqc-panel/panel';

const t = messages.pqcInspectionRegister;

/** 이 화면이 무엇인지의 정의 — 조건이 아니다. */
const PQC = 'PQC';

/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107 · 설계보다 앞선 화면, 서버 장부 P-51).
 *
 * 좌 검사 의뢰 목록 / 우 검사 입력. 우측은 POP 생산 실적 분할 화면과 **같은 패널**(`pqc-panel`)이다 —
 * 현장과 사무실이 같은 규칙으로 판정한다. 다른 점은 저장 길뿐이다: 여기는 계정 세션으로 바로 보낸다.
 *
 * ⚠ 목록 표·쪽 넘김·대기 목록 질의는 W-04-03(OQC)의 것을 쓴다 — 검사 유형만 다르다.
 */
export const PqcInspectionRegisterScreen = () => {
  const [pendingOnly, setPendingOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const submitter = useDirectSubmitter();

  const queue = useInspectionQueue({ inspectionTypeCode: PQC, pendingOnly, page, size: PAGE_SIZE });
  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : (
    <p className="field-note">{t.queue.empty}</p>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      <div className="two-pane">
        <section className="pane" aria-label={t.queue.heading}>
          <Checkbox
            checked={pendingOnly}
            onChange={(event) => {
              /* 조건이 바뀌면 결과가 통째로 달라진다 — 첫 쪽으로 가고 고른 것을 놓는다. */
              setPendingOnly(event.target.checked);
              setPage(1);
              setSelectedId(null);
            }}
          >
            {t.queue.pendingOnly}
          </Checkbox>

          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <QueueTable
            caption={t.queue.caption}
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            empty={emptyContent}
          />

          {queue.data !== undefined && (
            <PageNav
              view={pageView}
              onChange={(next) => {
                setSelectedId(null);
                setPage(next);
              }}
            />
          )}
        </section>

        <section className="pane" aria-label={t.detail.paneLabel}>
          {selectedId === null ? (
            <p className="field-note">{t.detail.nothingSelected}</p>
          ) : (
            <PqcPanel
              /* 의뢰마다 새로 세운다 — 앞 의뢰의 입력이 다음 의뢰에 남지 않게. */
              key={selectedId}
              inspectionRequestId={selectedId}
              submitter={submitter}
              workerNo={null}
              requiresWorker={false}
              withKeypad={false}
              variant="web"
            />
          )}
        </section>
      </div>
    </>
  );
};
