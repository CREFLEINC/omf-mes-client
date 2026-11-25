import { Button, Dialog, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { requiredEmptyClass } from '../users-roles/required-empty';

import { approvalTypeLabelOf, codeNote, codePlaceholder } from './code-options';
import { DisabledAction } from './disabled-action';
import { ActiveChip } from './route-list-pane';
import type { RouteFormMode } from './route-validation';
import { SelectField } from './select-field';
import type { RouteFormValues, RouteView, SelectOption } from './types';

const t = messages.approvalRoute;

export interface RouteFormPaneProps {
  mode: RouteFormMode;
  /**
   * 서버가 준 결재선. **등록에는 없다** — 아직 만들어지지 않은 자원이라 사용 여부도 단계 수도
   * 진행 중 건수도 존재하지 않는다. 없는 값을 0으로 채워 보이면 사용자가 그것을 자료로 읽는다.
   */
  route: RouteView | null;
  values: RouteFormValues;
  onChange: (patch: Partial<RouteFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /**
   * 승인 유형 선택지. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 바깥에서 잴 수 없다.
   */
  approvalTypeOptions: SelectOption[];
  /**
   * 등록 팝업 승인 유형 선택지에서 뺄 유형 — 고른 사업부에 이미 사용 중인 결재선이 있다(사용자 지시 2026-11-25).
   * 「값 목록을 못 받았다」 안내는 빼기 전 목록으로 판단한다 — 다 빠졌으면 선택칸의 빈 상태가 말한다.
   */
  hiddenApprovalTypeCodes?: ReadonlySet<string>;
  businessUnitOptions: SelectOption[];
  /** 사업부 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  businessUnitNote?: string;
  /** 활성 중복을 판정하지 못했다는 안내. **막지 않는다** — 서버가 다시 검사한다. */
  duplicateUnknownNote: string | null;
  /** 활성 중복으로 막혔을 때 기존 결재선으로 옮겨 가는 길. 막히지 않았으면 `null`. */
  onOpenExisting: (() => void) | null;
  /** `null`이면 저장할 수 있다. 값이 있으면 그것이 비활성 사유다(배치 규범 4). */
  saveDisabledReason: string | null;
  /** 「다시 사용」의 비활성 사유. 사용 중인 결재선에는 그 버튼 자체가 서지 않는다. */
  activateDisabledReason: string | null;
  isDirty: boolean;
  /**
   * 어느 쓰기든 나가는 중인가. **네 쓰기가 한 벌의 잠금 토큰을 나눠 쓰므로 함께 잠긴다** —
   * 동시에 나가면 뒤엣것이 반드시 409다.
   */
  isLocked: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}

/**
 * 고른 결재선의 내용과 **등록·수정 폼**.
 *
 * ## 이 폼이 소유하지 않는 것
 *
 * - **승인 유형(수정)** — 계약의 수정 본문에 그 키가 아예 없다. 「바꾸면 다른 결재선이다」가
 *   계약의 말이며, 읽기 표시로 두고 그 사실을 라벨 옆 ⓘ 로 밝힌다.
 * - **사용 여부** — 전용 액션(`:deactivate`·`:activate`)으로만 바뀐다. 입력칸을 두면
 *   저장 본문에 실릴 여지가 생긴다.
 * - **결재 단계** — 등록 본문에 단계를 실을 수 없고 치환은 번호를 요구한다. 등록 중에는
 *   붙일 대상 자체가 없어 단계 구획이 서지 않는다.
 *
 * ## 비움 경고를 창이 아니라 폼 안에 둔다 (계획 §13-4)
 *
 * 이 저장은 **전체 교체**라 비운 칸이 「그대로 둔다」가 아니라 「비운다」로 나간다. 그 사실은
 * 그 칸 바로 옆에서 읽히는 것이 정확하고, 결재선 수정은 다시 저장하면 되돌릴 수 있다 —
 * 창은 **되돌리는 데 다른 사람의 업무가 걸리는 조작**(끄기·켜기)에만 둔다.
 *
 * ## 진행 중 건수를 상시 자리에 둔다
 *
 * 사용 중지 확인 창에만 두면 결재선을 *고치는* 사람은 자기가 무엇에 영향을 주지 *않는지*를
 * 끝내 모른다 — 진행 중인 요청은 지금의 결재선으로 끝난다. 건수는 결재선 응답이 직접 실어
 * 오는 파생값이라 화면이 세지 않는다.
 *
 * **「이 결재선이 지금 상신에 쓰입니다」라고 말하지 않는다.** 같은 유형·사업부로 사용 중인
 * 결재선이 둘 이상일 수 있고 고르는 규칙은 서버가 갖는다 — 화면은 자기가 아는 사실만 말한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RouteFormPane = ({
  mode,
  route,
  values,
  onChange,
  fieldErrors,
  banner,
  approvalTypeOptions,
  hiddenApprovalTypeCodes,
  businessUnitOptions,
  businessUnitNote,
  duplicateUnknownNote,
  onOpenExisting,
  saveDisabledReason,
  activateDisabledReason,
  isDirty,
  isLocked,
  onSave,
  onCancel,
  onDeactivate,
  onActivate,
}: RouteFormPaneProps) => {
  const minValueId = useId();
  const maxValueId = useId();

  const isCreate = mode === 'create';
  /* 이 화면에는 저장이 둘이라 무엇을 저장하는지 적는다(사용자 지시 2026-11-24). */
  const saveLabel = isCreate ? t.actions.submitCreate : t.actions.saveRoute;

  /**
   * 「선택 없음」이 곧 **전 사업부 공통**이다 — 특별한 값이 아니라 값이 없는 것이다.
   * 빈 선택지를 두지 않으면 한 번 고른 뒤에 다시 비울 방법이 칸 안에 없어진다.
   * 폼에서는 「전체 사업부」로 읽힌다(사용자 지시 2026-11-25) — 목록 열은 종전 이름 그대로다.
   */
  const businessUnitChoices: SelectOption[] = [
    { value: '', label: t.values.allBusinessUnitsOption },
    ...businessUnitOptions,
  ];

  const formGrid = (
    <div className="form-grid">
      {isCreate && (
        /* 등록에서만 입력칸이다. 고정 OpenAPI enum 선택지를 그대로 사용한다. */
        <SelectField
          required
          label={t.fields.approvalTypeCode}
          options={
            hiddenApprovalTypeCodes === undefined
              ? approvalTypeOptions
              : approvalTypeOptions.filter((option) => !hiddenApprovalTypeCodes.has(option.value))
          }
          value={values.approvalTypeCode}
          note={codeNote(approvalTypeOptions)}
          error={fieldErrors.approvalTypeCode}
          placeholder={
            approvalTypeOptions.length === 0 ? codePlaceholder() : t.fields.approvalTypePlaceholder
          }
          /* 필수 칸이 비면 빨간 테두리 — 공통코드 등록 팝업과 같은 방식(#333 · #358). */
          className={requiredEmptyClass(values.approvalTypeCode)}
          disabled={isLocked}
          onChange={(value) => {
            onChange({ approvalTypeCode: value });
          }}
        />
      )}

      {/*
       * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면 선택지 목록이
       * 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
       */}
      <SelectField
        wide
        label={t.fields.businessUnit}
        options={businessUnitChoices}
        value={values.businessUnitId}
        /* 비웠을 때의 뜻 안내는 걷었다(사용자 지시 2026-11-25) — 선택지 이름 「전체 사업부」가 말한다. 잘림 · 실패 안내는 그대로. */
        note={businessUnitNote}
        error={fieldErrors.businessUnitId}
        disabled={isLocked}
        onChange={(value) => {
          onChange({ businessUnitId: value });
        }}
      />

      {/*
       * 하한 · 상한은 한 묶음(사용자 지시 2026-11-24). 이름은 「수량 범위」 한 줄만 두고 하한 · 상한은 칸 안 흐린 글자와
       * 접근 이름으로 — 옆 사업부 칸과 입력칸 윗선이 맞는다(사용자 지시 2026-11-25). 좁으면 묶음이 통째로 다음 줄로 간다.
       */}
      {/* 등록 팝업에서는 줄 전체를 쓴다 — 하한 · 상한이 팝업 너비를 반씩 나눈다(사용자 지시 2026-11-25). */}
      <fieldset
        className={isCreate ? 'approval-route-range form-grid-full' : 'approval-route-range'}
      >
        <legend className="field-label info-label">
          {t.fields.valueRange}
          {/*
           * 비웠을 때의 뜻도 칸 아래가 아니라 ⓘ 안에 둘째 줄로(사용자 지시 2026-11-25). 문장은 라벨을 가리지 않게
           * ⓘ 오른쪽으로 띄운다.
           */}
          <InfoTip
            text={`${t.notes.valueRangeUnused}\n${t.notes.valueRangeEmpty}`}
            placement="right"
          />
        </legend>
        <div className="approval-route-range-row">
          <div className="field-cell">
            <TextField
              id={minValueId}
              aria-label={t.fields.minValue}
              placeholder={t.fields.minValuePlaceholder}
              value={values.minValue}
              /* 숫자 자판을 띄우되 형식 판정은 화면이 한다 — 브라우저마다 허용 글자가 다르다. */
              inputMode="decimal"
              error={fieldErrors.minValue}
              disabled={isLocked}
              onChange={(event) => {
                onChange({ minValue: event.target.value });
              }}
            />
          </div>
          <span className="approval-route-range-sep" aria-hidden>
            ~
          </span>
          <div className="field-cell">
            <TextField
              id={maxValueId}
              aria-label={t.fields.maxValue}
              placeholder={t.fields.maxValuePlaceholder}
              value={values.maxValue}
              inputMode="decimal"
              error={fieldErrors.maxValue}
              disabled={isLocked}
              onChange={(event) => {
                onChange({ maxValue: event.target.value });
              }}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );

  /*
   * 막혔으면 **비활성 + 사유**로 둔다(배치 규범 4) — 사유가 없으면 사용자는 버튼이 왜
   * 안 눌리는지 알 방법이 없다. 전송 중에는 진행 표시가 그 자리를 대신한다.
   */
  const saveAction =
    saveDisabledReason === null ? (
      <Button variant="filled" loading={isLocked} disabled={isLocked} onClick={onSave}>
        {saveLabel}
      </Button>
    ) : saveDisabledReason === t.actionReasons.saveNoChanges ||
      saveDisabledReason === t.actionReasons.createNoType ||
      (isCreate && saveDisabledReason === t.actionReasons.duplicateActive) ? (
      /*
       * 고친 것이 없을 때 · 등록에서 승인 유형을 고르기 전에는 꺼진 단추로만 — 「고친 내용이 없습니다」를 되풀이하지 않고
       * (사용자 지시 2026-11-24), 「승인 유형을 고르세요.」는 칸의 흐린 글자 · 빨간 테두리가 이미 말한다(2026-11-25).
       * 등록 팝업의 활성 중복 안내도 단추 아래에 내지 않는다(2026-11-25) — 쓰는 유형은 선택지에서 이미 빠진다.
       */
      <Button variant="filled" disabled>
        {saveLabel}
      </Button>
    ) : (
      <DisabledAction variant="filled" label={saveLabel} reason={saveDisabledReason} />
    );

  /*
   * 등록은 팝업 — 공통코드 「그룹 추가」 팝업과 같은 모양(사용자 지시 2026-11-25 · #358). 열고 닫힘은 종전대로 주소의
   * 등록 상태(`new=`)가 쥐고, 닫기(취소 · Esc)는 등록 폼을 접는 같은 처리로 간다. 바깥을 눌러도 닫히지 않는다.
   */
  if (isCreate) {
    return (
      <Dialog
        open
        onClose={onCancel}
        size="lg"
        title={t.panes.create}
        closeOnBackdropClick={false}
        showCloseButton={false}
        footer={
          <>
            {onOpenExisting !== null && (
              <Button variant="outlined" disabled={isLocked} onClick={onOpenExisting}>
                {t.actions.openExisting}
              </Button>
            )}
            {/* 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다. */}
            <Button variant="outlined" disabled={isLocked} onClick={onCancel}>
              {messages.common.cancel}
            </Button>
            {saveAction}
          </>
        }
      >
        {banner}
        {formGrid}
        {duplicateUnknownNote !== null && <p className="field-note">{duplicateUnknownNote}</p>}
      </Dialog>
    );
  }

  return (
    /* 고른 결재선이면 이름은 바깥 상세 칸이 갖는다 — 새 결재선일 때만 이 상자가 「새 결재선」 구획이 된다(#350 리뷰). */
    <section className="pane" aria-label={isCreate ? t.panes.create : undefined}>
      {banner}

      {route !== null && (
        /*
         * 결재선 기본 정보 카드(사용자 지시 2026-11-24) — 제목 아래 한 줄에 승인 유형과 사용 유무. 승인 유형은 입력칸이
         * 없는 값이라 표기로 낸다. 단계 수는 결재 단계 카드 제목 옆으로 옮겼다(표와 같은 기준으로 센다).
         */
        <div className="approval-route-head">
          {/*
           * 진행 중인 요청 안내는 제목 오른쪽 ⓘ — 마우스를 올리면 문구가 보인다(사용자 지시 2026-11-25). 문구는 그대로다.
           */}
          <div className="approval-route-head-title-row">
            <h2 className="pane-title">{t.panes.basicInfo}</h2>
            <InfoTip
              text={
                route.inProgressCount === 0
                  ? t.notes.inProgressNone
                  : t.notes.inProgressSome(route.inProgressCount)
              }
              placement="right"
            />
            {/*
             * 사용 전환은 **폼 저장과 다른 오퍼레이션**이라 액션이 따로 선다 — 제목 줄 오른쪽 끝(사용자 지시 2026-11-25).
             * 지금 상태에서 할 수 있는 쪽 하나만 낸다 — 둘을 함께 두면 지금 켜져 있는지 꺼져 있는지가 흐려진다.
             */}
            {route.isActive ? (
              /* 다른 마스터 화면(공통코드 부서 등)의 「사용 중지」와 같은 모양 — 작은 외곽선 + 금지 아이콘(사용자 지시 2026-11-25). */
              <Button
                className="approval-route-head-action"
                variant="outlined"
                size="sm"
                leadingIcon={<Icon name="block" size={18} />}
                disabled={isLocked}
                onClick={onDeactivate}
              >
                {messages.common.deactivate}
              </Button>
            ) : activateDisabledReason === null ? (
              <Button
                className="approval-route-head-action"
                variant="outlined"
                size="sm"
                disabled={isLocked}
                onClick={onActivate}
              >
                {t.actions.activate}
              </Button>
            ) : (
              <DisabledAction
                label={t.actions.activate}
                reason={activateDisabledReason}
                className="approval-route-head-action"
                size="sm"
              />
            )}
          </div>
          <p className="approval-route-head-line">
            <span className="info-label">
              {approvalTypeLabelOf(route.approvalTypeCode)}
              <InfoTip text={t.notes.approvalTypeFixed} />
            </span>
            <ActiveChip isActive={route.isActive} />
          </p>
        </div>
      )}

      {formGrid}

      {duplicateUnknownNote !== null && <p className="field-note">{duplicateUnknownNote}</p>}

      <div className="form-actions">
        {/*
         * 활성 중복으로 막혔을 때 **기존 결재선으로 옮겨 가는 길**을 함께 낸다.
         * 막기만 하면 사용자는 「그 기존 결재선이 어느 것인지」를 목록에서 다시 찾아야 하는데,
         * 그 행은 조준 조회가 이미 실어 왔다 — **추가 조회 없이** 그 번호로 옮긴다.
         */}
        {onOpenExisting !== null && (
          <div className="field-cell">
            <Button variant="outlined" size="sm" disabled={isLocked} onClick={onOpenExisting}>
              {t.actions.openExisting}
            </Button>
          </div>
        )}

        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다.
         */}
        <Button
          variant="outlined"
          disabled={isLocked || (!isCreate && !isDirty)}
          onClick={onCancel}
        >
          {/* 수정은 마지막 저장값으로 되돌리기, 등록은 폼을 닫기 — 둘 다 「취소」로 읽힌다(사용자 지시 2026-11-25). */}
          {isCreate ? messages.common.cancel : t.actions.discardChanges}
        </Button>

        {/*
         * 막혔으면 **비활성 + 사유**로 둔다(배치 규범 4) — 사유가 없으면 사용자는 버튼이 왜
         * 안 눌리는지 알 방법이 없다. 전송 중에는 진행 표시가 그 자리를 대신한다.
         */}
        {saveAction}
      </div>
    </section>
  );
};
