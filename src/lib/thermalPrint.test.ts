import { describe, expect, it } from 'vitest';
import { pickPrinter } from './thermalPrint';

const printers = ['EPSON TM-T20 Receipt', 'Microsoft Print to PDF', 'POS-58 USB'];

describe('pickPrinter', () => {
  it('coincide exacta sin distinguir mayúsculas', () => {
    expect(pickPrinter(printers, 'epson tm-t20 receipt')).toBe('EPSON TM-T20 Receipt');
  });

  it('coincide parcial cuando no hay exacta', () => {
    expect(pickPrinter(printers, 'POS-58')).toBe('POS-58 USB');
  });

  it('recorta espacios extra del pedido', () => {
    expect(pickPrinter(printers, '  Epson TM-T20  ')).toBe('EPSON TM-T20 Receipt');
  });

  it('devuelve null si no hay coincidencia', () => {
    expect(pickPrinter(printers, 'Impresora inexistente')).toBeNull();
  });

  it('devuelve null si la lista está vacía o sin pedido', () => {
    expect(pickPrinter([], 'POS-58')).toBeNull();
    expect(pickPrinter(printers, '   ')).toBeNull();
  });
});