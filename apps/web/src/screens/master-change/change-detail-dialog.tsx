import { DiffRow, Dialog, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toDiffEntries } from './diff-entries';
import { formatDateTime } from './event-format';
import type { AuditEventView } from './types';

const t = messages.masterChange;

export interface ChangeDetailDialogProps {
  /**
   * 창이 가리키는 건. `null`이면 **아무것도 렌더하지 않는다** —
   * 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남으므로 열 때만 마운트한다.
   */
  row: AuditEventView | null;
  onClose: () => void;
}

interface DetailItem {
  label: string;
  value: string;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): string => value ?? t.values.empty;

const toItems = (row: AuditEventView): DetailItem[] => [
  { label: t.table.occurredAt, value: orEmptyMark(formatDateTime(row.occurredAt)) },
  { label: t.table.targetType, value: row.targetTypeCode },
  { label: t.table.targetId, value: String(row.targetId) },
  { label: t.table.eventType, value: row.eventTypeCode },
  {
    label: t.table.performedBy,
    // 번호를 그대로 낸다 — 이름을 줄 경로가 계약에 없어 화면이 표시명을 만들 수 없다.
    value: orEmptyMark(row.performedBy === null ? null : String(row.performedBy)),
  },
  { label: t.fields.correlationId, value: orEmptyMark(row.correlationId) },
  { label: t.diff.terminalId, value: orEmptyMark(row.terminalId === null ? null : String(row.terminalId)) },
  { label: t.diff.auditEventId, value: String(row.auditEventId) },
  /*
   * 사유는 **읽기만 한다.** 이슈가 금지한 것은 입력이며, 응답에 실려 온 값을 감추라는 뜻이 아니다.
   * 이 창에 입력칸·저장 수단을 두지 않는다.
   */
  { label: t.diff.reason, value: orEmptyMark(row.reason) },
];

/**
 * 변경 내용 창 — 한 건이 **무엇에서 무엇으로** 바뀌었는지 항목별로 보이는 자리.
 *
 * **창을 열 때 요청을 보내지 않는다.** 전후 값이 목록 응답에 이미 들어 있고,
 * 계약에 상세 조회 경로 자체가 없다.
 *
 * 「행 펼침」이 아니라 창으로 내는 이유는 디자인 시스템 `Table`에 확장 행 prop이 없기 때문이다.
 * 열 하나에 밀어 넣으면 전후 비교가 한 칸 폭에 눌리고, 내부 클래스를 겨냥해 행을 끼우는 것은
 * 배치 규범이 금지한다.
 *
 * 파괴적 조작이 아니므로 바깥 어둠 클릭으로 닫힌다 — 읽기만 하는 창이라 잘못 닫혀도 잃을 것이 없다.
 */
export const ChangeDetailDialog = ({ row, onClose }: ChangeDetailDialogProps) => {
  if (row === null) return null;

  const entries = toDiffEntries(row.beforeValue, row.afterValue);

  const diffBody = (): ReactNode => {
    /*
     * 계약이 예시를 일부러 두지 않아 전후 값이 비어 오는 경우가 실제로 있다.
     * 빈 표를 내거나 값을 지어내지 않고 받지 못했다는 사실을 밝힌다.
     */
    if (entries.length === 0) {
      return (
        <EmptyState
          size="sm"
          title={t.diff.noValuesTitle}
          description={t.diff.noValuesDescription}
        />
      );
    }

    return entries.map((entry) => (
      <DiffRow
        key={entry.key}
        // 받은 키 이름이 곧 라벨이다. 디자인 시스템이 이 문자열을 group의 접근 이름으로도 쓴다.
        label={entry.key}
        before={entry.before}
        after={entry.after}
        changed={entry.changed}
        /* 디자인 시스템 기본값 「(없음)」을 쓰지 않는다 — 한 화면에 빈 값 표기가 둘이면 뜻이 갈린다. */
        emptyText={t.values.empty}
      />
    ));
  };

  return (
    <Dialog open onClose={onClose} title={t.diff.title} size="lg">
      <div className="form-grid">
        {toItems(row).map((item) => (
          <div className="field-cell" key={item.label}>
            <span className="field-label">{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>

      {diffBody()}
    </Dialog>
  );
};
