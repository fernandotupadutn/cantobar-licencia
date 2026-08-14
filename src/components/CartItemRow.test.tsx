import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartItemRow from './CartItemRow';

const item = { drink_id: 'd1', name: 'Fernet', unit_price: 1000, quantity: 3 };

describe('CartItemRow', () => {
  it('muestra nombre, cantidad y subtotal', () => {
    render(
      <CartItemRow item={item} onIncrement={() => {}} onDecrement={() => {}} onRemove={() => {}} />
    );
    expect(screen.getByText('Fernet')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1.000', { exact: false })).toBeInTheDocument();
  });

  it('subtotal es unit_price x quantity', () => {
    const { container } = render(
      <CartItemRow item={item} onIncrement={() => {}} onDecrement={() => {}} onRemove={() => {}} />
    );
    expect(container.textContent).toContain('3.000');
  });

  it('llama a onIncrement al sumar', async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    render(
      <CartItemRow item={item} onIncrement={onIncrement} onDecrement={() => {}} onRemove={() => {}} />
    );
    await user.click(screen.getByLabelText('Sumar Fernet'));
    expect(onIncrement).toHaveBeenCalledWith('d1');
  });

  it('llama a onDecrement al restar', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(
      <CartItemRow item={item} onIncrement={() => {}} onDecrement={onDecrement} onRemove={() => {}} />
    );
    await user.click(screen.getByLabelText('Restar Fernet'));
    expect(onDecrement).toHaveBeenCalledWith('d1');
  });

  it('llama a onRemove al quitar', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <CartItemRow item={item} onIncrement={() => {}} onDecrement={() => {}} onRemove={onRemove} />
    );
    await user.click(screen.getByLabelText('Quitar Fernet del pedido'));
    expect(onRemove).toHaveBeenCalledWith('d1');
  });
});
