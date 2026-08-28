import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cart from './Cart';

const noop = () => {};

const items = [
  { drink_id: 'd1', name: 'Fernet', unit_price: 1000, quantity: 2 },
  { drink_id: 'd2', name: 'Gin Tonic', unit_price: 1500, quantity: 1 },
];

function renderCart(overrides: Partial<Parameters<typeof Cart>[0]> = {}) {
  const props = {
    items,
    isCharging: false,
    onIncrement: noop,
    onDecrement: noop,
    onRemove: noop,
    onClear: noop,
    onCheckout: noop,
    onMercadoPago: noop,
    ...overrides,
  };
  return render(<Cart {...props} />);
}

describe('Cart', () => {
  it('muestra el carrito vacío', () => {
    renderCart({ items: [] });
    expect(screen.getByText(/todavía no agregaste tragos/i)).toBeInTheDocument();
    expect(screen.getByText('Contado')).toBeDisabled();
    expect(screen.getByText('Transferencia')).toBeDisabled();
  });

  it('muestra cantidad total de items y total', () => {
    renderCart();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3.500', { exact: false })).toBeInTheDocument();
  });

  it('llama a onCheckout con Efectivo al tocar Contado', async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();
    renderCart({ onCheckout });
    await user.click(screen.getByText('Contado'));
    expect(onCheckout).toHaveBeenCalledWith('Efectivo');
  });

  it('llama a onCheckout con Transferencia', async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();
    renderCart({ onCheckout });
    await user.click(screen.getByText('Transferencia'));
    expect(onCheckout).toHaveBeenCalledWith('Transferencia');
  });

  it('llama a onClear al vaciar', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderCart({ onClear });
    await user.click(screen.getByLabelText('Vaciar carrito'));
    expect(onClear).toHaveBeenCalled();
  });

  it('bloquea el cobro mientras carga', () => {
    renderCart({ isCharging: true });
    expect(screen.getByText('Contado')).toBeDisabled();
    expect(screen.getByText('Transferencia')).toBeDisabled();
  });
});
