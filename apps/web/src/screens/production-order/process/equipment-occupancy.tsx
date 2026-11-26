import { messages } from '@omf-mes/i18n';
import './equipment-occupancy.css';
import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  SkeletonText,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPlantDateTime } from '../../../patterns/plant-time';
import { PageNav } from '../../../patterns/page-nav';
import type { ReferenceRow, ReferenceSource } from '../../../patterns/reference-picker';
import { useProductionPlanDetail } from '../../production-plan/queries';
import { useProductionOrderCodeNames } from '../code-names';
import { useItemCodeNames } from '../item-lookups';
import { useUomReferenceLookup } from '../reference-lookups';
import { AdjustableTable } from './adjustable-table';
import {
  allocationOverlap,
  allocationStatus,
  validAllocationWindow,
  type EquipmentAllocation,
} from './equipment-occupancy-model';
import { useEquipmentOccupancy } from './equipment-occupancy-query';

const time = (value: string | null | undefined) => formatPlantDateTime(value) ?? '미등록';
const Time = ({ value }: { value?: string | null }) => (
  <span className="erp-equipment-occupancy-time">{time(value)}</span>
);
const PlanNumber = ({ id }: { id: number }) => {
  const plan = useProductionPlanDetail(id);
  return <>{plan.data?.planNo ?? (plan.isError ? '조회 실패' : '조회 중')}</>;
};
const AllocationDetail = ({ row }: { row: EquipmentAllocation }) => {
  const items = useItemCodeNames([row.itemId]);
  const units = useUomReferenceLookup();
  const itemName = items.get(row.itemId)?.itemName ?? '조회 중';
  return (
    <section className="erp-equipment-occupancy-detail" aria-label="선택 배정 상세">
      <dl>
        <div>
          <dt>작업지시 번호</dt>
          <dd>{row.workOrderNo}</dd>
        </div>
        <div>
          <dt>품목 코드</dt>
          <dd>{row.itemCode ?? '—'}</dd>
        </div>
        <div className="wide">
          <dt>품목명</dt>
          <dd>{itemName}</dd>
        </div>
        <div>
          <dt>공정</dt>
          <dd>{row.routingOperationName ?? row.processName ?? '—'}</dd>
        </div>
        <div>
          <dt>생산량</dt>
          <dd>
            {row.orderQty.toLocaleString()}{' '}
            {units.entries.find((entry) => entry.value === String(row.uomId))?.label ?? ''}
          </dd>
        </div>
      </dl>
    </section>
  );
};

/** 팝업 칸 안 흐린 안내(사용자 지시 2026-11-26). */
const ph = messages.erpWorkOrderFlow.process.placeholders;

export const EquipmentOccupancy = ({
  equipmentId,
  selfId,
  start,
  end,
  label,
}: {
  equipmentId: number | null;
  selfId: number;
  start: string;
  end: string;
  label: string;
}) => {
  const query = useEquipmentOccupancy(equipmentId, selfId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /* 고른 배정을 다시 눌러 풀었다 — 겹치는 배정·첫 배정을 저절로 다시 고르지 않는다. */
  const [cleared, setCleared] = useState(false);
  const codeNames = useProductionOrderCodeNames();
  if (equipmentId === null) return null;
  const allRows = query.data ?? [];
  const rows = allRows.filter((row) => {
    if (
      !validAllocationWindow(start, end) ||
      !validAllocationWindow(row.plannedStartAt ?? '', row.plannedEndAt ?? '')
    )
      return true;
    const from = formatPlantDateTime(row.plannedStartAt)?.slice(0, 10) ?? '';
    const to = formatPlantDateTime(row.plannedEndAt)?.slice(0, 10) ?? '';
    return from <= end.slice(0, 10) && to >= start.slice(0, 10);
  });
  const selected = cleared
    ? undefined
    : (rows.find((row) => row.workOrderId === selectedId) ??
      rows.find((row) => allocationOverlap(row, start, end)) ??
      rows[0]);
  const columns: Column<EquipmentAllocation>[] = [
    {
      key: 'erp',
      header: 'ERP W/O',
      width: '150px',
      render: (row) => row.productionOrderNo ?? '—',
    },
    {
      key: 'plan',
      header: '계획번호',
      width: '165px',
      render: (row) => <PlanNumber id={row.productionPlanId} />,
    },
    {
      key: 'start',
      header: '배정 시작',
      width: '150px',
      render: (row) => <Time value={row.plannedStartAt} />,
    },
    {
      key: 'end',
      header: '배정 종료',
      width: '150px',
      render: (row) => <Time value={row.plannedEndAt} />,
    },
    {
      key: 'status',
      header: '상태',
      width: '95px',
      render: (row) => <Chip size="sm">{codeNames.workOrderStatus(row.statusCode)}</Chip>,
    },
    {
      key: 'overlap',
      header: '중복 시간',
      width: '190px',
      render: (row) => {
        if (!validAllocationWindow(row.plannedStartAt ?? '', row.plannedEndAt ?? ''))
          return '배정 시간 확인 필요';
        if (!validAllocationWindow(start, end)) return '계획 시간 확인 필요';
        const overlap = allocationOverlap(row, start, end);
        return overlap ? (
          <span className="erp-equipment-occupancy-time erp-equipment-conflict">
            <span>{time(overlap.start)}</span>
            <span>~ {time(overlap.end)}</span>
            <span>
              {Math.floor(overlap.minutes / 60)}시간 {overlap.minutes % 60}분
            </span>
          </span>
        ) : (
          '—'
        );
      },
    },
  ];
  return (
    <section className="erp-equipment-occupancy" aria-label="설비 배정 내역">
      <div className="erp-equipment-occupancy-heading">
        <h3>설비 배정 내역</h3>
        <p>{label}</p>
        <Chip
          size="sm"
          variant="status"
          status={
            query.isError
              ? 'error'
              : query.isFetching
                ? 'idle'
                : allocationStatus(rows, start, end) === '중복 없음'
                  ? 'success'
                  : 'warning'
          }
        >
          {query.isError
            ? '조회 실패'
            : query.isFetching
              ? '조회 중'
              : allocationStatus(rows, start, end)}
        </Chip>
      </div>
      {query.isError ? (
        <AlertBanner
          variant="error"
          title="설비 배정 내역을 조회하지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void query.refetch()}>
              다시 조회
            </Button>
          }
        />
      ) : query.isPending ? (
        <SkeletonText lines={3} />
      ) : (
        <>
          <AdjustableTable
            storageKey="omf-mes:equipment-occupancy:columns"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.workOrderId)}
            activeId={selected ? String(selected.workOrderId) : null}
            onActivate={(row) => {
              setCleared(row.workOrderId === selected?.workOrderId);
              setSelectedId(row.workOrderId);
            }}
            rowLabel={(row) => `${row.productionOrderNo ?? ''} ${row.workOrderNo} 배정 상세`}
            empty="등록된 배정이 없습니다."
          />
          {selected && <AllocationDetail row={selected} />}
        </>
      )}
    </section>
  );
};
export const EquipmentStatus = ({
  id,
  selfId,
  start,
  end,
}: {
  id: number;
  selfId: number;
  start: string;
  end: string;
}) => {
  const query = useEquipmentOccupancy(id, selfId);
  return (
    <Chip
      size="sm"
      variant="status"
      status={
        query.isError
          ? 'error'
          : query.isFetching
            ? 'idle'
            : query.data && allocationStatus(query.data, start, end) === '중복 없음'
              ? 'success'
              : 'warning'
      }
    >
      {query.isError
        ? '조회 실패'
        : query.isFetching || !query.data
          ? '조회 중'
          : allocationStatus(query.data, start, end)}
    </Chip>
  );
};
export const EquipmentAssignmentPicker = ({
  source,
  selfId,
  start,
  end,
  onClose,
  onPick,
}: {
  source: ReferenceSource;
  selfId: number;
  start: string;
  end: string;
  onClose: () => void;
  onPick: (row: ReferenceRow) => void;
}) => {
  const [keyword, setKeyword] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReferenceRow | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const result = useQuery({
    queryKey: [...source.key, 'assignment-picker', term, page],
    queryFn: () => source.search(term, page, ''),
  });
  const occupancy = useEquipmentOccupancy(selected?.id ?? null, selfId);
  const available =
    selected !== null &&
    result.isSuccess &&
    !result.isFetching &&
    result.data.items.some((row) => row.id === selected.id) &&
    occupancy.isSuccess &&
    !occupancy.isFetching &&
    allocationStatus(occupancy.data, start, end) === '중복 없음';
  const columns: Column<ReferenceRow>[] = [
    { key: 'code', header: '설비 코드', width: '140px', render: (row) => row.code },
    { key: 'name', header: '설비명', width: '220px', render: (row) => row.name },
    {
      key: 'status',
      header: '배정 상태',
      width: '230px',
      render: (row) => <EquipmentStatus id={row.id} selfId={selfId} start={start} end={end} />,
    },
  ];
  return (
    <Dialog
      open
      size="lg"
      title="설비 선택"
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            취소
          </Button>
          <Button
            loading={applying}
            disabled={!available || applying}
            onClick={async () => {
              if (!selected || !available) return;
              setApplying(true);
              setError('');
              const latest = await occupancy.refetch();
              setApplying(false);
              if (latest.isError || !latest.data) {
                setError('설비 배정 내역을 다시 확인하세요.');
                return;
              }
              if (allocationStatus(latest.data, start, end) !== '중복 없음') {
                setError('배정 내역이 변경되었습니다. 중복 시간을 확인하세요.');
                return;
              }
              onPick(selected);
            }}
          >
            선택
          </Button>
        </>
      }
    >
      <div className="erp-equipment-picker">
        <p>
          계획 시간 {time(start)} ~ {time(end)}
        </p>
        <div className="erp-equipment-picker-search">
          <div className="field-cell">
            <TextField
              label="설비 코드·설비명"
              placeholder={ph.equipmentKeyword}
              fullWidth
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setTerm(keyword.trim());
                  setPage(1);
                  setSelected(null);
                }
              }}
            />
          </div>
          <Button
            variant="outlined"
            onClick={() => {
              setTerm(keyword.trim());
              setPage(1);
              setSelected(null);
            }}
          >
            검색
          </Button>
        </div>
        {result.isError ? (
          <AlertBanner
            variant="error"
            title="설비 목록을 조회하지 못했습니다."
            action={
              <Button variant="outlined" onClick={() => void result.refetch()}>
                다시 조회
              </Button>
            }
          />
        ) : result.isPending ? (
          <SkeletonText lines={3} />
        ) : (
          <AdjustableTable
            storageKey="omf-mes:equipment-assignment-picker:columns"
            columns={columns}
            rows={result.data.items}
            getRowId={(row) => String(row.id)}
            activeId={selected ? String(selected.id) : null}
            onActivate={(row) => {
              setSelected(row.id === selected?.id ? null : row);
              setError('');
            }}
            rowLabel={(row) => `${row.code} ${row.name} 배정 내역 확인`}
            empty="조회된 설비가 없습니다."
          />
        )}
        <PageNav
          meta={{ page, size: 20, total: result.data?.total ?? 0 }}
          onChangePage={(value) => {
            setPage(value);
            setSelected(null);
          }}
        />
        {selected && (
          <EquipmentOccupancy
            key={selected.id}
            equipmentId={selected.id}
            selfId={selfId}
            start={start}
            end={end}
            label={`${selected.name} (${selected.code})`}
          />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </Dialog>
  );
};
