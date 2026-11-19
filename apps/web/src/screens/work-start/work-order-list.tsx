import { messages, named } from '@omf-mes/i18n';
import { useId, useState, type RefObject } from 'react';

import type { EquipmentChoice } from './queries';
import { WorkOrderInfo } from './work-order-info';
import type { WorkOrder } from './types';
import { sortForPick, statusKeyOf, type WorkOrderStatusKey } from './work-order-status';
import { isEmergency, isRework, pinEmergencyFirst } from './work-order-type';

import { type PageMetaLike } from '../../patterns/pop-page-nav';
import { ListOrderFoot, type ListOrder } from '../../patterns/pop-list-order';
import { PopSelect } from '../../patterns/pop-select';
import {
  PuButton,
  PuChip,
  PuCount,
  PuEmpty,
  PuField,
  PuNote,
  PuPager,
  PuSection,
  PuSeg,
  type PuChipTone,
} from '../../patterns/pop-uniform';

const t = messages.workStart.list;

/** 상태 하나에 색 하나(POP 통일 규칙 10): 진행 중 파랑 · 중단 노랑 · 미착수 회색. */
export const STATUS_CHIP: Readonly<Record<WorkOrderStatusKey, PuChipTone>> = {
  inProgress: 'info',
  suspended: 'warn',
  released: 'idle',
};

/**
 * W/O 제목 줄의 칩(C-21). 예외 칩(긴급, 재작업, 설비 미지정)을 먼저, 맨 끝에 상태 칩 하나를 둔다.
 * 목록 카드와 「선택한 작업지시」가 같은 칩을 쓴다.
 */
export const WorkOrderChips = ({
  workOrder,
  isEquipmentUnassigned,
}: {
  workOrder: WorkOrder;
  isEquipmentUnassigned: boolean;
}) => {
  const statusKey = statusKeyOf(workOrder);

  return (
    <span className="chips">
      {isEmergency(workOrder) && <PuChip tone="bad">{t.emergencyBadge}</PuChip>}
      {isRework(workOrder) && <PuChip tone="warn">{t.reworkBadge}</PuChip>}
      {isEquipmentUnassigned && <PuChip tone="info">{t.unassignedEquipmentBadge}</PuChip>}
      {statusKey !== null && <PuChip tone={STATUS_CHIP[statusKey]}>{t.status[statusKey]}</PuChip>}
    </span>
  );
};

/**
 * 목록 보기(#295). `emergency` 는 긴급 작업지시만 — 옛 「긴급 작업지시」 화면(P-02-12)과 같은 조건(설비 축 없음)이다.
 * 주소 `?type=emergency` 로 열 수 있다(옛 주소가 이리로 온다).
 */
export type ListKind = 'all' | 'emergency';

/** 목록의 설비 범위(PG-37). */
export type ListScope = 'default' | 'all' | number;

const DEFAULT_VALUE = 'default';
const ALL_VALUE = 'all';
const valueOf = (scope: ListScope): string =>
  scope === 'default' ? DEFAULT_VALUE : scope === 'all' ? ALL_VALUE : `equipment-${String(scope)}`;

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined`. 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 목록을 물었는가. 설비를 몰라 조회를 열지 않은 상태와 「없다」를 가른다. */
  isAsked: boolean;
  isLoading: boolean;
  isError: boolean;
  /** 필터 전체 건수. */
  total: number | undefined;
  /** 받은 쪽 정보. 쪽 넘김이 이 값으로 선다(#1005). */
  pageMeta: PageMetaLike | undefined;
  onPageChange: (page: number) => void;
  /** 지금 목록의 설비 범위. `default` 는 단말 설비, `all` 은 전체 설비, 숫자는 고른 다른 설비. */
  scope: ListScope;
  /**
   * 단말 설비의 이름(없으면 코드). 설비 칸과 빈 목록 문구가 「이 설비」 대신 이 이름을 쓴다(사용자
   * 결정 2026-10-23). 모르면 `null`.
   */
  equipmentName: string | null;
  /** 단말 설비 「이름 (코드)」. 팝업의 기본 설비 줄에 쓴다. 모르면 `null`. */
  equipmentText?: string | null;
  /** 팝업에 늘어놓을 다른 설비(단말 설비 제외). 받지 못했으면 빈 배열이다. */
  otherEquipments?: readonly EquipmentChoice[];
  /** 단말에 설비가 매핑되지 않았는가. 좁힐 기본 설비가 없어 설비 칸을 두지 않는다. */
  isEquipmentMissing?: boolean;
  /** 설비를 몰라 기본 목록을 세우지 못했는가. */
  isEquipmentUnknown: boolean;
  selectedId: number | null;
  onSelect: (workOrder: WorkOrder) => void;
  /** 설비 칸에서 고르거나 [기본 설비로]를 눌렀다. */
  onScopeChange: (scope: ListScope) => void;
  /** 설비 팝업을 연다. 다른 설비 목록은 이때 처음 묻는다. */
  onEquipmentPickerOpen?: () => void;
  onRetry: () => void;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
  /** 한 쪽 건수를 재는 목록 칸(구획 높이에 들어가는 만큼, POP 통일 규칙 1). */
  fitRef?: RefObject<HTMLDivElement | null>;
  /** 목록 정렬(계획 시작 일시 · 서버 정렬). 긴급·진행 중 먼저는 받은 쪽 안에서 그대로 둔다. */
  order?: ListOrder;
  onOrderChange?: (order: ListOrder) => void;
  /** 지금 보기 — 전체 / 긴급(#295). */
  kind?: ListKind;
  /** 열린 긴급 작업지시 수(「긴급 N」). 모르면 `undefined` 이고 수를 붙이지 않는다. */
  emergencyCount?: number;
  onKindChange?: (kind: ListKind) => void;
}

/**
 * 왼쪽 작업지시 구획(POP 통일 시안 P-02-01). 구획 안 스크롤이 없다 — 구획 높이에 들어가는 만큼만
 * 받아 보이고 아래 「총 N건 ‹ 1 / 3 ›」으로 넘긴다.
 *
 * - 기본 목록은 단말 설비의 작업지시다. 목록 위 설비 칸(선택 창)에서 「전체 설비」나 다른 설비를
 *   고른다. 기본이 아니면 칸 옆에 [기본 설비로]가 선다(PG-37).
 * - 카드는 행 전체 터치로 고른다(C-1). 제목 줄(W/O 번호, 오른쪽 끝 칩)과 정보(「라벨 값」 쌍).
 * - 서버가 계획 시작 일시로 [최신순 | 오래된순] 줄 세운 쪽에서 진행 중인 W/O를 위에 둔다(받은 쪽 안에서).
 * - 빈 목록은 오류가 아니다. 「받는 중」, 「없다」, 「실패」를 다른 문장으로 말한다.
 * - 제목 줄 끝 [|<]로 왼쪽으로 접는다(접으면 오른쪽 구획이 넓어진다).
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  isError,
  total,
  pageMeta,
  onPageChange,
  scope,
  equipmentName,
  equipmentText = null,
  otherEquipments = [],
  isEquipmentMissing = false,
  isEquipmentUnknown,
  selectedId,
  onSelect,
  onScopeChange,
  onEquipmentPickerOpen,
  onRetry,
  uomCodeOf,
  fitRef,
  order = 'newest',
  onOrderChange,
  kind = 'all',
  emergencyCount,
  onKindChange,
}: WorkOrderListProps) => {
  /*
   * 순서: 서버가 계획 시작 일시로 [최신순 | 오래된순] 줄 세워 준 쪽에서(사용자 지시 2026-11-19), 진행 중을 먼저 두고
   * 맨 끝에 긴급을 위로 올린다. 둘 다 안정 정렬이라 같은 묶음 안은 고른 정렬 그대로다. 긴급은 늘 위다(#295).
   */
  const rows = pinEmergencyFirst(sortForPick(workOrders ?? []));
  const isEmergencyView = kind === 'emergency';
  const scopeEquipment = equipmentName ?? t.scopeEquipmentUnknown;
  const labelId = useId();
  const [folded, setFolded] = useState(false);
  const other =
    typeof scope === 'number' ? otherEquipments.find((e) => e.equipmentId === scope) : undefined;
  const otherName =
    typeof scope === 'number' ? ((other?.equipmentName.trim() || other?.equipmentCode) ?? '') : '';
  /* 닫힌 칸은 이름만 보인다(PG-37). */
  const current = scope === 'default' ? scopeEquipment : scope === 'all' ? t.allOption : otherName;
  const options = [
    { value: DEFAULT_VALUE, label: t.defaultOption(equipmentText ?? scopeEquipment) },
    { value: ALL_VALUE, label: t.allOption },
    ...otherEquipments.map((equipment) => ({
      value: valueOf(equipment.equipmentId),
      label: named(equipment.equipmentName, equipment.equipmentCode),
    })),
  ];
  const pageTotal = pageMeta?.total ?? total ?? 0;
  const pageSize = Math.max(1, pageMeta?.size ?? 1);
  const pages = Math.max(1, Math.ceil(pageTotal / pageSize));
  const hasRows = !isError && rows.length > 0;

  return (
    <PuSection
      title={t.title}
      head={
        /* 제목 옆 보기 탭 [전체 | 긴급 N](#295). 긴급 수는 옛 「긴급 작업지시」 탭 건수와 같다. */
        <PuSeg<ListKind>
          label={t.kindLabel}
          value={kind}
          onChange={(next) => {
            if (next !== kind) onKindChange?.(next);
          }}
          options={[
            { value: 'all', label: t.kindAll },
            {
              value: 'emergency',
              label: (
                <>
                  {t.kindEmergency}
                  {emergencyCount !== undefined && <PuCount>{emergencyCount}</PuCount>}
                </>
              ),
            },
          ]}
        />
      }
      className="ws-list"
      bodyClassName="ws-list-body"
      fold={{ label: t.title, folded, onChange: setFolded }}
    >
      {/*
       * 긴급 보기는 설비와 관계없이 다 보인다(옛 화면 조건) — 설비 칸 대신 그 사실을 한 줄로 말한다.
       * 좁힐 기본 설비가 없는 단말은 처음부터 전체 목록이라 설비 칸을 두지 않는다(PG-37).
       */}
      {isEmergencyView ? (
        <PuNote>
          <span className="ws-oneline" title={t.emergencyScope}>
            {t.emergencyScope}
          </span>
        </PuNote>
      ) : !isEquipmentMissing ? (
        <PuField label={t.equipmentLabel} labelId={labelId}>
          <div className="pu-row ws-equipment-field">
            <PopSelect
              aria-labelledby={labelId}
              className="ws-equipment-trigger"
              options={options}
              value={valueOf(scope)}
              actionLabel={current}
              hideValue
              onClick={() => onEquipmentPickerOpen?.()}
              onChange={(value) => {
                if (value === DEFAULT_VALUE) onScopeChange('default');
                else if (value === ALL_VALUE) onScopeChange('all');
                else onScopeChange(Number(value.replace('equipment-', '')));
              }}
            />
            {scope !== 'default' && (
              <PuButton
                onClick={() => {
                  onScopeChange('default');
                }}
              >
                {t.resetToDefault}
              </PuButton>
            )}
          </div>
        </PuField>
      ) : (
        <span />
      )}

      <div className="ws-list-area">
        {/* 설비를 몰라 기본 목록을 못 세운 상태는 빈 목록이 아니다. 사유와 할 일을 함께 보인다. */}
        {!isEmergencyView && isEquipmentUnknown && scope === 'default' && (
          <PuNote tone="warn">{t.equipmentUnknown}</PuNote>
        )}

        {isError ? (
          <PuNote
            tone="bad"
            action={
              <PuButton size="sm" onClick={onRetry}>
                {t.retry}
              </PuButton>
            }
          >
            {t.loadError}
          </PuNote>
        ) : rows.length === 0 ? (
          isLoading ? (
            <PuEmpty icon="list" title={t.loading} />
          ) : isAsked ? (
            isEmergencyView ? (
              <PuEmpty icon="list" title={t.emergencyEmpty} hint={t.emergencyEmptyHint} />
            ) : scope === 'all' ? (
              <PuEmpty icon="list" title={t.emptyAll} />
            ) : scope === 'default' ? (
              <PuEmpty icon="list" title={t.empty(scopeEquipment)} hint={t.emptyHint} />
            ) : (
              <PuEmpty icon="list" title={t.emptyOther(otherName)} />
            )
          ) : null
        ) : null}

        {/*
         * 한 쪽 건수를 재는 칸 — 늘 그려 두고 줄이 없을 때만 감춘다(높이 0 이면 재지 않는다).
         * ⛔ 빈 안내를 이 칸 안에 넣지 않는다 — 그 높이를 줄 높이로 재 버린다.
         */}
        <div
          ref={fitRef}
          className="pu-list pu-fit ws-list-rows"
          role="list"
          aria-label={t.caption}
          style={hasRows ? undefined : { display: 'none' }}
        >
          {hasRows &&
            rows.map((row) => {
              const isSelected = selectedId === row.workOrderId;

              return (
                <div key={String(row.workOrderId)} role="listitem" className="ws-list-cell">
                  <button
                    type="button"
                    className={isSelected ? 'pu-item ws-item is-selected' : 'pu-item ws-item'}
                    aria-label={t.select(row.workOrderNo)}
                    aria-pressed={isSelected}
                    /*
                     * 사번이 없어도 고른다. 누른 것을 무시하지 않고, 화면이 사번 입력 창을 함께 연다
                     * (사용자 결정 2026-10-23, PG-27).
                     */
                    onClick={() => {
                      onSelect(row);
                    }}
                  >
                    <span className="pu-item-top">
                      <span className="no">{row.workOrderNo}</span>
                      <WorkOrderChips
                        workOrder={row}
                        isEquipmentUnassigned={row.plannedEquipmentId == null}
                      />
                    </span>
                    <WorkOrderInfo workOrder={row} uomCodeOf={uomCodeOf} />
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* 잘렸다고 말하기만 하지 않는다. 키오스크라 주소창도 뒤로가기도 없다(#1005). */}
      <ListOrderFoot
        order={order}
        onOrder={(next) => {
          if (next !== order) onOrderChange?.(next);
        }}
        showOrder={hasRows}
      >
        {!isError && pageMeta !== undefined ? (
          <PuPager
            total={pageTotal}
            page={pageMeta.page}
            pages={pages}
            label={t.pageNav}
            onPage={onPageChange}
          />
        ) : null}
      </ListOrderFoot>
    </PuSection>
  );
};
