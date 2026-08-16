import { AlertBanner, Chip, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { isKnownPartnerRole, partnerRoleLabel, sortPartnerRoles } from './partner-role-vocab';
import type { Partner, PartnerRole } from './types';

const t = messages.commonCode;

export interface PartnerRolePaneProps {
  partner: Partner;
  roles: PartnerRole[];
  isRolesLoading: boolean;
  /**
   * 역할 조회 실패 표시. null이 아니면 목록·빈 상태 대신 이것을 낸다 —
   * 실패를 「지정된 역할이 없습니다」로 보이면 **역할이 없는 거래처로 읽힌다.**
   */
  rolesLoadError: ReactNode;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

/**
 * 우 칸 — 거래처 기본 정보와 그 거래처의 역할.
 *
 * **기본 정보는 잠긴 칸 + 상시 사유로 낸다**(결정 12 · 화면 스펙 §5-4의 표시 방법).
 * 거래처 본체는 ERP 수신 마스터라 계약에 등록·수정 경로가 없다 — 「할 수 없다」를 감추지 않고,
 * 사유를 항상 보이는 DOM 텍스트로 두고 다섯 칸 모두를 `aria-describedby`로 잇는다
 * (비활성 컨트롤은 포커스를 받지 못해 시각으로만 두면 보조기술이 닿을 수 없다 — 배치 규범 4).
 * 사유 문구는 이미 있는 공통 문구를 쓰고 이 화면 전용 문구를 만들지 않는다.
 *
 * **내부 번호(`partnerId`)를 내지 않는다** — 주소와 조회에만 쓰는 식별자다.
 *
 * **역할은 읽기만 한다.** 이 회차에는 저장·추가·삭제 컨트롤을 **비활성으로도** 두지 않는다 —
 * 죽은 컨트롤은 「눌러도 아무 일이 없는 버튼」이 되어 사용자를 기다리게 한다.
 *
 * **어휘 밖 코드를 감추지 않는다**(결정 8). 저장이 통째 교체라 목록에서 빼면 저장하는 순간
 * 조용히 해제되고, 사용자는 자기가 지우지 않은 것이 사라진 것을 알 방법이 없다.
 */
export const PartnerRolePane = ({
  partner,
  roles,
  isRolesLoading,
  rolesLoadError,
}: PartnerRolePaneProps) => {
  const noticeId = useId();

  /** 다섯 칸이 같은 사유를 본다 — 칸마다 같은 문장을 되풀이하면 구획을 읽을 수 없다. */
  const lockedField = (label: string, value: string) => (
    <div className="field-cell">
      {/* 값 갱신 경로가 없다 — `disabled`가 곧 「고칠 수 없다」이므로 변경 처리기를 두지 않는다. */}
      <TextField label={label} value={value} disabled aria-describedby={noticeId} />
    </div>
  );

  const roleSlot = (): ReactNode => {
    if (rolesLoadError !== null && rolesLoadError !== undefined) return rolesLoadError;

    if (isRolesLoading) {
      return (
        <div role="status" aria-label={t.loading.partnerRoles}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (roles.length === 0) {
      return <EmptyState size="sm" live title={t.partnerRole.empty.noneTitle} />;
    }

    return (
      <ul>
        {/*
         * 계약이 (거래처, 역할)을 유일하게 두므로 코드가 곧 안정적인 행 식별자다 —
         * 인덱스를 열쇠로 쓰면 목록이 바뀔 때 표식이 남의 항목에 옮겨 붙는다.
         */}
        {sortPartnerRoles(roles).map((role) => (
          <li key={role.roleTypeCode}>
            {partnerRoleLabel(role.roleTypeCode, role.roleTypeName)}
            {!isKnownPartnerRole(role.roleTypeCode) && (
              <Chip variant="status" status="warning" size="sm">
                {t.partnerRole.unknownBadge}
              </Chip>
            )}
          </li>
        ))}
      </ul>
    );
  };

  /*
   * 구획 둘을 나란히 낸다 — 담는 쪽(`screen.tsx`의 `.pane-stack`)이 이음매를 소유한다.
   * 같은 화면의 작업자 탭(기본 정보 + 자격·인증)과 같은 형태다.
   */
  return (
    <>
      <section className="pane" aria-label={t.panes.partnerDetail}>
        <div className="banner-slot">
          <AlertBanner variant="info">
            <span id={noticeId}>{messages.editability.receivedFromErp(null)}</span>
          </AlertBanner>
        </div>

        <div className="form-grid">
          {lockedField(t.partner.fields.partnerCode, partner.partnerCode)}
          {lockedField(t.partner.fields.partnerName, partner.partnerName)}
          {lockedField(t.partner.fields.country, orEmptyMark(partner.countryCode))}
          {lockedField(t.partner.fields.erpPartnerCode, orEmptyMark(partner.erpPartnerCode))}
          {lockedField(
            t.partner.fields.isActive,
            partner.isActive ? t.partner.values.active : t.partner.values.inactive,
          )}
        </div>
      </section>

      <section className="pane" aria-label={t.panes.partnerRoles}>
        {roleSlot()}
      </section>
    </>
  );
};
