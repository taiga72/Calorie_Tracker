import { useId, type ReactNode } from 'react';
import { cleanDecimal } from '@/lib/decimal';

/**
 * iOS-style grouped rows (as in Settings and Health): a rounded group of
 * rows, each with its label on the left and the value on the right, an
 * optional small header above and a note below.
 */
export function FormGroup({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {header && <p className="text-11 font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-4 mb-1.5">{header}</p>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl divide-y divide-gray-200/70 dark:divide-gray-700">{children}</div>
      {footer && <div className="text-11 text-gray-400 px-4 mt-1.5">{footer}</div>}
    </div>
  );
}

export function FormRow({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-11 px-4 py-1.5">
      <label htmlFor={htmlFor} className="text-sm text-gray-900 dark:text-white flex-shrink-0">{label}</label>
      <div className="flex items-center justify-end gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

/** A number on the right of its row, with its unit. Whole numbers unless `decimal`. */
export function NumberRow({ label, value, onChange, unit, decimal = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  decimal?: boolean;
}) {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(e) => onChange(decimal ? cleanDecimal(e.target.value) : e.target.value.replace(/\D/g, ''))}
        className="w-24 min-w-0 bg-transparent text-sm font-semibold text-right text-gray-900 dark:text-white outline-none"
      />
      {unit && <span className="text-sm text-gray-400 whitespace-nowrap">{unit}</span>}
    </FormRow>
  );
}
