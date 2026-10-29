import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import { type components, createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { LocationLevelFields } from '../../patterns/location-level';
import { runRequest, toApiError } from '../../patterns/request';
import { locationShownName } from './mappers';
import { locationKeys } from './queries';
import {
  currentRackLayout,
  planRackLayout,
  RACK_LAYOUT_MAX_CELLS,
  RACK_LAYOUT_MAX_LEVELS,
  type RackLayoutEntry,
} from './rack-layout';
import type { Location } from './types';

export interface RackLayoutDialogProps {
  /** null 이면 닫힌다. */
  rack: Location | null;
  warehouseId: number;
  /** 고른 창고의 위치 전체 — 있는 층 · 셀과 쓰는 코드를 여기서 본다. */
  items: readonly Location[];
  onClose: () => void;
}

/* 별칭(`aliasName`)은 계약 사본에 아직 없다 — 서버 #875 가 받는다. */
type LocationCreate = components['schemas']['LocationCreate'] & { aliasName: string | null };

const t = messages.warehouseLocation;

/** 미리보기에 늘어놓는 코드 수 — 넘으면 「외 N건」. */
const PREVIEW_LIMIT = 12;

const parseCount = (text: string, max: number): number | null => {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value > max ? null : value;
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
 * 랙의 층 · 셀 설정 — 층 수와 층마다 셀 수를 받아 모자란 위치를 한꺼번에 만든다.
 *
 * 서버의 한꺼번에 만들기(POST /mdm/locations:bulk)가 들어오기 전이라 한 건씩 차례로 등록한다. 중간에 실패하면 멈추고
 * 만든 건수를 알린다 — 다시 저장하면 새로 받은 목록으로 계획을 다시 세워 남은 것만 만든다.
 */
export const RackLayoutDialog = ({ rack, warehouseId, items, onClose }: RackLayoutDialogProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const current = rack === null ? null : currentRackLayout(rack, items);
  const [levelText, setLevelText] = useState('');
  const [cellText, setCellText] = useState('');
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /* 다른 랙으로 열면 칸을 그 랙의 지금 값으로 채운다. */
  if (rack !== null && current !== null && openedFor !== rack.locationId) {
    setOpenedFor(rack.locationId);
    setLevelText(String(Math.max(current.levelCount, 1)));
    setCellText(String(Math.max(current.cellCount, 1)));
    setFailure(null);
    setProgress(null);
  }

  const levelCount = parseCount(levelText, RACK_LAYOUT_MAX_LEVELS);
  const cellCount = parseCount(cellText, RACK_LAYOUT_MAX_CELLS);
  const levelError =
    levelCount === null
      ? t.rackLayout.countInvalid(RACK_LAYOUT_MAX_LEVELS)
      : current !== null && levelCount < current.levelCount
        ? t.rackLayout.cannotShrink(current.levelCount)
        : undefined;
  const cellError =
    cellCount === null ? t.rackLayout.countInvalid(RACK_LAYOUT_MAX_CELLS) : undefined;
  const plan =
    rack === null || levelCount === null || cellCount === null || levelError !== undefined
      ? []
      : planRackLayout(rack, items, levelCount, cellCount);
  const newLevels = plan.filter((entry) => entry.kind === 'LEVEL').length;
  const newCells = plan.length - newLevels;
  const saving = progress !== null;

  const close = () => {
    if (saving) return;
    setOpenedFor(null);
    onClose();
  };

  const create = async (entry: RackLayoutEntry, parentLocationId: number): Promise<number> => {
    if (rack === null) throw new Error('rack');
    /* 단계는 서버가 정하지만 보내면 맞춰 본다(P-154) — 어긋나면 400 으로 알 수 있게 싣는다. */
    const body: LocationCreate & LocationLevelFields = {
      warehouseId,
      parentLocationId,
      locationCode: entry.locationCode,
      /* 별칭이 이름이다(사용자 지시 2026-10-29). 위치명은 서버가 아직 필수로 받아 같은 값을 싣는다. */
      locationName: entry.locationName,
      aliasName: entry.locationName,
      locationLevelCode: entry.kind,
      /* 층 · 셀은 랙의 형태 · 혼적 허용을 그대로 물려받는다. */
      locationTypeCode: rack.locationTypeCode,
      allowMixedItem: rack.allowMixedItem,
      allowMixedLot: rack.allowMixedLot,
    };
    const saved = await runRequest(() =>
      client.POST('/mdm/locations', {
        params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
        body,
      }),
    );
    return saved.locationId;
  };

  const save = async () => {
    if (plan.length === 0) return;
    setFailure(null);
    const createdLevels = new Map<string, number>();
    let done = 0;
    setProgress({ done, total: plan.length });

    try {
      for (const entry of plan) {
        const parentId =
          entry.parentLocationId ??
          (entry.parentCode === null ? undefined : createdLevels.get(entry.parentCode));
        if (parentId === undefined) throw new Error('parent');
        const id = await create(entry, parentId);
        if (entry.kind === 'LEVEL') createdLevels.set(entry.locationCode, id);
        done += 1;
        setProgress({ done, total: plan.length });
      }
      toast.show({ variant: 'success', description: t.rackLayout.created(plan.length) });
      setProgress(null);
      setOpenedFor(null);
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
      open={rack !== null}
      onClose={close}
      title={t.rackLayout.title}
      footer={
        <>
          <Button variant="outlined" disabled={saving} onClick={close}>
            {messages.common.cancel}
          </Button>
          <Button
            disabled={plan.length === 0 || saving}
            loading={saving}
            onClick={() => void save()}
          >
            {saving && progress !== null
              ? t.rackLayout.saving(progress.done, progress.total)
              : t.rackLayout.submit}
          </Button>
        </>
      }
    >
      {failure !== null && <AlertBanner variant="error" title={failure} />}
      {rack !== null && (
        <div className="rack-layout">
          <p className="rack-layout-target">
            {t.rackLayout.target(rack.locationCode, locationShownName(rack))}
          </p>
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
          <p className="field-note">
            {plan.length === 0
              ? t.rackLayout.nothingToCreate
              : t.rackLayout.summary(newLevels, newCells)}
          </p>
          {plan.length > 0 && (
            <ul className="rack-layout-preview" aria-label={t.rackLayout.previewLabel}>
              {plan.slice(0, PREVIEW_LIMIT).map((entry) => (
                <li key={entry.locationCode}>
                  <span className="rack-layout-kind">{t.values.locationLevels[entry.kind]}</span>
                  {entry.locationCode} · {entry.locationName}
                </li>
              ))}
              {plan.length > PREVIEW_LIMIT && (
                <li className="field-note">{t.rackLayout.more(plan.length - PREVIEW_LIMIT)}</li>
              )}
            </ul>
          )}
          <p className="field-note">{t.rackLayout.shrinkNote}</p>
        </div>
      )}
    </Dialog>
  );
};
