import { Progress } from '@crefle/web-ui';
import type { ReactNode } from 'react';

/**
 * POP 목록 줄의 공용 틀(C-21 「목록 줄은 제목과 정보를 나눈다」).
 *
 * 한 줄은 제목 줄(대상 이름 굵게, 오른쪽 끝에 칩)과 정보 영역(「라벨 값」 쌍을 같은 열에 맞춤)으로
 * 나뉜다. 둘 사이 간격은 줄을 감싸는 쪽이 `--space-2` 이상으로 준다. 자재 투입 목록 줄과 편집 영역,
 * 작업 지시 목록의 W/O 카드와 「선택한 작업지시」가 같은 부품을 쓴다.
 *
 * 버튼 안에도 놓이므로 모두 `span` 이다(버튼 안에는 구문 요소만 둔다).
 */

/** 제목 줄: 제목(굵게)과 오른쪽 끝 칩. 칩이 없으면 칩 자리를 세우지 않는다. */
export const PopRowHead = ({ title, chips }: { title: ReactNode; chips?: ReactNode }) => (
  <span className="pop-row-head">
    <span className="pop-row-title">{title}</span>
    {chips !== undefined && chips !== null && chips !== false && (
      <span className="pop-row-chips">{chips}</span>
    )}
  </span>
);

/**
 * 정보 영역. 안의 `PopRowPair` 들이 라벨 열과 값 열에 맞춰 선다.
 *
 * `columns={2}`이면 한 줄에 쌍 둘을 둔다(라벨 값 라벨 값). 반 칸에 다 들어가지 않는 값은 그 쌍에
 * `wide`를 주어 한 줄을 다 쓰게 한다. 값은 말줄임하지 않는다(반 칸의 값은 넘치면 줄을 바꾼다).
 */
export const PopRowInfo = ({
  children,
  className,
  columns = 1,
}: {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2;
}) => (
  <span
    className={['pop-row-info', columns === 2 ? 'pop-row-info-two' : '', className ?? '']
      .filter((name) => name !== '')
      .join(' ')}
  >
    {children}
  </span>
);

/**
 * 「라벨 값」 한 쌍. 값이 없으면 그 줄을 숨긴다(C-10). 라벨과 값 사이의 빈칸은 격자에서 그려지지 않고,
 * 화면 읽기 프로그램과 글자 복사에서 「설비 사출기 1호기」처럼 띄어 읽히게 한다. `wide`는 두 열
 * 정보 영역에서 한 줄을 다 쓰는 쌍이다(라벨은 첫 라벨 열에 맞춘다).
 */
export const PopRowPair = ({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) =>
  children === null || children === undefined || children === '' ? null : (
    <>
      <span className={wide ? 'pop-row-info-label pop-row-info-wide' : 'pop-row-info-label'}>
        {label}
      </span>{' '}
      <span className={wide ? 'pop-row-info-value pop-row-info-wide' : 'pop-row-info-value'}>
        {children}
      </span>
    </>
  );

export interface PopQtyProgressProps {
  /** 진행 값(투입량, 실적). */
  current: number;
  /** 기준 값(불출량, 지시 수량). 없으면 막대를 두지 않는다. */
  target: number | null;
  /** 화면 글자 「30 / 100 KG」. 화면마다 문구 함수가 만든다. */
  text: string;
  /** 막대의 접근성 이름. 정보 영역의 라벨과 같은 말이다. */
  label: string;
}

/**
 * 「진행 / 기준」 값과 진행 막대(C-21 「수량은 진행 / 기준 하나로」). 음수를 보이지 않는다. 기준을
 * 넘으면 막대가 가득 찬 채 경고 색(기준 0이어도 가득), 닿으면 완료 색이다(DS `Progress` 의 tone).
 */
export const PopQtyProgress = ({ current, target, text, label }: PopQtyProgressProps) => {
  const isOver = target !== null && current > target;
  const isDone = target !== null && target > 0 && current >= target;

  return (
    <span className="pop-qty-progress">
      <span className="pop-qty-progress-text">{text}</span>
      {target !== null && (
        <Progress
          className="pop-qty-progress-bar"
          size="sm"
          value={isOver ? (target > 0 ? target : 1) : Math.min(current, target)}
          max={target > 0 ? target : 1}
          tone={isOver ? 'warning' : isDone ? 'success' : 'primary'}
          label={label}
          valueText={text}
        />
      )}
    </span>
  );
};
