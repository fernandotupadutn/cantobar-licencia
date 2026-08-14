import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateTime, shortTicketNumber } from './format';

describe('formatCurrency', () => {
  it('formatea con símbolo de pesos y separador de miles', () => {
    const result = formatCurrency(1234);
    expect(result).toContain('1.234');
    expect(result).toMatch(/\$/);
  });

  it('no muestra decimales', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1.500');
    expect(result).not.toMatch(/,\d{2}$/);
  });
});

describe('formatDateTime', () => {
  it('formatea fecha y hora local en formato argentino', () => {
    const result = formatDateTime('2026-08-13T21:30:00');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain('30');
  });
});

describe('shortTicketNumber', () => {
  it('usa los últimos 6 caracteres del UUID en mayúsculas', () => {
    const result = shortTicketNumber('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBe('440000');
  });

  it('convierte letras a mayúsculas', () => {
    const result = shortTicketNumber('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab');
    expect(result).toBe('AAAAAB');
  });
});
