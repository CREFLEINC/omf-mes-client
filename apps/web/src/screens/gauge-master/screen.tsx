import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  CODE_GROUPS,
  defaultGaugeFilters,
  ensureOption,
  selectableOptions,
  toCodeLabels,
} from './code-options';
import { deactivateAvailability, disposeAvailability } from './asset-actions';
import { GaugeFormDialog } from './gauge-form-dialog';
import { GaugeListPane } from './gauge-list-pane';
import { GAUGE_FORM_FIELDS, validateGauge } from './gauge-validation';
import { LoadErrorBanner } from './load-error-banner';
import { RetireConfirmDialog } from './retire-confirm-dialog';
import {
  carriedFrom,
  emptyCarriedValues,
  emptyFormValues,
  formValuesFrom,
  toGaugeCreate,
  toGaugeUpdate,
} from './mappers';
import {
  gaugeDetailPath,
  gaugeKeys,
  isTruncated,
  useCodeValues,
  useGaugeDetail,
  useGaugeList,
  usePlantLookup,
  useUomLookup,
} from './queries';
import { todayIso } from './today';
import type { CarriedGaugeValues, Equipment, GaugeFilters, GaugeFormValues } from './types';

const t = messages.gaugeMaster;

const NO_ITEMS: never[] = [];

export interface GaugeMasterScreenProps {
  /**
   * 오늘. **인자로 받는다** — 화면이 시각을 직접 읽으면 검교정 판정이 실행 시각에 흔들려
   * 시험이 날짜마다 다른 답을 낸다. 화면을 여는 자리에서는 기본값이 곧 오늘이다.
   */
  today?: string;
}

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다.** 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 `?? 0` 같은 **닿지 않는 기본값**으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
type DialogState = { mode: 'create' } | { mode: 'edit'; equipmentId: number };

/**
 * 되돌릴 수 없는 자산 조작 하나(사용 중지·폐기)의 쓰기.
 *
 * ⛔ **멱등 키 수명은 기본값(`per-attempt`)이 맞다** — 되돌릴 수 없는 쓰기인데도 그렇다.
 * 부품이 「**본문이 빈 액션**에 `until-applied` 를 쓰지 말라」고 정했다: 보낼 값이 없으면
 * 「값이 바뀌면 새 키」가 성립하지 않아, 다른 화면에서 원인을 고치고 돌아와 다시 눌러도
 * 같은 키가 나가 **영영 성공할 수 없다.**
 */
const useRetireWrite = (
  action: 'deactivate' | 'dispose',
  equipmentId: number | null,
  onDone: () => void,
) => {
  const { client } = useApiClient();

  return useMasterWrite<void, Equipment>({
    request: (_variables, headers) => {
      const params = {
        path: { equipmentId: equipmentId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };

      return action === 'deactivate'
        ? client.POST('/mdm/equipments/{equipmentId}:deactivate', { params })
        : client.POST('/mdm/equipments/{equipmentId}:dispose', { params });
    },
    /* 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로(`...:dispose`)로 꺼내면 늘 비어 있다. */
    etagPath: equipmentId === null ? null : gaugeDetailPath(equipmentId),
    invalidateKeys: [gaugeKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: onDone,
  });
};

/**
 * W-05-11 계측기 마스터 관리.
 *
 * ⭐ **계측기 전용 경로가 없다** — 설비 목록을 `equipmentTypeCode` 로 거른다(스펙 §3-2).
 * ⭐ **「만료」는 저장된 값이 아니다** — 차기 예정일과 오늘을 견줘 화면이 판정한다(§5-2).
 * ⭐ **검교정 주기와 정밀도를 이 화면이 정한다** — 형제 화면(W-05-12)은 읽기만 한다(B-13).
 */
export const GaugeMasterScreen = ({ today = todayIso() }: GaugeMasterScreenProps = {}) => {
  const { client } = useApiClient();
  const toast = useToast();
  const [filters, setFilters] = useState<GaugeFilters>(defaultGaugeFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<GaugeFormValues>(() => emptyFormValues(''));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  /** 확인 창이 떠 있는가. 두 조작이 같은 창을 쓰되 말은 각자 갖는다 */
  const [retiring, setRetiring] = useState<'deactivate' | 'dispose' | null>(null);

  const gauges = useGaugeList(filters);
  const plants = usePlantLookup();
  const uoms = useUomLookup();
  const statusValues = useCodeValues(CODE_GROUPS.equipmentStatus);
  const cycleValues = useCodeValues(CODE_GROUPS.cycleType);

  /* 창을 열 때만 상세를 조회한다 — 목록 응답에는 잠금 토큰도 코드 편집 가부도 없다. */
  const editingId = dialog?.mode === 'edit' ? dialog.equipmentId : null;
  const detail = useGaugeDetail(editingId);

  const items = gauges.data?.items ?? NO_ITEMS;
  const listTruncated = gauges.data !== undefined && isTruncated(gauges.data.page, items.length);

  /*
   * ⚠ 계측기 유형 값 목록이 아직 없다(설계 질의 `omf-mes#195`). 자리표시 값으로 거르면
   * 목록이 늘 비므로 조건을 걸지 않고, **그 사실을 화면이 밝힌다**(G-2).
   */
  const canFilterByType = false;

  const plantOptions = selectableOptions(plants.plants, values.plantId);
  const uomOptions = selectableOptions(uoms.uoms, values.precisionUomId);
  const statusOptions = toCodeLabels(statusValues.data ?? NO_ITEMS);
  /*
   * ⭐ 지금 걸려 있는 주기 단위가 코드 목록에 없어도 **칸이 비어 보이면 안 된다.**
   * 공장·단위는 `selectableOptions` 가 같은 일을 한다 — 세 선택칸의 규율을 맞춘다.
   */
  const cycleOptions = ensureOption(
    toCodeLabels(cycleValues.data ?? NO_ITEMS),
    values.calibrationCycleTypeCode,
  );

  /*
   * 둘은 함께 서지 않는다 — 조회가 실패하면 받아 온 목록 자체가 없어 잘림 판정이 거짓이다.
   * 그래서 여기 순서는 우열이 아니라 서술 순서일 뿐이다(뮤테이션 M19 — 순서를 바꿔도 같은 화면).
   */
  const lookupNote = (lookup: { isError: boolean; truncated: boolean }): string | undefined =>
    lookup.isError ? t.optionsLoadFailed : lookup.truncated ? t.optionsTruncated : undefined;

  const optionsNote = lookupNote(plants) ?? lookupNote(uoms);

  /**
   * 이 화면이 소유하지 않는 값. 보이지 않게 고치지 않되 **그대로 되돌려 보낸다**(B-13).
   *
   * ⭐ **목록 행이 아니라 상세에서 뜬다.** 목록은 캐시라 낡을 수 있고, 낡은 소속을 되돌려
   * 보내면 그 사이 설비 마스터가 정한 값을 **덮어쓴다** — 잠금 토큰은 상세에서 온 최신이라
   * 충돌로도 걸리지 않는다.
   */
  const carried: CarriedGaugeValues =
    detail.data === undefined ? emptyCarriedValues() : carriedFrom(detail.data.equipment);

  const isCreate = dialog?.mode === 'create';

  /** 고른 단위가 허용하는 소수 자릿수. 고르지 않았으면 판정하지 않는다. */
  const decimalScale =
    uoms.uoms.find((uom) => uom.value === values.precisionUomId)?.decimalScale ?? null;

  const write = useMasterWrite<GaugeFormValues, Equipment>({
    request: (formValues, headers) =>
      isCreate
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          client.POST('/mdm/equipments', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toGaugeCreate(formValues, carried),
          })
        : client.PUT('/mdm/equipments/{equipmentId}', {
            params: {
              path: { equipmentId: editingId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toGaugeUpdate(
              formValues,
              carried,
              detail.data?.editability.codeEditable ?? false,
            ),
          }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 등록에는 낙관적 잠금이 없다. */
    etagPath: editingId === null ? null : gaugeDetailPath(editingId),
    invalidateKeys: [gaugeKeys.all],
    knownFields: GAUGE_FORM_FIELDS,
    onSuccess: () => {
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const deactivateWrite = useRetireWrite('deactivate', editingId, () => {
    /* 창은 열어 둔다 — 중지된 계측기도 이름·주기는 계속 고칠 수 있다. */
    void detail.refetch();
    setRetiring(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  const disposeWrite = useRetireWrite('dispose', editingId, () => {
    /*
     * ⛔ **창도 함께 닫는다.** 폐기된 자산은 편집이 풀리지 않으므로, 열린 폼을 남기면
     * 사용자가 고칠 수 있다고 믿고 치다가 저장에서 거절당한다.
     */
    setRetiring(null);
    setDialog(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  /**
   * **끝난 쓰기만 거둔다.** 나가는 중인 요청을 `reset()` 으로 끊으면 그 요청의 되먹임
   * (성공 뒤 창 닫기, 실패 뒤 오류 표시)이 통째로 사라져, 화면은 아무 일도 없었다고 믿고
   * 서버는 이미 처리한 상태가 된다(client#96 · 조회 도구가 관찰자를 떼면 `onSuccess` 가
   * 영영 오지 않는다).
   *
   * ⚠ **jsdom 에서는 이 가드에 닿는 길이 없다** — 쓰기가 나가는 동안 「취소」와 확인 창의
   * 버튼이 모두 잠기고, 스크림은 막혀 있으며, 목록은 창 뒤에 있다. 그래서 뮤테이션으로 죽지
   * 않는다(P13 · 사용 중지·폐기를 더한 뒤에도 그대로 · S8).
   *
   * **브라우저에서는 Escape 로 닿는다** — native `<dialog>` 의 `cancel` 이 닫기로 이어지고
   * 그것은 잠글 수 없다(브라우저 확인 ② 7항). 즉 실제로는 닿는 길이 있고 jsdom 이 그 사건을
   * 만들지 못하는 것이다. 형제 화면과 같은 모양으로 남겨 둔다.
   */
  const resetIfIdle = (target: { isSaving: boolean; reset: () => void }): void => {
    if (target.isSaving) return;

    target.reset();
  };

  /** 편집 중이던 것을 통째로 거둔다 — 인라인 오류와 저장 실패 배너. */
  const resetEditing = (): void => {
    resetIfIdle(write);
    resetIfIdle(deactivateWrite);
    resetIfIdle(disposeWrite);
  };

  const openCreate = (): void => {
    resetEditing();
    setLocalErrors({});
    setValues(emptyFormValues(filters.plantId));
    setDialog({ mode: 'create' });
  };

  const openEdit = (gauge: Equipment): void => {
    resetEditing();
    setLocalErrors({});
    setValues(formValuesFrom(gauge));
    setDialog({ mode: 'edit', equipmentId: gauge.equipmentId });
  };

  const closeDialog = (): void => {
    resetEditing();
    setRetiring(null);
    setDialog(null);
  };

  const changeValues = (patch: Partial<GaugeFormValues>): void => {
    setValues((current) => ({ ...current, ...patch }));

    /* 고치는 순간 그 칸의 오류는 낡은 말이 된다 — 서버가 준 것도 함께 거둔다. */
    for (const field of Object.keys(patch)) {
      setLocalErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
      write.clearFieldError(field);
    }
  };

  const save = (): void => {
    const errors = validateGauge(values, { isCreate, decimalScale });
    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) return;

    write.write(values);
  };

  const gauge = detail.data?.equipment ?? null;
  const deactivate = deactivateAvailability(gauge?.isActive ?? false);
  const dispose = disposeAvailability(gauge?.statusCode ?? null, statusOptions);
  const retireWriteInFlight = retiring === 'dispose' ? disposeWrite : deactivateWrite;

  const codeLockReason =
    dialog?.mode === 'edit' && detail.data !== undefined
      ? codeLockMessage(detail.data.editability)
      : null;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {optionsNote !== undefined && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{optionsNote}</AlertBanner>
        </div>
      )}

      {listTruncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.listTruncated(items.length, gauges.data?.page.total ?? items.length)}
          </AlertBanner>
        </div>
      )}

      <GaugeListPane
        items={items}
        isLoading={gauges.isLoading}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        plantOptions={selectableOptions(plants.plants, filters.plantId)}
        plantEntries={plants.plants}
        statusOptions={statusOptions}
        today={today}
        canFilterByType={canFilterByType}
        isTruncated={listTruncated}
        onAdd={openCreate}
        onEdit={openEdit}
        loadError={
          gauges.isError ? (
            <LoadErrorBanner
              error={toApiError(gauges.error)}
              onRetry={() => void gauges.refetch()}
            />
          ) : null
        }
      />

      {dialog !== null && (
        <GaugeFormDialog
          mode={dialog.mode}
          values={values}
          onChange={changeValues}
          fieldErrors={{ ...write.fieldErrors, ...localErrors }}
          banner={
            /* ⭐ 「최신 불러오기」는 충돌에만 뜻이 있다 — 상세를 다시 읽어야 잠금 토큰이 새로 온다. */
            <SaveErrorBanner error={write.error} onReload={() => void detail.refetch()} />
          }
          codeLockReason={codeLockReason}
          plantOptions={plantOptions}
          plantEntries={plants.plants}
          cycleOptions={cycleOptions}
          uomOptions={uomOptions}
          optionsNote={optionsNote}
          statusCode={detail.data?.equipment.statusCode ?? null}
          statusOptions={statusOptions}
          lastCalibrationDate={detail.data?.equipment.lastCalibrationDate ?? null}
          calibrationDueDate={detail.data?.equipment.calibrationDueDate ?? null}
          isSaving={write.isSaving}
          deactivate={deactivate}
          dispose={dispose}
          onClose={closeDialog}
          onSave={save}
          onDeactivate={() => {
            resetIfIdle(deactivateWrite);
            setRetiring('deactivate');
          }}
          onDispose={() => {
            resetIfIdle(disposeWrite);
            setRetiring('dispose');
          }}
        />
      )}

      {retiring !== null && gauge !== null && (
        <RetireConfirmDialog
          title={retiring === 'dispose' ? t.retire.disposeTitle : t.retire.deactivateTitle}
          targetNote={
            retiring === 'dispose'
              ? t.retire.disposeTarget(`${gauge.equipmentCode} · ${gauge.equipmentName}`)
              : t.retire.deactivateTarget(`${gauge.equipmentCode} · ${gauge.equipmentName}`)
          }
          impactNote={retiring === 'dispose' ? t.retire.disposeImpact : t.retire.deactivateImpact}
          reversibilityNote={
            retiring === 'dispose'
              ? t.retire.disposeNotReversible
              : t.retire.deactivateNotReversibleHere
          }
          confirmLabel={
            retiring === 'dispose' ? t.retire.disposeConfirm : t.retire.deactivateConfirm
          }
          isSaving={retireWriteInFlight.isSaving}
          banner={
            <SaveErrorBanner
              error={retireWriteInFlight.error}
              onReload={() => void detail.refetch()}
            />
          }
          onClose={() => setRetiring(null)}
          onConfirm={() => retireWriteInFlight.write(undefined)}
        />
      )}
    </div>
  );
};
