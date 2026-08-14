import type { CSSProperties } from 'react';
import { LocalConfig, SaleWithItems } from '../types';
import { formatCurrency, formatDateTime, shortTicketNumber } from '../lib/format';

interface ThermalTicketProps {
  sale: SaleWithItems;
  localConfig: LocalConfig | null;
}

/**
 * Ticket optimizado para papel térmico de 58mm.
 * Se renderiza siempre en el DOM (oculto) y solo se hace visible
 * mediante las reglas @media print definidas en index.css, para
 * que window.print() pueda capturarlo.
 */
export default function ThermalTicket({ sale, localConfig }: ThermalTicketProps) {
  return (
    <div
      id="thermal-ticket-root"
      className="hidden print:block"
      style={{
        width: '58mm',
        fontFamily: "'Courier New', monospace",
        color: '#000',
        fontSize: '11px',
        padding: '4mm',
        // Margen extra al final: muchas impresoras térmicas tienen una
        // zona no imprimible cerca del corte, y si el contenido termina
        // justo ahí se pierde la última línea.
        paddingBottom: '14mm',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '14px' }}>
          {localConfig?.name ?? 'CantoBar'}
        </div>
        {localConfig?.subtitle && <div>{localConfig.subtitle}</div>}
        {localConfig?.address && <div>{localConfig.address}</div>}
        {localConfig?.phone && <div>Tel: {localConfig.phone}</div>}
        {localConfig?.cuit && <div>CUIT: {localConfig.cuit}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      <div>Ticket: #{shortTicketNumber(sale.id)}</div>
      <div>Fecha: {formatDateTime(sale.created_at)}</div>
      {sale.seller_name && <div>Vendedor: {sale.seller_name}</div>}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {sale.items.map((item) => (
        <div key={item.id} style={{ marginBottom: '3px' }}>
          <div>
            {item.quantity} x {item.drink_name}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{formatCurrency(item.unit_price)} c/u</span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        </div>
      ))}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* breakInside: 'avoid' evita que el navegador corte este bloque
          justo entre el total y el método de pago si llegara a paginar */}
      <div style={{ breakInside: 'avoid', WebkitColumnBreakInside: 'avoid' } as CSSProperties}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px' }}>
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total_amount)}</span>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 700, marginTop: '6px' }}>
          MÉTODO DE PAGO: {sale.payment_method.toUpperCase()}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {localConfig?.ticket_footer_message && (
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          {localConfig.ticket_footer_message}
        </div>
      )}

      {/* Espaciador final: garantiza que quede papel de sobra antes del
          corte físico de la impresora, para que nunca se pierda texto */}
      <div style={{ height: '6mm' }} />
    </div>
  );
}
