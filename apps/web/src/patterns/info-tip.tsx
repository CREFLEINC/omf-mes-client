import { Icon, Tooltip } from '@crefle/web-ui';
import { useState, type SyntheticEvent } from 'react';

/** 옆에 이만큼 자리가 없으면 다른 쪽으로 띄운다 — 툴팁 최대 폭(22rem)과 간격. */
const SIDE_ROOM_PX = 22 * 16 + 16;

type Placement = 'right' | 'left' | 'top' | 'bottom';

/**
 * ⓘ — 알아 둘 규칙이지만 늘 펼쳐 둘 문장은 아닌 것(C-6 · 관리웹 정리 시안 A). 마우스를 올리거나 초점을
 * 주면 문장이 뜬다(DS `Tooltip`). 단추 이름이 곧 그 문장이다 — DS 툴팁은 뜬 뒤에야 설명을 이어 붙여,
 * 초점이 먼저 닿는 보조기술이 문장을 놓치지 않게. 라벨 · 제목 바로 뒤에 두고, 문장은 옆으로 줄을 바꿔 띄운다
 * (가운데 위로 띄우면 긴 문장이 화면 밖으로 잘린다). 방향을 주지 않으면 오른쪽, 오른쪽에 자리가 없으면 왼쪽,
 * 팝업 안에서 양쪽 다 모자라면 자리가 더 넓은 쪽이다.
 */
export const InfoTip = ({ text, placement }: { text: string; placement?: Placement }) => {
  const [side, setSide] = useState<Placement>(placement ?? 'right');
  const pickSide = (event: SyntheticEvent<HTMLElement>): void => {
    if (placement !== undefined) return;
    const { left, right } = event.currentTarget.getBoundingClientRect();
    /* 팝업 안이면 팝업 테두리 밖은 잘려 보이지 않는다 — 팝업 폭 안에서 자리를 본다(omf-all-around#360). */
    const bounds = event.currentTarget.closest('dialog')?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    };
    if (right + SIDE_ROOM_PX <= bounds.right) setSide('right');
    else if (left - SIDE_ROOM_PX >= bounds.left) setSide('left');
    else setSide(bounds.right - right >= left - bounds.left ? 'right' : 'left');
  };

  return (
    <Tooltip
      className="info-tip-anchor"
      placement={side}
      content={text}
      onMouseEnter={pickSide}
      onFocus={pickSide}
    >
      <button type="button" className="info-tip" aria-label={text}>
        <Icon name="info" size={16} aria-hidden />
      </button>
    </Tooltip>
  );
};

/**
 * 칸 라벨 + ⓘ — 칸 아래 설명문(C-6 금지)을 라벨 옆 ⓘ 로 옮길 때 쓴다. DS `TextField` · `Select` 의 라벨은 글자만
 * 받아 ⓘ 를 넣을 수 없으므로, 그 칸은 `label` 을 비우고 같은 `id` 를 주어 이 라벨에 잇는다.
 */
export const InfoLabel = ({
  htmlFor,
  label,
  info,
  required = false,
}: {
  htmlFor: string;
  label: string;
  info: string;
  /** 필수 칸이면 이름 옆 빨간 *(라벨 밖, 접근 이름 그대로). 표시만 한다. */
  required?: boolean;
}) => (
  <span className="info-label">
    <label className="field-label" htmlFor={htmlFor}>
      {label}
    </label>
    {required && (
      <span className="required-mark" aria-hidden="true">
        *
      </span>
    )}
    <InfoTip text={info} />
  </span>
);
