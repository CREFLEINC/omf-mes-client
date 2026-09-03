import { Button, Chip, EmptyState, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  DONE_STATUS,
  formatMoment,
  HANDLING_STATUS,
  occurrenceLabel,
  statusLabel,
  type BreakdownReportView,
} from './types';

const t = messages.equipmentFailure;

/** 상태의 무게를 표식으로 보인다. 완료는 잦아든 것, 접수는 아직 아무도 손대지 않은 것이다. */
const statusTone = (code: string): 'idle' | 'info' | 'error' => {
  if (code === DONE_STATUS) return 'idle';
  if (code === HANDLING_STATUS) return 'info';

  return 'error';
};

const optional = (value: string | null): string =>
  value === null || value.trim() === '' ? t.table.notAvailable : value;

export interface FailureTableProps {
  rows: BreakdownReportView[];
  selectedId: number | null;
  isLoading: boolean;
  isBeyondLast: boolean;
  onSelect: (breakdownId: number) => void;
  onFirstPage: () => void;
}

/**
 * 고장 목록 — **적체를 보는 자리**다.
 *
 * 기본 조회가 미처리 전건이고 정렬이 경과일 긴 순이라, 위에 있는 것이 곧 가장 오래 밀린 것이다.
 *
 * ⭐ **열을 셋으로 묶는다.** 2단 배치의 왼쪽 칸은 좁아서 값마다 열을 하나씩 주면 표가 폭을
 * 넘겨 **뒤쪽 열이 통째로 잘린다**(브라우저 확인에서 넷이 화면 밖으로 나갔다). 짝지어 읽는 값
 * (고장번호+설비 · 보고시각+상태)을 한 칸에 쌓으면 같은 정보가 좁은 폭에 들어온다.
 *
 * ⛔ **쌓는 칸에만 `.stacked-cell`을 쓴다** — 그 클래스는 줄마다 줄바꿈을 막아 **문장을 잘라
 * 내므로** 증상 칸에는 쓰지 않는다(배치 규범이 문장에 쓰지 말라고 못 박았다).
 *
 * ⭐ **줄을 눌러 상세를 연다.** 처리 내역·사진·연결된 비가동은 상세 응답에서만 오므로, 목록
 * 줄로는 그것들을 그릴 수 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FailureTable = ({
  rows,
  selectedId,
  isLoading,
  isBeyondLast,
  onSelect,
  onFirstPage,
}: FailureTableProps) => {
  const columns: Column<BreakdownReportView>[] = [
    {
      key: 'breakdown',
      header: t.table.breakdownNo,
      /*
       * ⭐ 고른 줄을 `aria-current`로 표시한다. 색만 다르게 두면 보조 기술로 읽는 사람에게는
       * 어느 줄이 열려 있는지가 전해지지 않는다 — 새 클래스를 만들지 않고 의미로 표시한다.
       */
      render: (row) => (
        <span className="stacked-cell">
          {/*
           * ⛔ 버튼을 `span`으로 감싼다. `.stacked-cell`의 줄바꿈 금지는 **직계 `span`**에만
           * 걸려, 감싸지 않으면 고장 번호가 하이픈 뒤에서 갈린다 — 「MLF-2026-」과 「0088」로
           * 갈리면 다른 번호로 읽힌다. 그 클래스가 막으려던 바로 그 형태다.
           */}
          <span>
            <button
              type="button"
              className="link-cell"
              aria-current={row.breakdownId === selectedId ? 'true' : undefined}
              onClick={() => {
                onSelect(row.breakdownId);
              }}
            >
              {optional(row.breakdownNo)}
            </button>
          </span>
          <span>{optional(row.equipmentCode)}</span>
        </span>
      ),
    },
    { key: 'symptom', header: t.table.symptom, render: (row) => row.symptom },
    {
      key: 'reported',
      header: t.table.reportedAt,
      render: (row) => (
        <span className="stacked-cell">
          <span>{formatMoment(row.reportedAt)}</span>
          <span>
            <Chip size="sm" status={statusTone(row.statusCode)}>
              {statusLabel(row.statusCode)}
            </Chip>
            {/* 발생 상태는 상태 표식 옆에 붙인다 — 둘 다 「지금 어떤가」를 말한다. */}
            {` ${occurrenceLabel(row.occurrenceStateCode)}`}
          </span>
        </span>
      ),
    },
  ];

  if (isLoading) return <Skeleton variant="rect" height="12rem" />;

  if (isBeyondLast) {
    return (
      <EmptyState
        size="sm"
        live
        title={t.table.beyondLastTitle}
        description={t.table.beyondLast}
        action={
          <Button variant="outlined" onClick={onFirstPage}>
            {t.table.firstPage}
          </Button>
        }
      />
    );
  }

  /* ⛔ `.wide-table`로 감싸지 않는다 — 좁은 칸에 최소 폭을 주면 뒤쪽 열이 화면 밖으로 나간다. */
  return (
    <Table
      caption={<span className="equipment-failure-table-caption">{t.panes.list}</span>}
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.breakdownId)}
      density="compact"
      empty={<EmptyState size="sm" live title={t.table.emptyTitle} description={t.table.empty} />}
    />
  );
};
