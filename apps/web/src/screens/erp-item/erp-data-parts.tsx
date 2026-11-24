import { Button, type Column, EmptyState, Icon, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';

/**
 * ERP 수신 데이터 조회 화면 8개(공통코드 · 품목 · BOM · 생산오더 · 구매발주 · 수주 · 거래처 · 사원)가 함께 쓰는 작은 부품
 * (omf-all-around#358). 공용 패턴을 새로 만들지 않고 이 화면 폴더에 둔다 — 다른 erp 화면이 여기서 가져다 쓴다.
 */

/** 8개 화면이 같은 좌우 · 상하 배치를 쓴다 — 한 화면에서 고르면 다른 화면도 같은 배치로 열린다. */
export const ERP_DATA_ORIENTATION_KEY = 'omf-mes:erp-data:split-orientation';

/**
 * 조회 조건 줄 오른쪽 끝의 [조회][초기화]. 조회는 감싼 form 을 제출한다.
 * 초기화는 조건이 처음 값과 다를 때만 보인다(`showReset` — 공용 `hasChangedFilters` 판정).
 */
export const ErpFilterActions = ({
  onReset,
  showReset,
}: {
  onReset: () => void;
  showReset: boolean;
}) => (
  <div className="filter-actions field-cell-unlabeled">
    <Button type="submit">{messages.common.search}</Button>
    {showReset && (
      <Button variant="outlined" onClick={onReset}>
        {messages.common.reset}
      </Button>
    )}
  </div>
);

export interface ErpListTableProps<T> {
  /** 표 이름(보이지 않는 caption). */
  label: string;
  /** 열 폭 · 순서를 남기는 열쇠 앞머리 — 표마다 다르게. */
  storageKey: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** 줄 고르기. 고르는 단추는 `columnKey` 열(없으면 첫 열)의 칸을 감싼다. */
  pick?: {
    currentId: string | null;
    onPick: (row: T) => void;
    /** 이미 고른 줄을 다시 누르면 부른다 — 고르기를 푼다. 없으면 `onPick` 을 다시 부른다. */
    onUnpick?: () => void;
    columnKey?: string;
  };
  empty?: ReactNode;
  className?: string;
}

const cellText = <T,>(row: T, key: string): ReactNode => {
  const value = (row as Record<string, unknown>)[key];
  return value === null || value === undefined ? '' : String(value as string | number);
};

/**
 * 목록 표 — 열 폭 끌기 · 열 순서 바꾸기 · 상자 폭 맞추기(기준 화면 「단말 관리」와 같은 세 훅). 줄 아무 곳이나 눌러 고른다 —
 * DS 표에 줄 누름이 없어 눌린 줄 안의 고르는 단추로 넘긴다.
 */
export const ErpListTable = <T,>({
  label,
  storageKey,
  columns,
  rows,
  getRowId,
  pick,
  empty,
  className,
}: ErpListTableProps<T>) => {
  const pickKey = pick === undefined ? undefined : (pick.columnKey ?? columns[0]?.key);
  const picked =
    pick === undefined
      ? columns
      : columns.map((column): Column<T> =>
          column.key !== pickKey
            ? column
            : {
                ...column,
                render: (row, index) => {
                  const id = getRowId(row);
                  return (
                    <button
                      type="button"
                      className="users-roles-row-pick"
                      aria-current={pick.currentId === id ? 'true' : undefined}
                      onClick={() => {
                        if (pick.currentId === id && pick.onUnpick !== undefined) pick.onUnpick();
                        else pick.onPick(row);
                      }}
                    >
                      {column.render?.(row, index) ?? cellText(row, column.key)}
                    </button>
                  );
                },
              },
        );
  const ordered = useColumnOrder(`${storageKey}:order`, picked);
  const resizable = useColumnWidths(storageKey, ordered);
  const fit = useFitColumns(resizable.columns);

  return (
    <div
      ref={fit.ref}
      className={`users-roles-list inspection-queue-table erp-data-list${className === undefined ? '' : ` ${className}`}`}
      style={resizable.style}
      onClick={(event) => {
        if (pick === undefined) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('button, a, input, select, textarea') !== null) return;
        target
          .closest('tbody tr')
          ?.querySelector<HTMLButtonElement>('.users-roles-row-pick')
          ?.click();
      }}
    >
      <Table
        density="compact"
        caption={<span className="erp-data-table-caption">{label}</span>}
        columns={fit.columns}
        rows={rows}
        getRowId={getRowId}
        {...(empty === undefined ? {} : { empty })}
      />
    </div>
  );
};

/** 상세 상자의 빈 상태 — 기준 화면과 같은 원 안 아이콘 + 제목 + 설명 한 줄. */
export const ErpPickEmpty = ({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) => (
  <EmptyState
    size="sm"
    className="users-roles-pick-empty"
    icon={
      <span className="inspection-standard-empty-icon">
        <Icon name={icon} size={20} />
      </span>
    }
    title={title}
    {...(description === undefined ? {} : { description })}
  />
);

export interface ErpDetailField {
  key: string;
  label: string;
  value: ReactNode;
}

/** 고른 줄의 모든 칸을 「이름 : 값」 읽기 전용으로. */
export const ErpDetailFields = ({
  title,
  fields,
}: {
  title: string;
  fields: readonly ErpDetailField[];
}) => (
  <div className="erp-data-detail">
    <h2 className="pane-title">{title}</h2>
    <dl className="erp-data-detail-fields">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);
