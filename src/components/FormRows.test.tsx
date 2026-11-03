import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormGroup, NumberRow } from '@/components/FormRows';

describe('NumberRow', () => {
  it('is a row with the label on the left and the value and unit on the right', () => {
    render(<FormGroup header="Goals"><NumberRow label="Goal weight" value="70" onChange={vi.fn()} unit="kg" decimal /></FormGroup>);
    expect(screen.getByText('Goals')).toBeInTheDocument();
    const input = screen.getByLabelText('Goal weight');
    expect(input).toHaveValue('70');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('takes a decimal comma, and drops anything that is not a number', () => {
    const onChange = vi.fn();
    render(<NumberRow label="Goal weight" value="" onChange={onChange} decimal />);
    fireEvent.change(screen.getByLabelText('Goal weight'), { target: { value: '70,5' } });
    expect(onChange).toHaveBeenLastCalledWith('70,5');
    fireEvent.change(screen.getByLabelText('Goal weight'), { target: { value: '7x0' } });
    expect(onChange).toHaveBeenLastCalledWith('70');
  });

  it('whole numbers only, when not decimal', () => {
    const onChange = vi.fn();
    render(<NumberRow label="Daily calorie goal" value="" onChange={onChange} unit="kcal" />);
    expect(screen.getByLabelText('Daily calorie goal')).toHaveAttribute('inputmode', 'numeric');
    fireEvent.change(screen.getByLabelText('Daily calorie goal'), { target: { value: '1884.5' } });
    expect(onChange).toHaveBeenLastCalledWith('18845');
  });
});
