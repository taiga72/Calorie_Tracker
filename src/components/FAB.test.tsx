import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FAB } from '@/components/FAB';

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
}

afterEach(() => scrollTo(0));

describe('FAB', () => {
  it('hides while scrolling down and comes back on scroll up', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true });
    const { container } = render(<FAB onClick={vi.fn()} onCoachClick={vi.fn()} />);
    const wrap = container.firstElementChild!;
    scrollTo(300);
    expect(wrap.className).toMatch(/opacity-0/);
    expect(screen.getByLabelText('Add entry')).toHaveAttribute('tabindex', '-1');
    scrollTo(200);
    expect(wrap.className).not.toMatch(/opacity-0/);
  });

  it('shows the coach hint until it is tapped', () => {
    const onHintDismiss = vi.fn();
    render(<FAB onClick={vi.fn()} onCoachClick={vi.fn()} coachHint onHintDismiss={onHintDismiss} />);
    fireEvent.click(screen.getByText('Ask your AI coach'));
    expect(onHintDismiss).toHaveBeenCalled();
  });
});
