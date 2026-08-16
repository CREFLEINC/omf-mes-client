import { Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { PartnerRoleOption } from './partner-role-draft';

const t = messages.commonCode.partnerRole;

export interface PartnerRoleConfirmDialogProps {
  /** 저장하면 해제되는 역할 전부. **어휘 밖 코드도 든다**(결정 8) */
  released: PartnerRoleOption[];
  /** 저장한 뒤 이 거래처에 역할이 하나도 남지 않는가 */
  willHaveNoRole: boolean;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 역할을 해제하는 저장의 확인 — **잃는 것이 있을 때만 선다**(결정 10).
 *
 * 저장이 통째 교체라 **목록에 없는 역할은 해제된다.** 이 창이 하는 일은 그 사실을 이름으로
 * 밝히는 것 하나이고, 그것이 이 화면에서 되돌릴 수 없는 손실을 막는 유일한 방어다.
 * 추가만 하는 저장에는 창을 세우지 않는다 — 확인이 습관이 되면 정작 잃는 저장에서도 읽히지 않는다.
 *
 * **스크림 클릭·X로 닫히지 않게 한다**(`closeOnBackdropClick={false}`·`showCloseButton={false}`).
 * 잃는 것을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다.
 * Escape는 막을 수 없으므로 그 길의 규율은 화면의 `resetIfIdle`이 갖는다 —
 * **닫혀도 나가는 중인 쓰기를 끊지 않는다.**
 *
 * **실패해도 창을 닫지 않는다.** 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PartnerRoleConfirmDialog = ({
  released,
  willHaveNoRole,
  isSaving,
  banner,
  onConfirm,
  onClose,
}: PartnerRoleConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.dialog.title}
    closeOnBackdropClick={false}
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.dialog.keepEditing}
        </Button>
        <Button disabled={isSaving} loading={isSaving} onClick={onConfirm}>
          {t.dialog.confirm}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.dialog.lead}</p>

    <ul>
      {/* 계약이 (거래처, 역할)을 유일하게 두므로 코드가 곧 안정적인 행 식별자다. */}
      {released.map((role) => (
        <li key={role.roleTypeCode}>
          {role.label}
          {!role.isKnown && (
            <>
              {/*
               * 이름과 표식이 붙어 읽히지 않게 낱말 사이 공백 하나를 둔다.
               * 어휘 밖 역할은 **해제하면 이 화면에서 다시 붙일 수 없어** 가장 위험한 자리다 —
               * 창에서마저 흐려지면 무엇을 잃었는지 되짚을 단서가 남지 않는다.
               */}{' '}
              <Chip variant="status" status="warning" size="sm">
                {t.unknownBadge}
              </Chip>
            </>
          )}
        </li>
      ))}
    </ul>

    {willHaveNoRole && <p>{t.dialog.noneLeft}</p>}
  </Dialog>
);
