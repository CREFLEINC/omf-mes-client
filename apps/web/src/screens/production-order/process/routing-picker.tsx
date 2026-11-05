import { Button, Dialog } from '@crefle/web-ui';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRoutingOperations } from '../../routing/queries';
import { RoutingContents } from './revision-detail';

interface RoutingOption {
  value: string;
  label: string;
  period?: string;
  isDefault?: boolean;
}
const Candidate = ({
  option,
  selected,
  onSelect,
}: {
  option: RoutingOption;
  selected: boolean;
  onSelect: () => void;
}) => {
  const operations = useRoutingOperations(Number(option.value));
  return (
    <article className="erp-wo-routing-candidate" data-selected={selected}>
      <label className="erp-wo-routing-candidate-heading">
        <input
          type="radio"
          name="routing-candidate"
          value={option.value}
          checked={selected}
          disabled={!operations.data?.items.length || operations.isError}
          onChange={onSelect}
        />
        <span>
          <strong>{option.label}</strong>
          {option.isDefault && <span className="erp-wo-routing-default">기본 개정</span>}
          {option.period && <small>{option.period}</small>}
        </span>
      </label>
      <RoutingContents id={Number(option.value)} label="" />
    </article>
  );
};
export const RoutingPicker = ({
  options,
  value,
  onChange,
  disabled = false,
  label = 'Routing 선택',
}: {
  options: RoutingOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const selectedOption = options.find((option) => option.value === selected);
  const operations = useRoutingOperations(open && selectedOption ? Number(selected) : null);
  return (
    <>
      <Button
        variant="outlined"
        size="sm"
        aria-label={label}
        aria-haspopup="dialog"
        disabled={disabled || !options.length}
        onClick={() => {
          setSelected(value);
          setOpen(true);
        }}
      >
        Routing 목록에서 선택
      </Button>
      {open &&
        createPortal(
          <Dialog
            open
            size="lg"
            title="Routing 선택"
            onClose={() => setOpen(false)}
            footer={
              <>
                <Button variant="outlined" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button
                  disabled={!selectedOption || !operations.data?.items.length || operations.isError}
                  onClick={() => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  선택 적용
                </Button>
              </>
            }
          >
            <div
              className="erp-wo-routing-candidates"
              role="radiogroup"
              aria-label="Routing 개정 목록"
            >
              {options.map((option) => (
                <Candidate
                  key={option.value}
                  option={option}
                  selected={option.value === selected}
                  onSelect={() => setSelected(option.value)}
                />
              ))}
            </div>
          </Dialog>,
          document.body,
        )}
    </>
  );
};
