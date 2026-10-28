import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useId } from 'react';

import type { EquipmentChoice } from './queries';
import { WorkOrderInfo } from './work-order-info';
import type { WorkOrder } from './types';
import { sortForPick, statusKeyOf, type WorkOrderStatusKey } from './work-order-status';
import { isEmergency } from './work-order-type';

import { PopRowHead } from '../../patterns/pop-list-row';
import { PopPageNav, pageBoundaryOf, type PageMetaLike } from '../../patterns/pop-page-nav';
import { PopSelect } from '../../patterns/pop-select';

const t = messages.workStart.list;

/** 상태 하나에 색 하나(C-19). */
export const STATUS_CHIP: Readonly<Record<WorkOrderStatusKey, 'info' | 'warning' | 'idle'>> = {
  inProgress: 'info',
  suspended: 'warning',
  released: 'idle',
};

/**
 * W/O 제목 줄의 칩(C-21). 예외 칩(긴급, 설비 미지정)을 먼저, 맨 끝에 상태 칩 하나를 둔다.
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
    <>
      {isEmergency(workOrder) && (
        <Chip status="error" size="md">
          {t.emergencyBadge}
        </Chip>
      )}
      {isEquipmentUnassigned && (
        <Chip status="info" size="md">
          {t.unassignedEquipmentBadge}
        </Chip>
      )}
      {statusKey !== null && (
        <Chip status={STATUS_CHIP[statusKey]} size="md">
          {t.status[statusKey]}
        </Chip>
      )}
    </>
  );
};

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
}

/**
 * 왼쪽 작업지시 구획(T-P-S 왼쪽 대상 목록). 이 화면에서 스크롤하는 자리는 이 구획의 목록 하나다.
 *
 * - 기본 목록은 단말 설비의 작업지시다. 제목 줄 오른쪽 끝 설비 칸(팝업 선택, C-12)에서 「전체 설비」나
 *   다른 설비를 고른다. 기본이 아니면 제목과 설비 칸 사이에 [기본 설비로]가 선다. 제목 「작업지시」와
 *   설비 칸은 자리를 바꾸지 않는다(C-19, 사용자 결정 2026-10-26, PG-37, PG-39).
 * - 카드는 행 전체 터치로 고른다(C-1). 카드는 제목 줄(W/O 번호, 오른쪽 끝 상태 칩)과 정보 영역
 *   (「라벨 값」 쌍)으로 나뉜다(C-21). 두 목록에서 카드 항목은 같다(C-10, PG-14).
 * - 진행 중인 W/O를 위에 둔다. 받은 쪽 안에서만 정렬한다(서버 정렬은 계약 대기).
 * - 빈 목록은 오류가 아니다. 「받는 중」, 「없다」, 「실패」를 다른 문장으로 말한다.
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
}: WorkOrderListProps) => {
  const rows = sortForPick(workOrders ?? []);
  const scopeEquipment = equipmentName ?? t.scopeEquipmentUnknown;
  const labelId = useId();
  const other =
    typeof scope === 'number' ? otherEquipments.find((e) => e.equipmentId === scope) : undefined;
  const otherName =
    typeof scope === 'number' ? ((other?.equipmentName.trim() || other?.equipmentCode) ?? '') : '';
  /* 닫힌 칸은 이름만 보인다. 좁은 제목 줄에 「이름 (코드)」와 [선택]이 다 들어가지 않는다(PG-37). */
  const current = scope === 'default' ? scopeEquipment : scope === 'all' ? t.allOption : otherName;
  const options = [
    { value: DEFAULT_VALUE, label: t.defaultOption(equipmentText ?? scopeEquipment) },
    { value: ALL_VALUE, label: t.allOption },
    ...otherEquipments.map((equipment) => ({
      value: valueOf(equipment.equipmentId),
      label: named(equipment.equipmentName, equipment.equipmentCode),
    })),
  ];

  return (
    <section className="pane work-start-list" aria-label={t.title}>
      {/*
       * 제목 줄은 흔들리지 않는다(C-19). 제목은 왼쪽, 설비 칸은 오른쪽 끝에 고정하고, 기본 설비가
       * 아닐 때만 서는 [기본 설비로]는 그 사이에 둔다.
       */}
      <div className="work-start-list-head">
        <h2 className="pane-title">{t.title}</h2>
        {/* 좁힐 기본 설비가 없는 단말은 처음부터 전체 목록이라 설비 칸을 두지 않는다(PG-37). */}
        {!isEquipmentMissing && (
          <div className="work-start-list-controls">
            {scope !== 'default' && (
              <Button
                type="button"
                variant="outlined"
                size="lg"
                onClick={() => {
                  onScopeChange('default');
                }}
              >
                {t.resetToDefault}
              </Button>
            )}
            <div className="work-start-equipment-field">
              <span id={labelId} className="work-start-equipment-label">
                {t.equipmentLabel}
              </span>
              <PopSelect
                aria-labelledby={labelId}
                className="work-start-equipment-trigger"
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
            </div>
          </div>
        )}
      </div>

      {/* 설비를 몰라 기본 목록을 못 세운 상태는 빈 목록이 아니다. 사유와 할 일을 함께 보인다. */}
      {isEquipmentUnknown && scope === 'default' && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.equipmentUnknown}</AlertBanner>
        </div>
      )}

      {isError ? (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            action={
              <Button type="button" variant="outlined" size="sm" onClick={onRetry}>
                {t.retry}
              </Button>
            }
          >
            {t.loadError}
          </AlertBanner>
        </div>
      ) : rows.length === 0 ? (
        isLoading ? (
          <p className="field-note">{t.loading}</p>
        ) : isAsked ? (
          <p className="field-note">
            {scope === 'all'
              ? t.emptyAll
              : scope === 'default'
                ? t.empty(scopeEquipment)
                : t.emptyOther(otherName)}
          </p>
        ) : null
      ) : (
        <ul className="pop-card-list" aria-label={t.caption}>
          {rows.map((row) => {
            const isSelected = selectedId === row.workOrderId;

            return (
              <li key={String(row.workOrderId)}>
                <Card
                  interactive
                  bordered
                  surface={isSelected ? 'high' : 'low'}
                  className="work-start-card"
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
                  <Card.Body className="work-start-card-body">
                    {/* 제목 줄(C-21): W/O 번호(굵게, 고정폭)와 오른쪽 끝 칩. */}
                    <PopRowHead
                      title={<span className="work-start-wo-no">{row.workOrderNo}</span>}
                      chips={
                        <WorkOrderChips
                          workOrder={row}
                          isEquipmentUnassigned={row.plannedEquipmentId == null}
                        />
                      }
                    />
                    {/*
                     * 정보 영역(C-21). 계획 설비는 두 목록 모두 「설비 이름 (코드)」 쌍으로 보인다(C-10,
                     * PG-14). 설비가 정해지지 않은 W/O 는 「설비 미지정」 칩이 말한다.
                     */}
                    <WorkOrderInfo workOrder={row} uomCodeOf={uomCodeOf} />
                  </Card.Body>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!isError && (
        <div className="work-start-list-foot">
          {total !== undefined && total > 0 && (
            /* 건수는 관리웹 페이지 이동과 같은 「총 N건」이다. 지금 쪽은 옆 「1 / 2」가 말한다. */
            <p className="field-note">{t.total(total)}</p>
          )}
          {/* 잘렸다고 말하기만 하지 않는다. 키오스크라 주소창도 뒤로가기도 없다(#1005). */}
          <PopPageNav
            boundary={pageBoundaryOf(pageMeta)}
            label={t.pageNav}
            onChange={onPageChange}
          />
        </div>
      )}
    </section>
  );
};
