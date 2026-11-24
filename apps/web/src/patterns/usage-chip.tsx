import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.common.usage;

/**
 * 쓰는지 여부 라벨 「사용 / 미사용」 — 관리웹 모든 화면의 목록 칸 · 상세 칸이 이 모양 하나로 쓴다(사용자 지시 2026-11-24
 * 「전반적인 화면의 상태는 사용/미사용 으로 문구 통일하고 라벨 디자인」). 사용은 초록, 미사용은 회색 — ERP 공통코드의
 * 사용 여부 라벨과 같다.
 */
export const UsageChip = ({ isActive }: { isActive: boolean }) => (
  <Chip variant="status" size="sm" status={isActive ? 'success' : 'idle'}>
    {isActive ? t.active : t.inactive}
  </Chip>
);

/**
 * 목록 이름 칸 — 미사용 줄만 이름 옆에 「미사용」 라벨을 붙인다. 이름 뒤 「(미사용)」 글자를 대신한다(사용자 지시 2026-11-24 ·
 * #358). 사용 여부 열이 따로 없는 목록에 쓴다 — 사용인 줄까지 라벨을 붙이면 이름 칸이 라벨로 덮인다.
 */
export const UsageName = ({ isActive, children }: { isActive: boolean; children: ReactNode }) => (
  <span className="usage-name">
    {children}
    {!isActive && <UsageChip isActive={false} />}
  </span>
);
