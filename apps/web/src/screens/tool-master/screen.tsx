import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { CODE_GROUPS, defaultToolFilters, selectableOptions, toCodeLabels } from './code-options';
import { LoadErrorBanner } from './load-error-banner';
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

  const openCreate = (): void => {
    resetIfIdle(write);
    setLocalErrors({});
    setValues(emptyFormValues(filters.plantId));
    setDialog({ mode: 'create' });
  };

  const openEdit = (row: Mold): void => {
    resetIfIdle(write);
    setLocalErrors({});
    setValues(formValuesFrom(row));
    setDialog({ mode: 'edit', moldId: row.moldId });
  };

  const closeDialog = (): void => {
    resetIfIdle(write);
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
          onClose={closeDialog}
          onSave={save}
        />
      )}
    </div>
  );
};
