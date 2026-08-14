import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ signIn, user: null, isLoading: false }),
}));

describe('Login', () => {
  it('llama a signIn con email y contraseña', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ error: null });
    render(<Login />);
    await user.type(screen.getByPlaceholderText('vos@cantobar.com'), 'admin@cantobar.com');
    await user.type(screen.getByPlaceholderText('••••••••'), '12345678');
    await user.click(screen.getByText('Ingresar'));
    expect(signIn).toHaveBeenCalledWith('admin@cantobar.com', '12345678');
  });

  it('muestra error si las credenciales son inválidas', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ error: new Error('Invalid login') });
    render(<Login />);
    await user.type(screen.getByPlaceholderText('vos@cantobar.com'), 'admin@cantobar.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'incorrecta');
    await user.click(screen.getByText('Ingresar'));
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
  });
});
