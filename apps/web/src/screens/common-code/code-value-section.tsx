import { Button, EmptyState, SkeletonText, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { CodeValueFormPane } from './code-value-form-pane';
import { CodeValueListPane } from './code-value-list-pane';
import {
  codeValueToFormValues,
  emptyCodeValueFormValues,
  isSameCodeValueValues,
  toCodeValueCreate,
  toCodeValueUpdate,
} from './code-value-mappers';
import {
  codeValueDetailPath,
  codeValueKeys,
  useCodeValueDetail,
  useCodeValueList,
} from './code-value-queries';
import type { CodeValue, CodeValueFormValues } from './code-value-types';
import { CODE_VALUE_FORM_FIELDS, validateCodeValueForm } from './code-value-validation';
import { DeactivateDialog } from './deactivate-dialog';
import { DisabledAction } from './disabled-action';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';

type CodeValueDetailResponse = components['schemas']['CodeValueDetailResponse'];

const t = messages.commonCode.codeValue;

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, 출처가 바뀔 때만 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 *
 * **출처는 등록과 수정을 함께 담는다** — 수정은 상세 응답 객체이고, 등록은 바깥이 준
 * 「지금 등록 중이다」에서 파생한 문자열이다. 등록 폼의 값을 이 부품의 로컬 상태에만 두면
 * 소비 화면이 주소로 폼을 여닫을 때 값이 따라 살아나지 못한다.
 */
type CodeValueFormSource = string | CodeValueDetailResponse;

interface CodeValueFormState {
  source: CodeValueFormSource;
  baseline: CodeValueFormValues;
  values: CodeValueFormValues;
}

export interface CodeValueSectionProps {
  /**
   * 이 한 벌이 아는 유일한 바깥 사실.
   * 코드값만 다루는 화면은 여기에 자기 코드그룹 번호를 고정으로 넘긴다.
   */
  codeGroupId: number | null;
  selectedCodeValueId: number | null;
  onSelectCodeValue: (codeValueId: number) => void;
  /**
   * 등록 폼이 열려 있는가. 이 값도 소비 화면이 소유한다(주소에 둘 수 있다).
   *
   * 여닫음을 **조작 단위 콜백**으로 나눈 이유는 소비 화면이 한 조작을 주소 갱신 한 번으로
   * 끝낼 수 있어야 하기 때문이다 — 「선택을 비우면서 등록을 켠다」를 두 번으로 나눠 부르면
   * 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   */
  isCreating: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  includeInactive: boolean;
  onIncludeInactiveChange: (includeInactive: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * **코드값 편집 한 벌의 조립부.** 이 한 벌의 부품·조회·쓰기 3종을 묶는다.
 *
 * **주소를 읽지 않는다.** 조회 조건·선택·쪽은 전부 props로 들어오고, 주소는 이 한 벌을
 * 소비하는 화면이 소유한다 — 그래야 코드값만 다루는 다른 화면이 자기 주소 규약으로 쓸 수 있다.
 *
 * **다른 자원(코드그룹·부서·작업자·자격)과 탭 정의를 참조하지 않는다.** 참조하면 한 벌을
 * 통째로 옮길 수 없다(omf-mes#13 §5).
 *
 * `codeGroupId`가 `null`이면 빈 상태를 내고 **조회 요청을 보내지 않는다** —
 * 계약이 그 값을 필수 쿼리로 두어 빼고 부르면 422다.
 *
 * **정렬 순서 저장은 그 행의 수정 한 번이다.** 전체 치환이 아니다 —
 * `display_order`에 유일 제약이 없어 중간 상태가 제약을 위반하지 않는다.
 */
export const CodeValueSection = ({
  codeGroupId,
  selectedCodeValueId,
  onSelectCodeValue,
  isCreating,
  onOpenCreate,
  onCloseCreate,
  includeInactive,
  onIncludeInactiveChange,
  page,
  onPageChange,
}: CodeValueSectionProps) => {
  const toast = useToast();
  const { client } = useApiClient();

  const list = useCodeValueList(codeGroupId, includeInactive, page);
  const codeValues = list.data?.items ?? [];

  /* 서버가 준 쪽 정보를 정본으로 쓴다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다. */
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, codeValues.length);

  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const detailId = isCreating ? null : selectedCodeValueId;
  const detail = useCodeValueDetail(detailId);

  const [formState, setFormState] = useState<CodeValueFormState | null>(null);

  /**
   * 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 **바깥이 준 상태**가 정한다.
   * 그래야 소비 화면이 주소로 등록 폼을 열어 둔 채 새로고침해도 폼이 선다.
   *
   * 등록 출처에 그룹 번호를 넣는 이유는 그룹이 바뀌면 다른 그룹의 새 값이라 다시 세워야 하기 때문이다.
   */
  const formSource: CodeValueFormSource | null = isCreating
    ? `create:${String(codeGroupId ?? '')}`
    : (detail.data ?? null);

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded =
      typeof formSource === 'string'
        ? emptyCodeValueFormValues()
        : codeValueToFormValues(formSource.codeValue);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const isDirty =
    formState !== null && !isSameCodeValueValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /**
   * 코드값 수정 — **이 행 하나만 보낸다.**
   *
   * 정렬 순서를 고쳐도 다른 행에 요청을 보내지 않는다. `display_order`에 유일 제약이 없어
   * 중간 상태가 제약을 위반하지 않으므로 전체 치환이 필요 없다(계약이 두 곳에서 못 박았다).
   */
  const updateWrite = useMasterWrite<CodeValueFormValues, CodeValue>({
    request: (values, headers) =>
      client.PUT('/mdm/code-values/{codeValueId}', {
        params: {
          path: { codeValueId: selectedCodeValueId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toCodeValueUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     */
    etagPath: selectedCodeValueId === null ? null : codeValueDetailPath(selectedCodeValueId),
    invalidateKeys: [codeValueKeys.all],
    knownFields: CODE_VALUE_FORM_FIELDS,
    onSuccess: (saved) => {
      setFieldErrors({});
      const next = codeValueToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const createWrite = useMasterWrite<CodeValueFormValues, CodeValue>({
    request: (values, headers) =>
      client.POST('/mdm/code-values', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        // 좌측에서 고른 그룹으로 고정된다 — 계약이 등록에서만 이 값을 받는다.
        body: toCodeValueCreate(codeGroupId ?? 0, values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [codeValueKeys.all],
    knownFields: CODE_VALUE_FORM_FIELDS,
    onSuccess: (saved) => {
      setFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 코드값을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다.
       *
       * **바깥에 알리는 것은 이 한 번뿐이다.** 「등록을 끈다」와 「새 번호를 고른다」를
       * 나눠 부르면 소비 화면이 주소를 두 번 고치게 되고, 뒤로가기가 중간 상태로 떨어진다.
       * 고르는 것 자체가 등록을 끝냈다는 뜻이라 소비 화면이 한 번에 처리한다.
       */
      onSelectCodeValue(saved.codeValueId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 사용 중지 — 응답에 `ETag`가 없으므로 성공하면 상세까지 무효화해
   * 재조회가 새 토큰을 확보하게 한다. 빠뜨리면 그다음 저장이 조용히 막힌다.
   */
  const deactivateWrite = useMasterWrite<void, CodeValue>({
    request: (_variables, headers) =>
      client.POST('/mdm/code-values/{codeValueId}:deactivate', {
        params: {
          path: { codeValueId: selectedCodeValueId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /*
     * 요청 경로(`…:deactivate`)로 토큰을 꺼내면 언제나 비어 있어 사용 중지가 전부 실패한다.
     */
    etagPath: selectedCodeValueId === null ? null : codeValueDetailPath(selectedCodeValueId),
    invalidateKeys: [codeValueKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeWrite = isCreating ? createWrite : updateWrite;

  const resetEditing = () => {
    updateWrite.reset();
    createWrite.reset();
    deactivateWrite.reset();
    setIsDeactivateOpen(false);
    setFormState(null);
    setFieldErrors({});
  };

  /*
   * 조작마다 바깥 콜백을 **한 번만** 부른다. 소비 화면이 그 한 번으로 주소를 마무리할 수 있어야
   * 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어지지 않는다.
   */
  const handleSelect = (codeValueId: number) => {
    resetEditing();
    onSelectCodeValue(codeValueId);
  };

  const handleIncludeInactiveChange = (next: boolean) => {
    resetEditing();
    onIncludeInactiveChange(next);
  };

  const handlePageChange = (next: number) => {
    resetEditing();
    onPageChange(next);
  };

  const handleAdd = () => {
    resetEditing();
    onOpenCreate();
  };

  const closeCreateForm = () => {
    createWrite.reset();
    setFieldErrors({});
    onCloseCreate();
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeValues = (patch: Partial<CodeValueFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      activeWrite.clearFieldError(field);
      setFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (formState === null) return;

    const errors = validateCodeValueForm(formState.values);
    setFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    activeWrite.write(formState.values);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const reloadDetail = () => {
    updateWrite.reset();
    deactivateWrite.reset();
    setFieldErrors({});
    setFormState(null);
    void detail.refetch();
  };

  /*
   * 계약이 코드그룹을 필수로 두어 그룹 없이는 만들 자리 자체가 없다.
   * 감추지 않고 사유와 함께 비활성으로 둔다 — 감추면 「이 화면에는 없는 기능」으로 오해한다.
   */
  const addAction: ReactNode =
    codeGroupId === null ? (
      <DisabledAction label={t.actions.add} reason={t.actionReasons.addNeedsGroup} />
    ) : (
      <div className="field-cell">
        <Button variant="outlined" disabled={isCreating} onClick={handleAdd}>
          {t.actions.add}
        </Button>
      </div>
    );

  const deactivateDisabledReason =
    detail.data?.codeValue.isActive === false ? t.actionReasons.deactivateAlreadyDone : null;

  /**
   * 코드값 정보 구획. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderFormPane = (): ReactNode => {
    if (isCreating) {
      if (formState === null) return null;

      return (
        <CodeValueFormPane
          mode="create"
          values={formState.values}
          onChange={changeValues}
          fieldErrors={{ ...createWrite.fieldErrors, ...fieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={createWrite.error} />}
          /* 등록에서는 코드 칸이 열려 있다 — 아직 참조할 자료가 없다. */
          codeLockReason={null}
          deactivateDisabledReason={null}
          isDirty={isDirty}
          isSaving={createWrite.isSaving}
          onSave={handleSave}
          onCancel={closeCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedCodeValueId === null) {
      return (
        <section className="pane" aria-label={t.formPaneTitle}>
          <EmptyState
            size="sm"
            title={codeGroupId === null ? t.empty.groupNotSelected : t.empty.notSelected}
          />
        </section>
      );
    }

    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.formPaneTitle}>
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </section>
      );
    }

    if (detail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.formPaneTitle}>
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <CodeValueFormPane
        mode="edit"
        values={formState.values}
        onChange={changeValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...updateWrite.fieldErrors, ...fieldErrors }}
        banner={<SaveErrorBanner error={updateWrite.error} onReload={reloadDetail} />}
        /*
         * 판정의 주인은 서버가 준 `codeEditable`이다. 화면이 스스로 잠그지 않는다 —
         * 코드값의 코드는 전 하류가 문자열로만 참조해 참조 건수를 셀 수 없어 늘 잠긴다.
         */
        codeLockReason={codeLockMessage(detail.data.editability)}
        deactivateDisabledReason={deactivateDisabledReason}
        isDirty={isDirty}
        isSaving={updateWrite.isSaving}
        onSave={handleSave}
        onCancel={() => {
          setFieldErrors({});
          updateWrite.reset();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          deactivateWrite.reset();
          setIsDeactivateOpen(true);
        }}
      />
    );
  };

  return (
    <>
      <CodeValueListPane
        codeValues={codeValues}
        // 그룹을 고르기 전에는 아무것도 기다리지 않는다 — 조회가 나가지도 않았다.
        isLoading={codeGroupId !== null && list.isPending}
        isGroupSelected={codeGroupId !== null}
        includeInactive={includeInactive}
        onIncludeInactiveChange={handleIncludeInactiveChange}
        pageView={pageView}
        onChangePage={handlePageChange}
        selectedCodeValueId={selectedCodeValueId}
        onSelect={handleSelect}
        addAction={addAction}
        loadError={
          list.isError ? (
            <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
          ) : null
        }
      />

      {renderFormPane()}

      {/*
       * 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다.
       * 실패해도 창을 닫지 않는다 — 닫으면 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {isDeactivateOpen && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateTitle}
          onClose={() => {
            setIsDeactivateOpen(false);
            deactivateWrite.reset();
          }}
          onConfirm={() => {
            deactivateWrite.write(undefined);
          }}
          isSaving={deactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={<SaveErrorBanner error={deactivateWrite.error} onReload={reloadDetail} />}
        />
      )}
    </>
  );
};
