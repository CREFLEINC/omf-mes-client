import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { EndPolicyDialog } from './end-policy-dialog';
import { validateEndDate } from './end-policy';
import { LoadErrorBanner } from './load-error-banner';
import { formValuesFrom, toRatioCreate, toRatioUpdate } from './mappers';
import { defaultPolicyFilters, emptyRatioForm } from './options';
import {
  policyKeys,
  useBusinessUnitLookup,
  useItemLookup,
  usePlantLookup,
  useProcessLookup,
  useRatioPolicies,
} from './queries';
import { RatioFormDialog, type ScopeOptions } from './ratio-form-dialog';
import { RatioListPane } from './ratio-list-pane';
import { RATIO_FORM_FIELDS, validateRatio } from './ratio-validation';
import { scopeText, type ScopeLookups } from './scope';
import type { OperationPolicy, PolicyFilters, RatioFormValues, ScopeAxis } from './types';

const t = messages.shotConversion;

const NO_POLICIES: OperationPolicy[] = [];

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다** — 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 닿지 않는 기본값으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
/**
 * 끝내려는 정책. 닫혀 있으면 `null`.
 *
 * ⭐ **대상 자체를 든다** — 시작일과 범위 문구가 창에 필요하고, 목록이 다시 들어와 그 줄이
 * 사라져도 **열어 둔 창이 무엇을 끝내려던 것인지 잃지 않아야** 한다.
 */
interface EndingState {
  policy: OperationPolicy;
  scopeLabel: string;
  endOn: string;
}

type DialogState =
  | { mode: 'create' }
  /** 범위 문구를 **열 때 굳혀 든다** — 바꿀 수 없는 값이라 다시 셀 이유가 없다 */
  | { mode: 'edit'; operationPolicyId: number; scopeLabel: string };

/**
 * 오늘. **화면 경계에서 한 번만 읽는다** — 안쪽은 전부 받은 값을 쓴다.
 *
 * ⚠ 실행 환경의 시간대로 읽는다. 「끝났는가」는 사람이 달력을 보고 판단하는 것과 같아야 하고,
 * 그 사람은 자기 자리의 달력을 본다.
 */
const todayText = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * W-05-01 타발수 환산 파라미터 설정.
 *
 * ⭐ **타발수 = 생산 수량 × 비율.** 이 화면이 그 비율과 「환산을 쓸지」를 정한다.
 *
 * ⛔ **툴별 차이는 여기 없다** — 캐비티 수가 이미 담고 그것은 툴 마스터의 것이다.
 * 두 화면이 한 계산의 입력을 나눠 갖고, 나누는 선이 「툴 고유 ↔ 품목·공정 정책」이다.
 *
 * ⛔ **정책 코드를 사용자에게 묻지 않는다** — 이 화면이 쓰는 코드는 둘로 고정이며 화면이
 * 붙인다. 기계가 정할 수 있는 것을 사람에게 묻지 않는다.
 */
export const ShotConversionScreen = () => {
  const [filters, setFilters] = useState<PolicyFilters>(defaultPolicyFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<RatioFormValues>(emptyRatioForm);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [ending, setEnding] = useState<EndingState | null>(null);
  /** 종료일이 쓸 수 없는 값일 때의 사유. 누르기 전에는 `null` — 치는 동안 나무라지 않는다 */
  const [endError, setEndError] = useState<string | null>(null);

  const { client } = useApiClient();
  const toast = useToast();

  const ratios = useRatioPolicies(filters);
  const items = useItemLookup();
  const processes = useProcessLookup();
  const plants = usePlantLookup();
  const businessUnits = useBusinessUnitLookup();

  /*
   * ⛔ **창을 열어도 상세를 부르지 않는다.** 형제 화면들이 상세를 부르는 이유는 **잠금
   * 토큰**을 얻기 위해서인데, 이 자원은 `ETag` 를 내리지 않고 수정도 `If-Match` 를 받지
   * 않는다(설계 질의 `omf-mes#210`). 수정 본문이 요구하는 값은 목록 행에 다 있다 —
   * 얻을 것이 없는 조회를 걸어 두면 다음 사람이 「무엇을 기다리는가」를 되짚게 된다.
   */
  const editingId = dialog?.mode === 'edit' ? dialog.operationPolicyId : null;

  const rows = ratios.data?.items ?? NO_POLICIES;

  const lookups: ScopeLookups = {
    itemId: items.entries,
    processId: processes.entries,
    plantId: plants.entries,
    businessUnitId: businessUnits.entries,
  };

  const lookupResults = [items, processes, plants, businessUnits];

  /** 선택 목록의 한계. **실패가 잘림보다 앞선다** — 아무것도 못 받은 것이 더 큰 사실이다. */
  const optionsNote = lookupResults.some((result) => result.isError)
    ? t.optionsLoadFailed
    : lookupResults.some((result) => result.truncated)
      ? t.optionsTruncated
      : null;

  const scopeOptions: ScopeOptions = {
    itemId: items.entries,
    processId: processes.entries,
    plantId: plants.entries,
    businessUnitId: businessUnits.entries,
  };

  const isCreate = dialog?.mode === 'create';

  /**
   * 정책 쓰기.
   *
   * ⛔ **잠금 토큰이 없다** — 이 자원은 `If-Match`·`ETag`·`409` 셋 다 계약에 없다
   * (설계 질의 `omf-mes#210`). 그래서 `etagPath` 는 늘 `null` 이고, **마지막 저장이 이긴다.**
   * 없는 헤더를 화면이 지어내 보낼 수는 없다.
   *
   * ⛔ **멱등 키 수명은 기본값(`per-attempt`)이 맞다** — 되돌릴 수 있는 쓰기다. 지우는 길이
   * 없어 잘못 만든 정책은 끝내면 되고, 그 대가가 크지 않다.
   */
  const write = useMasterWrite<RatioFormValues, OperationPolicy>({
    request: (formValues, headers) =>
      isCreate
        ? client.POST('/app/operation-policies', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toRatioCreate(formValues),
          })
        : client.PUT('/app/operation-policies/{operationPolicyId}', {
            params: {
              path: { operationPolicyId: editingId ?? 0 },
              header: { 'Idempotency-Key': headers['Idempotency-Key'] },
            },
            body: toRatioUpdate(formValues),
          }),
    etagPath: null,
    invalidateKeys: [policyKeys.all],
    knownFields: RATIO_FORM_FIELDS,
    onSuccess: () => {
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **끝난 쓰기만 거둔다.** 나가는 중인 요청을 끊으면 그 요청의 되먹임이 통째로 사라져,
   * 화면은 아무 일도 없었다고 믿고 서버는 이미 처리한 상태가 된다(client#96).
   */
  const resetIfIdle = (target: { isSaving: boolean; reset: () => void }): void => {
    if (target.isSaving) return;

    target.reset();
  };

  /** 창을 떠난다 — **거두는 자리를 하나로 둔다.** 여는 쪽은 값을 세우는 일만 한다. */
  const closeDialog = (): void => {
    resetIfIdle(write);
    setLocalErrors({});
    setDialog(null);
  };

  const openCreate = (): void => {
    setValues(emptyRatioForm());
    setDialog({ mode: 'create' });
  };

  /**
   * 목록 행으로 폼을 채운다.
   *
   * ⭐ **행이 가진 값으로 먼저 그린다** — 상세를 기다리는 동안 빈 창을 보이면 사용자가
   * 값이 사라진 줄 안다.
   */
  const openEdit = (policy: OperationPolicy): void => {
    setValues(formValuesFrom(policy));
    setDialog({
      mode: 'edit',
      operationPolicyId: policy.operationPolicyId,
      scopeLabel: scopeText(policy, lookups),
    });
  };

  const changeScope = (axis: ScopeAxis, value: string): void => {
    setValues((prev) => ({ ...prev, scope: { ...prev.scope, [axis]: value } }));
    setLocalErrors((prev) => {
      const { [axis]: _removed, ...rest } = prev;

      return rest;
    });
    write.clearFieldError(axis);
  };

  /**
   * 정책을 끝내는 쓰기.
   *
   * ⛔ **삭제가 아니라 수정이다** — 계약에 삭제 경로가 없고 그것은 실수가 아니다.
   * 과거 실적이 그때의 비율로 계산됐다.
   *
   * ⭐ **지금 값을 통째로 되보내며 종료일만 바꾼다** — 계약이 수정 본문의 값 칸을 선택으로
   * 두어, 종료일만 실으면 서버가 그것을 「나머지를 비우라」로 읽을 수 있다.
   */
  const endWrite = useMasterWrite<string, OperationPolicy>({
    request: (endOn, headers) => {
      if (ending === null) {
        throw new Error('대상을 고르기 전에는 정책을 끝내지 않습니다.');
      }

      return client.PUT('/app/operation-policies/{operationPolicyId}', {
        params: {
          path: { operationPolicyId: ending.policy.operationPolicyId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: toRatioUpdate({ ...formValuesFrom(ending.policy), effectiveTo: endOn }),
      });
    },
    etagPath: null,
    invalidateKeys: [policyKeys.all],
    /* 대응하는 입력칸이 하나뿐이고 그 오류는 화면이 먼저 잡는다 — 서버 것은 배너로 올린다. */
    knownFields: [],
    onSuccess: () => {
      setEnding(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 끝낼 대상을 고른다.
   *
   * ⚠ **고른 날을 빈 채로 시작하는 것은 지금 관찰상 동치다** — 닫는 쪽이 이미 상태를
   * 비우기 때문이다. 그럼에도 새 객체를 만드는 것은, 창이 «닫히지 않고» 대상만 바뀌는 길이
   * 생겼을 때(예: 표에서 다음 줄로 옮겨 가기) 앞 날짜가 딸려 오지 않게 하기 위해서다.
   */
  const openEnd = (policy: OperationPolicy): void => {
    setEndError(null);
    setEnding({ policy, scopeLabel: scopeText(policy, lookups), endOn: '' });
  };

  /** 창을 떠난다 — **거두는 자리를 하나로 둔다.** */
  const closeEnd = (): void => {
    resetIfIdle(endWrite);
    setEndError(null);
    setEnding(null);
  };

  const confirmEnd = (): void => {
    if (ending === null) return;

    const reason = validateEndDate(ending.policy, ending.endOn);

    setEndError(reason);

    if (reason !== null) return;

    endWrite.write(ending.endOn);
  };

  const submit = (): void => {
    const errors = validateRatio(values);

    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) return;

    write.write(values);
  };

  /** 인라인 오류 두 갈래를 겹친다 — **서버 것이 화면 것을 덮는다**(더 최근 판정이다). */
  const fieldErrors = { ...localErrors, ...write.fieldErrors };

  const loadError = ratios.isError ? (
    <LoadErrorBanner error={toApiError(ratios.error)} onRetry={() => void ratios.refetch()} />
  ) : null;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 고를 목록이 반쪽이면 범위가 없는 것처럼 보인다 — 감추지 않고 밝힌다. */}
      {optionsNote !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{optionsNote}</AlertBanner>
        </div>
      )}

      <RatioListPane
        items={rows}
        isLoading={ratios.isPending}
        /*
         * ⛔ **여기서 잘림을 판정하지 않는다** — 표가 그 일을 이미 한다(`total > items.length`).
         * 두 곳에서 판정하면 한쪽을 고쳐도 다른 쪽이 덮어 주어 고장이 드러나지 않는다.
         */
        total={ratios.data?.page.total ?? null}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        lookups={lookups}
        today={todayText()}
        onAdd={openCreate}
        onEdit={openEdit}
        onEnd={openEnd}
        loadError={loadError}
      />

      {ending !== null && (
        <EndPolicyDialog
          scopeLabel={ending.scopeLabel}
          endOn={ending.endOn}
          onChangeEndOn={(endOn) => {
            setEnding((prev) => (prev === null ? prev : { ...prev, endOn }));
            /* 고치는 즉시 사유를 거둔다 — 고친 자리에 옛 오류가 남으면 헛돈다. */
            setEndError(null);
          }}
          dateError={endError}
          isSaving={endWrite.isSaving}
          banner={<SaveErrorBanner error={endWrite.error} />}
          onClose={closeEnd}
          onConfirm={confirmEnd}
        />
      )}

      {dialog !== null && (
        <RatioFormDialog
          mode={dialog.mode}
          values={values}
          onChange={(patch) => {
            setValues((prev) => ({ ...prev, ...patch }));

            /* 고치는 즉시 그 칸의 오류를 거둔다 — 고친 자리에 옛 오류가 남으면 헛돈다. */
            for (const field of Object.keys(patch)) {
              const key = field === 'ratio' ? 'valueNumeric' : field;

              setLocalErrors((prev) => {
                const { [key]: _removed, ...rest } = prev;

                return rest;
              });
              write.clearFieldError(key);
            }
          }}
          onChangeScope={changeScope}
          fieldErrors={fieldErrors}
          banner={<SaveErrorBanner error={write.error} />}
          scopeOptions={scopeOptions}
          scopeText={dialog.mode === 'edit' ? dialog.scopeLabel : ''}
          optionsNote={optionsNote ?? undefined}
          isSaving={write.isSaving}
          onClose={closeDialog}
          onSave={submit}
        />
      )}
    </div>
  );
};
