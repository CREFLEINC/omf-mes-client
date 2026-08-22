import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  deactivateAvailability,
  disposeAvailability,
  labelNote,
  referenceNote,
} from './asset-actions';
import { CODE_GROUPS, defaultToolFilters, selectableOptions, toCodeLabels } from './code-options';
import { LoadErrorBanner } from './load-error-banner';
import { RetireConfirmDialog } from './retire-confirm-dialog';
import { emptyFormValues, formValuesFrom, toToolCreate, toToolUpdate } from './mappers';
import { ToolFormDialog } from './tool-form-dialog';
import { ToolListPane } from './tool-list-pane';
import { TOOL_FORM_FIELDS, validateTool } from './tool-validation';
import {
  isTruncated,
  toolDetailPath,
  toolKeys,
  useCodeValues,
  usePlantLookup,
  useToolDetail,
  useToolList,
} from './queries';
import type { Mold, ToolFilters, ToolFormValues } from './types';

const t = messages.toolMaster;

const NO_ITEMS: never[] = [];

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다.** 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 `?? 0` 같은 **닿지 않는 기본값**으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
type DialogState = { mode: 'create' } | { mode: 'edit'; moldId: number };

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
  moldId: number | null,
  onDone: () => void,
) => {
  const { client } = useApiClient();

  return useMasterWrite<void, Mold>({
    request: (_variables, headers) => {
      const params = {
        path: { moldId: moldId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };

      return action === 'deactivate'
        ? client.POST('/mdm/molds/{moldId}:deactivate', { params })
        : client.POST('/mdm/molds/{moldId}:dispose', { params });
    },
    /* 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로(`...:dispose`)로 꺼내면 늘 비어 있다. */
    etagPath: moldId === null ? null : toolDetailPath(moldId),
    invalidateKeys: [toolKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: onDone,
  });
};

/**
 * W-05-13 툴/금형/지그 마스터 관리.
 *
 * ⭐ **테이블 이름은 금형이지만 담는 것은 모든 도구다** — `toolTypeCode` 가 가른다(스펙 §3).
 * ⭐ **예방보전 도래도 사용 가능 타수도 서버가 셈한다** — 축이 둘이고 타발수는 화면이 가진
 * 값이 아니다. 화면이 다시 세면 서버와 다른 답을 낸다.
 * ⛔ **누계 타발수는 이 화면이 고치지 않는다** — 더하는 것은 툴 사용실적 입력이고 되돌리는
 * 것은 툴 예방보전 실적 등록이다(공유계약 B-13).
 */
export const ToolMasterScreen = () => {
  const { client } = useApiClient();
  const toast = useToast();
  const [filters, setFilters] = useState<ToolFilters>(defaultToolFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<ToolFormValues>(() => emptyFormValues(''));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  /** 확인 창이 떠 있는가. 두 조작이 같은 창을 쓰되 말은 각자 갖는다 */
  const [retiring, setRetiring] = useState<'deactivate' | 'dispose' | null>(null);

  const tools = useToolList(filters);
  const plants = usePlantLookup();
  const statusValues = useCodeValues(CODE_GROUPS.assetStatus);

  /* 창을 열 때만 상세를 조회한다 — 목록 응답에는 잠금 토큰도 코드 편집 가부도 없다. */
  const editingId = dialog?.mode === 'edit' ? dialog.moldId : null;
  const detail = useToolDetail(editingId);

  const items = tools.data?.items ?? NO_ITEMS;
  const listTruncated = tools.data !== undefined && isTruncated(tools.data.page, items.length);
  const statusOptions = toCodeLabels(statusValues.data ?? NO_ITEMS);

  /*
   * 조회 실패와 잘림은 함께 서지 않는다 — 실패하면 받아 온 목록 자체가 없다.
   * 그래서 여기 순서는 우열이 아니라 서술 순서일 뿐이다.
   */
  const optionsNote = plants.isError
    ? t.optionsLoadFailed
    : plants.truncated
      ? t.optionsTruncated
      : undefined;

  const isCreate = dialog?.mode === 'create';
  const tool = detail.data?.mold ?? null;

  const write = useMasterWrite<ToolFormValues, Mold>({
    request: (formValues, headers) =>
      isCreate
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          client.POST('/mdm/molds', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toToolCreate(formValues),
          })
        : client.PUT('/mdm/molds/{moldId}', {
            params: {
              path: { moldId: editingId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toToolUpdate(formValues, detail.data?.editability.codeEditable ?? false),
          }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 등록에는 낙관적 잠금이 없다. */
    etagPath: editingId === null ? null : toolDetailPath(editingId),
    invalidateKeys: [toolKeys.all],
    knownFields: TOOL_FORM_FIELDS,
    onSuccess: () => {
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const deactivateWrite = useRetireWrite('deactivate', editingId, () => {
    /* 창은 열어 둔다 — 중지된 툴도 이름·주기는 계속 고칠 수 있다. */
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
   * 서버는 이미 처리한 상태가 된다(client#96).
   *
   * ⚠ **jsdom 에서는 이 가드에 닿는 길이 없다** — 쓰기가 나가는 동안 「취소」가 잠기고
   * 스크림은 막혀 있으며 목록은 창 뒤에 있다. **브라우저에서는 Escape 로 닿는다**:
   * native `<dialog>` 의 `cancel` 은 잠글 수 없다. 형제 화면과 같은 모양으로 남겨 둔다.
   */
  const resetIfIdle = (target: { isSaving: boolean; reset: () => void }): void => {
    if (target.isSaving) return;

    target.reset();
  };

  /** 편집 중이던 것을 통째로 거둔다 — 인라인 오류와 저장 실패 배너 셋. */
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

  /**
   * 목록 행으로 폼을 채운다.
   *
   * ⭐ **고칠 값이 모두 화면에 보인다는 것이 이 선택의 근거다.** 목록은 캐시라 낡을 수 있고
   * 잠금 토큰은 상세에서 온 최신이라 충돌로 걸리지 않는데, 그래도 안전한 것은 사용자가 **본
   * 값을 저장**하기 때문이다. 형제 화면(W-05-11)이 보이지 않는 값(소속)만 상세에서 뜬 이유가
   * 그것이다 — 이 화면에는 그런 값이 없다(계약의 수정 본문이 전부 이 화면 소유다).
   */
  const openEdit = (row: Mold): void => {
    resetEditing();
    setLocalErrors({});
    setValues(formValuesFrom(row));
    setDialog({ mode: 'edit', moldId: row.moldId });
  };

  const closeDialog = (): void => {
    resetEditing();
    setRetiring(null);
    setDialog(null);
  };

  const changeValues = (patch: Partial<ToolFormValues>): void => {
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
    const errors = validateTool(values, { isCreate });
    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) return;

    write.write(values);
  };

  const deactivate = deactivateAvailability(tool);
  const dispose = disposeAvailability(tool, statusOptions);
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
            {t.listTruncated(items.length, tools.data?.page.total ?? items.length)}
          </AlertBanner>
        </div>
      )}

      <ToolListPane
        items={items}
        isLoading={tools.isLoading}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        plantOptions={selectableOptions(plants.plants, filters.plantId)}
        plantEntries={plants.plants}
        statusOptions={statusOptions}
        onAdd={openCreate}
        onEdit={openEdit}
        loadError={
          tools.isError ? (
            <LoadErrorBanner error={toApiError(tools.error)} onRetry={() => void tools.refetch()} />
          ) : null
        }
      />

      {dialog !== null && (
        <ToolFormDialog
          mode={dialog.mode}
          values={values}
          onChange={changeValues}
          fieldErrors={{ ...write.fieldErrors, ...localErrors }}
          banner={
            /* ⭐ 「최신 불러오기」는 충돌에만 뜻이 있다 — 상세를 다시 읽어야 잠금 토큰이 새로 온다. */
            <SaveErrorBanner error={write.error} onReload={() => void detail.refetch()} />
          }
          codeLockReason={codeLockReason}
          plantOptions={selectableOptions(plants.plants, values.plantId)}
          plantEntries={plants.plants}
          optionsNote={optionsNote}
          statusCode={tool?.statusCode ?? null}
          statusOptions={statusOptions}
          currentShotCount={tool?.currentShotCount ?? null}
          figures={tool}
          lastPmDate={tool?.lastPmDate ?? null}
          nextPmDate={tool?.nextPmDate ?? null}
          labelIssueCount={detail.data?.labelIssueCount ?? null}
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

      {retiring !== null && tool !== null && (
        <RetireConfirmDialog
          title={retiring === 'dispose' ? t.retire.disposeTitle : t.retire.deactivateTitle}
          targetNote={
            retiring === 'dispose'
              ? t.retire.disposeTarget(`${tool.moldCode} · ${tool.moldName}`)
              : t.retire.deactivateTarget(`${tool.moldCode} · ${tool.moldName}`)
          }
          referenceNote={referenceNote(detail.data?.editability.referenceCount)}
          outsideNote={labelNote(detail.data?.labelIssueCount ?? null)}
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
