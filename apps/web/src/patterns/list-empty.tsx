import { EmptyState, Icon } from '@crefle/web-ui';
import type { ReactNode } from 'react';

export interface ListEmptyProps {
  title: ReactNode;
  /** 회색 보조 문구 — 자연스러운 말이 있을 때만. */
  description?: ReactNode;
  /** 둥근 바탕 안의 아이콘 이름. 없으면 목록 아이콘(`assignment`). */
  icon?: string;
  /** 조회 결과처럼 바뀌어 나타나는 빈 상태면 켠다(`role="status"`). */
  live?: boolean;
  action?: ReactNode;
}

/**
 * 목록이 비었을 때의 안내 — 오른쪽 상세의 「고르기 전」 안내와 같은 모양(둥근 바탕 아이콘 + 굵은 제목 + 회색 보조
 * 문구, 가운데). 표는 머리줄을 그대로 두고 빈 줄 안에 이것을 낸다(사용자 결정 2026-11-25).
 */
export const ListEmpty = ({
  title,
  description,
  icon = 'assignment',
  live,
  action,
}: ListEmptyProps) => (
  <EmptyState
    size="sm"
    live={live}
    className="list-empty"
    icon={
      <span className="inspection-standard-empty-icon">
        <Icon name={icon} size={20} />
      </span>
    }
    title={title}
    description={description}
    action={action}
  />
);

/** 디자인 시스템 표가 아닌 직접 그린 `<table>` 의 빈 줄 — 머리줄 아래 한 칸을 열 수만큼 넓혀 `ListEmpty` 를 둔다. */
export const ListEmptyRow = ({ colSpan, ...props }: ListEmptyProps & { colSpan: number }) => (
  <tr className="list-empty-row">
    <td colSpan={colSpan}>
      <ListEmpty {...props} />
    </td>
  </tr>
);
