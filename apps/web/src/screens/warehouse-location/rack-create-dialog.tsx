import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import {
  type components,
  createIdempotencyKey,
  type LocationRackCreate,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { LocationLevelCode, LocationLevelFields } from '../../patterns/location-level';
import { runRequest, toApiError } from '../../patterns/request';
import { issueLocationCode } from './location-code';
import { locationAliasOrCode, locationToFormValues, toLocationUpdate } from './mappers';
import { locationDetailPath, locationKeys, useLocationDetail } from './queries';
import {
  currentRackLayout,
  planRackLayout,
  planRackRemovals,
  RACK_LAYOUT_MAX_CELLS,
  RACK_LAYOUT_MAX_LEVELS,
  rackLayoutGrid,
} from './rack-layout';
import type { Location } from './types';
import { ReadOnlyField } from './warehouse-form-pane';

export interface RackCreateDialogProps {
  /** 랙을 달 구역(고칠 때는 그 랙의 구역). null 이면 닫힌다. */
  zone: Location | null;
  /** 고칠 랙 — 있으면 수정, 없으면 추가(사용자 지시 2026-10-29: 랙을 다시 누르면 층 · 셀 수를 고친다). */
  rack?: Location | null;
  warehouseId: number;
  /** 고른 창고의 위치 전체 — 쓰는 코드를 여기서 본다. */
  items: readonly Location[];
  onClose: () => void;
  /** 다 저장했을 때 — 화면이 구역과 랙을 펼친다. */
  onCreated: (zoneId: number, rackId: number) => void;
  /** 고칠 때 배치 표 아래에 두는 라벨(사용자 지시 2026-10-29). */
  labelSlot?: ReactNode;
  /** 고칠 때 랙 삭제(밑의 층 · 셀까지). */
  onDelete?: (() => void) | undefined;
}

/* 별칭(`aliasName`)은 계약 사본에 아직 없다 — 서버 #875 가 받는다. */
type LocationCreate = components['schemas']['LocationCreate'] & { aliasName: string | null };

const t = messages.warehouseLocation;

/** 서버 한도(#875) — 넘으면 400 INVALID 다. */
const ALIAS_MAX_LENGTH = 200;

/**
 * 칸에서 빠진 값(위치유형 · 혼적 허용, 사용자 지시 2026-10-29) — 서버 계약이 아직 받아 정해진 값을 싣는다.
 * 서버가 칸을 빼면(위치 ③) 함께 걷는다.
 */
const TRANSITIONAL_FIELDS = {
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
} as const;

/** 표 칸에는 코드의 끝 마디만(`C01`) — 전체 코드는 칸에 올리면 보인다. */
const lastSegment = (code: string): string => code.slice(code.lastIndexOf('-') + 1);

const parseCount = (text: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value < min || value > max ? null : value;
};

/** 실패 사유 한 줄 — 서버 문구가 있으면 그것을 쓴다. */
const failureReason = (error: unknown): string => {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'validation':
    case 'stateLocked':
      return apiError.errors[0]?.message ?? messages.httpError.title;
    case 'conflict':
      return apiError.message;
    case 'http':
      return apiError.message ?? messages.httpError.title;
    case 'network':
      return messages.httpError.offline;
  }
};

/**
 * 랙 추가 — 랙 하나와 그 밑의 층 · 셀을 함께 만든다(사용자 지시 2026-10-29). 행이 층, 열이 층마다 셀이고 표로 미리 보인다.
 *
 * 서버의 랙 한 번에 만들기(POST /mdm/locations:rack, 위치 ③)가 들어오기 전이라 랙 → 층 → 셀을 한 건씩 차례로 등록한다.
 * 중간에 실패하면 멈추고 만든 건수를 알린다. 이미 만든 랙은 기억해 두어 다시 누르면 그 랙의 남은 층 · 셀만 만든다.
 */
export const RackCreateDialog = ({
  zone,
  rack: editRack = null,
  warehouseId,
  items,
  onClose,
  onCreated,
  labelSlot,
  onDelete,
}: RackCreateDialogProps) => {
  const { client, etags } = useApiClient();
  /* 고칠 때는 별칭을 고칠 잠금 토큰(ETag)이 상세에 있다. */
  const detail = useLocationDetail(editRack?.locationId ?? null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [aliasText, setAliasText] = useState('');
  const [levelText, setLevelText] = useState('1');
  const [cellText, setCellText] = useState('1');
  /** 실패 뒤 다시 누를 때 쓰는 이미 만든 랙 — 랙을 두 번 만들지 않게. */
  const [createdRack, setCreatedRack] = useState<Location | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /* 다른 구역 · 랙으로 열면 칸을 처음 값으로 — 고칠 때는 그 랙의 지금 별칭 · 층 수 · 셀 수로 — 되돌린다. */
  const openKey =
    zone === null
      ? null
      : editRack === null
        ? `zone:${String(zone.locationId)}`
        : `rack:${String(editRack.locationId)}`;
  const current = editRack === null ? null : currentRackLayout(editRack, items);
  if (openKey !== null && openedFor !== openKey) {
    setOpenedFor(openKey);
    setAliasText(editRack?.aliasName ?? '');
    setLevelText(String(Math.max(current?.levelCount ?? 1, 1)));
    setCellText(String(Math.max(current?.cellCount ?? 1, 1)));
    setCreatedRack(editRack);
    setFailure(null);
    setProgress(null);
  }

  /* 층은 1 이상, 셀은 0 이상(0 이면 층이 맨 아래 위치) — 서버 한도(위치 ③b)와 같다. */
  const levelCount = parseCount(levelText, 1, RACK_LAYOUT_MAX_LEVELS);
  const cellCount = parseCount(cellText, 0, RACK_LAYOUT_MAX_CELLS);
  const levelError =
    levelCount === null ? t.rackLayout.countInvalid(1, RACK_LAYOUT_MAX_LEVELS) : undefined;
  const cellError =
    cellCount === null ? t.rackLayout.countInvalid(0, RACK_LAYOUT_MAX_CELLS) : undefined;
  const alias = aliasText.trim();
  const aliasError =
    alias.length > ALIAS_MAX_LENGTH ? t.validation.aliasTooLong(ALIAS_MAX_LENGTH) : undefined;

  /* 만들 랙 — 이미 만든 것이 있으면 그것, 아니면 코드를 발행한 새 랙(번호 0). */
  const rackCode =
    createdRack?.locationCode ?? (zone === null ? '' : issueLocationCode('RACK', zone, items));
  const rack: Location | null =
    zone === null
      ? null
      : (createdRack ??
        ({
          locationId: 0,
          warehouseId,
          parentLocationId: zone.locationId,
          locationCode: rackCode,
          locationName: alias === '' ? rackCode : alias,
          aliasName: alias === '' ? null : alias,
          isActive: true,
          ...TRANSITIONAL_FIELDS,
        } as Location));
  /* 이미 만든 랙이면 새로 받은 목록에서 그 밑을 본다. 새 랙이면 밑이 비어 있다. */
  const plan =
    rack === null || levelCount === null || cellCount === null
      ? []
      : planRackLayout(rack, items, levelCount, cellCount);
  /* 줄이면 넘치는 층 · 셀을 지운다 — 고칠 때만(새 랙은 밑이 비어 있다). */
  const removals =
    editRack === null || levelCount === null || cellCount === null
      ? []
      : planRackRemovals(editRack, items, levelCount, cellCount);
  const grid = rack === null ? [] : rackLayoutGrid(rack, items, plan, removals);
  const columnCount = Math.max(0, ...grid.map((row) => row.cells.length));
  /** 셀 없이 층까지만 — 층이 맨 아래 위치가 된다(서버 위치 ③b). */
  const levelOnly = cellCount === 0;
  /* 이미 있는 랙(고칠 때 · 만든 뒤 별칭에서 멈췄을 때)의 별칭이 바뀌었나. */
  const aliasChanged = createdRack !== null && alias !== (createdRack.aliasName?.trim() ?? '');
  /* 새 랙은 서버가 한 번에 만든다(+ 별칭). 고칠 때는 별칭 · 지우기 · 만들기를 하나씩. */
  const total =
    createdRack === null
      ? 1 + (alias === '' ? 0 : 1)
      : (aliasChanged ? 1 : 0) + removals.length + plan.length;
  const detailPending = editRack !== null && detail.data === undefined;
  const saving = progress !== null;
  const invalid = levelError !== undefined || cellError !== undefined || aliasError !== undefined;

  const close = () => {
    if (saving) return;
    setOpenedFor(null);
    onClose();
  };

  const post = async (
    level: LocationLevelCode,
    parentLocationId: number,
    locationCode: string,
    name: string | null,
  ): Promise<Location> => {
    /* 코드는 서버가 발행한다(위치 ③a) — 실어도 쓰지 않는다. 계약 사본이 아직 필수로 적어 미리 지은 값을 싣는다. */
    const body: LocationCreate & LocationLevelFields = {
      warehouseId,
      parentLocationId,
      locationCode,
      /* 별칭이 이름이다(사용자 지시 2026-10-29). */
      locationName: name ?? locationCode,
      aliasName: name,
      locationLevelCode: level,
      ...TRANSITIONAL_FIELDS,
    };
    return runRequest(() =>
      client.POST('/mdm/locations', {
        params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
        body,
      }),
    );
  };

  /** 별칭 고치기 — 잠금 토큰은 상세 조회가 남긴다. 새로 만든 랙은 상세를 한 번 받아 토큰을 얻는다. */
  const putAlias = async (target: Location): Promise<void> => {
    const path = locationDetailPath(target.locationId);
    const stored =
      editRack !== null && detail.data !== undefined
        ? detail.data.location
        : (
            await runRequest(() =>
              client.GET('/mdm/locations/{locationId}', {
                params: { path: { locationId: target.locationId } },
              }),
            )
          ).location;
    await runRequest(() =>
      client.PUT('/mdm/locations/{locationId}', {
        params: {
          path: { locationId: stored.locationId },
          header: {
            'Idempotency-Key': createIdempotencyKey(),
            'If-Match': etags.ifMatch(path) ?? '',
          },
        },
        body: toLocationUpdate({ ...locationToFormValues(stored), aliasName: aliasText }, stored),
      }),
    );
  };

  const save = async () => {
    if (zone === null || rack === null || invalid || levelCount === null || cellCount === null) {
      return;
    }
    setFailure(null);
    let done = 0;
    const step = () => {
      done += 1;
      setProgress({ done, total });
    };
    setProgress({ done, total });
    let target = createdRack;

    try {
      if (target === null) {
        /* 새 랙 — 랙 · 층 · 셀을 서버가 한 번에 만든다(위치 ③b). 하나라도 틀리면 하나도 안 만든다. */
        const body: LocationRackCreate = {
          parentLocationId: zone.locationId,
          levelCount,
          cellCountPerLevel: cellCount,
        };
        target = await runRequest(() =>
          client.POST('/mdm/locations:rack', {
            params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
            body,
          }),
        );
        setCreatedRack(target);
        step();
        if (alias !== '') {
          await putAlias(target);
          step();
        }
      } else {
        if (aliasChanged) {
          await putAlias(target);
          step();
        }
        /* 줄이기 — 쓰인 위치가 섞였으면 서버가 거절하고(400 STATE_LOCKED) 여기서 멈춘다. */
        for (const removal of removals) {
          await runRequest(() =>
            client.DELETE('/mdm/locations/{locationId}', {
              params: {
                path: { locationId: removal.locationId },
                header: { 'Idempotency-Key': createIdempotencyKey() },
              },
            }),
          );
          step();
        }
        const createdLevels = new Map<string, number>();
        for (const entry of plan) {
          const parentId =
            entry.kind === 'LEVEL'
              ? target.locationId
              : (entry.parentLocationId ??
                (entry.parentCode === null ? undefined : createdLevels.get(entry.parentCode)));
          if (parentId === undefined) throw new Error('parent');
          const saved = await post(entry.kind, parentId, entry.locationCode, entry.locationName);
          if (entry.kind === 'LEVEL') createdLevels.set(entry.locationCode, saved.locationId);
          step();
        }
      }
      toast.show({
        variant: 'success',
        description: editRack === null ? messages.common.created : messages.common.saved,
      });
      setProgress(null);
      setOpenedFor(null);
      onCreated(zone.locationId, target.locationId);
      onClose();
    } catch (error) {
      setFailure(t.rackLayout.stopped(done, failureReason(error)));
      setProgress(null);
    } finally {
      await queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  };

  return (
    <Dialog
      open={zone !== null}
      onClose={close}
      title={editRack === null ? t.dialog.createRackTitle : t.dialog.editRackTitle}
      size="lg"
      footer={
        <>
          {editRack !== null && onDelete !== undefined && (
            <Button variant="outlined" disabled={saving} onClick={onDelete}>
              {t.deleteLocation.confirm}
            </Button>
          )}
          <Button variant="outlined" disabled={saving} onClick={close}>
            {messages.common.cancel}
          </Button>
          <Button
            disabled={invalid || total === 0 || saving || detailPending}
            loading={saving}
            onClick={() => void save()}
          >
            {saving && progress !== null
              ? t.rackLayout.saving(progress.done, progress.total)
              : messages.common.save}
          </Button>
        </>
      }
    >
      {failure !== null && <AlertBanner variant="error" title={failure} />}
      {zone !== null && (
        <div className="rack-layout">
          <div className="form-grid">
            <ReadOnlyField label={t.fields.parentLocation} value={locationAliasOrCode(zone)} />
            <ReadOnlyField label={t.fields.locationCode} value={rackCode} />
          </div>
          <TextField
            label={t.fields.aliasName}
            value={aliasText}
            onChange={(event) => setAliasText(event.target.value)}
            disabled={saving || (editRack === null && createdRack !== null)}
            error={aliasError}
          />
          <div className="form-grid rack-layout-counts">
            <TextField
              label={t.rackLayout.levelCount}
              inputMode="numeric"
              value={levelText}
              onChange={(event) => setLevelText(event.target.value)}
              disabled={saving}
              error={levelError}
            />
            <TextField
              label={t.rackLayout.cellCount}
              inputMode="numeric"
              value={cellText}
              onChange={(event) => setCellText(event.target.value)}
              disabled={saving}
              error={cellError}
            />
          </div>
          {grid.length > 0 && (
            <div className="rack-layout-grid-wrap">
              <table className="rack-layout-grid" aria-label={t.rackLayout.previewLabel}>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="rack-layout-visually-hidden">
                        {t.rackLayout.levelHeader}
                      </span>
                    </th>
                    {Array.from({ length: levelOnly ? 0 : columnCount }, (_, index) => (
                      <th key={index} scope="col">
                        {t.rackLayout.columnHeader(index + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row) => (
                    <tr key={row.locationCode}>
                      <th scope="row">{t.rackLayout.rowHeader(row.levelNo)}</th>
                      {/* 셀이 0 이면 층이 맨 아래 위치다 — 층 자체를 칸으로 보인다. */}
                      {levelOnly && (
                        <td
                          title={row.locationCode}
                          className={
                            row.isRemoved
                              ? 'is-removed'
                              : editRack !== null && row.isNew
                                ? 'is-new'
                                : undefined
                          }
                        >
                          {lastSegment(row.locationCode)}
                        </td>
                      )}
                      {Array.from({ length: columnCount }, (_, index) => {
                        const cell = row.cells[index];
                        return cell === undefined ? (
                          <td key={index} className="is-empty" />
                        ) : (
                          <td
                            key={cell.locationCode}
                            title={cell.locationCode}
                            /* 고칠 때 새로 생길 칸 · 지울 칸을 가른다 — 추가할 때는 모두 새 칸이다. */
                            className={
                              cell.isRemoved
                                ? 'is-removed'
                                : editRack !== null && cell.isNew
                                  ? 'is-new'
                                  : undefined
                            }
                          >
                            {lastSegment(cell.locationCode)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editRack !== null && labelSlot}
        </div>
      )}
    </Dialog>
  );
};
