interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** `data-testid`s for the value and its two buttons. */
  testIds?: { value: string; decrease: string; increase: string };
}

/** − value +, bounded: each button is disabled at its end. */
export function Stepper({ value, min, max, onChange, testIds }: StepperProps) {
  return (
    <div class="stepper">
      <button
        type="button"
        class="icon-button"
        aria-label="Decrease"
        data-testid={testIds?.decrease}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span class="stepper-value" data-testid={testIds?.value}>
        {value}
      </span>
      <button
        type="button"
        class="icon-button"
        aria-label="Increase"
        data-testid={testIds?.increase}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
