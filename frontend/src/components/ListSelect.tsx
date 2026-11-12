import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

type ListOption = {
  value: string;
  label: string;
};

export function ListSelect({
  value,
  options,
  onChange = () => {},
  ariaLabel,
  ariaLabelledBy,
  className = "",
  name,
  defaultValue,
  disabled = false,
}: {
  value?: string;
  defaultValue?: string;
  options: ListOption[];
  onChange?: (value: string) => void;
  ariaLabel: string;
  ariaLabelledBy?: string;
  className?: string;
  name?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedValue = value ?? uncontrolledValue;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const selectOption = (option: ListOption) => {
    if (value === undefined) setUncontrolledValue(option.value);
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
      } else {
        setActiveIndex((index) =>
          event.key === "ArrowDown"
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length,
        );
      }
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) selectOption(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`list-select ${className}`.trim()} ref={rootRef}>
      {name && <input type="hidden" name={name} value={selectedValue} disabled={disabled} />}
      <button
        ref={triggerRef}
        type="button"
        className="list-select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled || options.length === 0}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{options[selectedIndex]?.label ?? "Aucune option disponible"}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="list-select-options" id={`${id}-options`} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              className="list-select-option"
              role="option"
              aria-selected={option.value === selectedValue}
              data-active={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
              {option.value === selectedValue && <Check size={16} aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
