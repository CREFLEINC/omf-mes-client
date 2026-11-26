import { Button, Checkbox, Chip, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { UsageChip } from '../../patterns/usage-chip';
import { ErpDetailFields } from '../erp-item/erp-data-parts';
import type { PartnerRoleChoice } from './partner-role-draft';
import { type PartnerRoleKey, partnerRoleKeyOf } from './partner-role-vocab';
import type { Partner } from './types';

const t = messages.commonCode;

export interface PartnerRolePaneProps {
  partner: Partner;
  /** 체크칸으로 설 역할 전부 — 어휘 다섯 + 지금 붙어 있는 어휘 밖 코드 */
  choices: PartnerRoleChoice[];
  /**
   * 서버에 붙어 있는 역할이 하나라도 있는가. **체크 상태가 아니라 저장된 상태를 가리킨다** —
   * 「지정된 역할이 없습니다」는 사용자가 방금 끈 결과가 아니라 서버의 사실을 말해야 한다.
   */
  hasSavedRole: boolean;
  isRolesLoading: boolean;
  /**
   * 역할 조회 실패 표시. null이 아니면 체크칸·빈 상태 대신 이것을 낸다 —
   * 실패를 「지정된 역할이 없습니다」로 보이면 **역할이 없는 거래처로 읽히고**,
   * 그 상태로 저장하면 사용자가 의도한 적 없는 전체 해제가 나간다.
   */
  rolesLoadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  /**
   * **막을 것 — 전역이다.** 이 화면의 역할 저장은 한 번에 하나뿐이라(훅 하나에 요청 하나),
   * 다른 거래처의 저장이 나가는 중이면 여기서도 새 저장을 시작할 수 없다. 두 번째를 내면
   * 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다.
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 구획의 저장인가.** 진행 표시는 자기 저장에만 돈다 —
   * 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 거래처를 「저장 중」이라고 말한다.
   */
  isSaving: boolean;
  onToggleRole: (roleTypeCode: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

/**
 * 우 칸 — 거래처 기본 정보(읽기)와 그 거래처의 역할(편집).
 *
 * **기본 정보는 값 표기만 있다**(결정 12 — 표시 방법 정정). 거래처 본체는 ERP 수신 마스터라
 * 계약에 등록·수정 경로가 **아예 없다** — 그래서 폼 컨트롤을 잠그는 것이 아니라 두지 않는다.
 * 비활성 입력칸을 두면 「언젠가 열린다」는 뜻이 되는데 그 경로가 없다. 같은 슬라이스의 작업자
 * 기본 정보(`worker-detail-pane.tsx`)가 세운 형태를 그대로 되풀이한다.
 *
 * **「할 수 없다」는 감추지 않는다** — 구획 머리에 사유를 상시 표시한다. 문구는 이미 있는
 * 공통 문구를 쓰고 이 화면 전용 문구를 만들지 않는다.
 *
 * **내부 번호(`partnerId`)를 내지 않는다** — 주소와 조회에만 쓰는 식별자다.
 *
 * **역할은 체크칸 목록이다.** 표의 선택 열을 쓰면 머리글에 전체 선택이 생기는데, 이 자리에서
 * 그것은 「이 거래처에 모든 역할을 준다」가 된다. 저장은 **통째 교체**라 「저장」에서 최종
 * 상태가 한 번에 나간다 — 계약에 개별 추가·삭제 경로가 없다.
 *
 * **어휘 밖 코드를 감추지 않는다**(결정 8). 목록에서 빼면 저장하는 순간 조용히 해제되고,
 * 사용자는 자기가 지우지 않은 것이 사라진 것을 알 방법이 없다. 다만 **새로 붙일 수는 없다** —
 * 자유 입력칸을 두지 않는다(값 목록은 서버 소관이고, 화면이 지어낸 코드는 서버가 모른다).
 */
export const PartnerRolePane = ({
  partner,
  choices,
  hasSavedRole,
  isRolesLoading,
  rolesLoadError,
  banner,
  isDirty,
  isLocked,
  isSaving,
  onToggleRole,
  onSave,
  onCancel,
}: PartnerRolePaneProps) => {
  const unknownNoteId = useId();
  /** 역할마다 무엇을 정하는지 — 근거가 있는 역할만 문구가 있다(i18n 주석). */
  const roleDescriptions: Partial<Record<PartnerRoleKey, string>> = t.partnerRole.descriptions;
  const descriptionOf = (code: string): string | undefined => {
    const key = partnerRoleKeyOf(code);
    return key === undefined ? undefined : roleDescriptions[key];
  };
  const hasUnknown = choices.some((choice) => !choice.isKnown);

  /** 저장 자리. 잠긴 까닭을 단추 아래 문구로 내지 않는다 — 꺼진 단추로만(사용자 지시 2026-11-25). */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {messages.common.save}
        </Button>
      );
    }

    /*
     * 남의 저장이 나가는 중이거나 고친 것이 없으면 잠그기만 한다 — 저장 단추 아래 사유 문구는 두지 않는다
     * (사용자 지시 2026-11-25).
     */
    return (
      <Button disabled={isLocked || !isDirty} onClick={onSave}>
        {messages.common.save}
      </Button>
    );
  };

  const roleSlot = (): ReactNode => {
    if (rolesLoadError !== null && rolesLoadError !== undefined) return rolesLoadError;

    if (isRolesLoading) {
      return (
        <div role="status" aria-label={t.loading.partnerRoles}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <>
        {/*
         * 체크칸이 전부 꺼져 있는 것만으로도 보이지만 **말로도 밝힌다** —
         * 못 불러온 것과 없는 것이 구분돼야 한다(위 두 갈래와 갈리는 자리다).
         *
         * 체크칸이 늘 여섯 서므로 구획이 「비어 있지」 않아 `EmptyState`는 쓰지 않는다. 다만
         * 그것이 갖고 있던 **안내 영역(`live`)은 유지한다** — 거래처를 옮겨 「역할 없음」이
         * 새로 뜨는 순간이 보조기술에 읽히지 않으면 좌 목록만 보고 있는 사용자는 그 사실을
         * 놓친다. 위 로딩 갈래와 함께 서지 않으므로 안내 영역이 둘이 되지 않는다.
         */}
        {!hasSavedRole && (
          <p role="status" className="field-note">
            {t.partnerRole.empty.noneTitle}
          </p>
        )}

        {/* 역할 확인칸은 상자 폭만큼 가로로 흐르고 모자라면 다음 줄로(사용자 지시 2026-11-25 · layout.css). */}
        <div className="check-group common-code-partner-roles">
          {choices.map((choice) => {
            const description = descriptionOf(choice.roleTypeCode);

            return (
              /*
               * 역할 이름 옆 ⓘ — 그 역할이면 어느 화면에서 고를 수 있는지는 마우스를 올리면 보인다(사용자 지시 2026-11-26).
               * ⓘ 는 체크칸 라벨 밖에 두어 눌러도 체크가 바뀌지 않는다. 설명이 없는 역할은 ⓘ 도 없다.
               */
              <div key={choice.roleTypeCode} className="common-code-partner-role">
                <Checkbox
                  checked={choice.isSelected}
                  /* 나가는 중에 체크가 바뀌면 확인한 것과 다른 것이 저장된 것처럼 보인다. */
                  disabled={isLocked}
                  /* 여러 확인칸이 함께 보는 안내라 각 칸에 되풀이하지 않고 하나를 잇는다. */
                  aria-describedby={choice.isKnown ? undefined : unknownNoteId}
                  onChange={() => {
                    onToggleRole(choice.roleTypeCode);
                  }}
                >
                  {choice.label}
                  {!choice.isKnown && (
                    <>
                      {/* 이름과 표식이 붙어 읽히지 않게 낱말 사이 공백 하나를 둔다. */}{' '}
                      <Chip variant="status" status="warning" size="sm">
                        {t.partnerRole.unknownBadge}
                      </Chip>
                    </>
                  )}
                </Checkbox>
                {description !== undefined && <InfoTip text={description} />}
              </div>
            );
          })}
        </div>

        {/*
         * 어휘 밖 역할은 **저장하면 반드시 해제된다** — 계약이 그 값을 400으로 거절해
         * 치환 본문에 실을 수 없다(#173). 체크를 끄지 않아도 해제되고, 해제되면 이 화면에는
         * 다시 붙일 수단이 남지 않으므로 누르기 전에 그 비대칭을 밝힌다. 사유는 감추지 않고
         * 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는다(배치 규범 4).
         */}
        {hasUnknown && (
          <p id={unknownNoteId} className="field-note">
            {t.partnerRole.unknownNote}
          </p>
        )}

        <div className="form-actions">
          <Button variant="outlined" disabled={!isDirty || isLocked} onClick={onCancel}>
            {messages.common.cancel}
          </Button>

          {saveAction()}
        </div>
      </>
    );
  };

  /*
   * 구획 둘을 나란히 낸다 — 담는 쪽(`screen.tsx`의 `.pane-stack`)이 이음매를 소유한다.
   * 같은 화면의 작업자 탭(기본 정보 + 자격·인증)과 같은 형태다.
   */
  return (
    <>
      <section className="pane" aria-label={t.panes.partnerDetail}>
        {/*
         * 작업자 탭과 같은 구획 제목(사용자 지시 2026-11-26). 오른쪽 위 「외부 시스템에서 받은 자료라…」 안내는 걷었다 —
         * 입력칸 · 단추가 없어 고칠 수 없다는 것이 이미 보인다.
         */}
        <div className="pane-heading-row users-roles-heading">
          <h3 className="pane-title">{t.panes.partnerDetail}</h3>
        </div>

        {/* ERP 조회 화면의 정보 표시 상자와 같은 모양(사용자 지시 2026-11-25). 사용 여부는 상태 칩 그대로. */}
        <div className="erp-data-detail erp-data-detail-fill">
          <ErpDetailFields
            fields={[
              {
                key: 'partnerCode',
                label: t.partner.fields.partnerCode,
                value: orEmptyMark(partner.partnerCode),
              },
              {
                key: 'partnerName',
                label: t.partner.fields.partnerName,
                value: orEmptyMark(partner.partnerName),
              },
              {
                key: 'country',
                label: t.partner.fields.country,
                value: orEmptyMark(partner.countryCode),
              },
              {
                key: 'erpPartnerCode',
                label: t.partner.fields.erpPartnerCode,
                value: orEmptyMark(partner.erpPartnerCode),
              },
              {
                key: 'isActive',
                label: t.partner.fields.isActive,
                value: <UsageChip isActive={partner.isActive} />,
              },
            ]}
          />
        </div>
      </section>

      <section className="pane" aria-label={t.panes.partnerRoles}>
        {/* 무엇을 설정하는 구획인지 제목으로 밝힌다 — 생산 창고 · 자격·인증 구획 제목과 같은 모양(사용자 지시 2026-11-26). */}
        <div className="section-heading-row">
          <h3 className="subsection-title">{t.panes.partnerRoles}</h3>
        </div>
        {banner}
        {roleSlot()}
      </section>
    </>
  );
};
