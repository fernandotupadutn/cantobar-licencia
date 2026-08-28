import { useEffect, useRef, useState } from 'react';
import { QrCode, Loader2, CheckCircle2, XCircle, TriangleAlert } from 'lucide-react';
import { checkMpOrder } from '../lib/mercadopago';
import { CartItem } from '../types';
import { formatCurrency } from '../lib/format';

interface MercadoPagoQRProps {
  cart: CartItem[];
  orderId: string;
  expirationSeconds: number;
  onPaid: (paymentId: string) => void;
  onCancel: () => void;
  onExpire: () => void;
}

type Phase =
  | { status: 'waiting' }
  | { status: 'paid' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

export default function MercadoPagoQR({
  cart,
  orderId,
  expirationSeconds,
  onPaid,
  onCancel,
  onExpire,
}: MercadoPagoQRProps) {
  const total = cart.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
  const [remaining, setRemaining] = useState(expirationSeconds);
  const [phase, setPhase] = useState<Phase>({ status: 'waiting' });
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const paidRef = useRef(false);

  // Countdown de expiración
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling del estado de la order cada 3 segundos
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled || paidRef.current) return;
      try {
        const data = await checkMpOrder(orderId);
        if (data.status === 'accredited') {
          paidRef.current = true;
          setPaymentId(data.payment_id ?? null);
          setPhase({ status: 'paid' });
        } else if (data.status === 'canceled' || data.status === 'expired') {
          setPhase({ status: 'expired' });
        }
      } catch (err) {
        // Errores transitorios de red: no cortar el polling.
        if (!cancelled) {
          setPhase({ status: 'error', message: err instanceof Error ? err.message : 'Error consultando el pago' });
        }
      }
    };

    poll();
    const handle = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [orderId]);

  // Notificar cuando expira el tiempo
  useEffect(() => {
    if (remaining === 0 && phase.status === 'waiting') {
      setPhase({ status: 'expired' });
    }
  }, [remaining, phase.status]);

  // Notificar al padre al pagar
  useEffect(() => {
    if (phase.status === 'paid' && paymentId !== null) {
      onPaid(paymentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.status, paymentId]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  if (phase.status === 'paid') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <p className="text-lg font-bold text-emerald-700">¡Pago acreditado!</p>
        <p className="text-sm text-zinc-500">Confirmando la venta...</p>
        <Loader2 className="w-5 h-5 text-[#E06D00] animate-spin" />
      </div>
    );
  }

  if (phase.status === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
          <XCircle className="w-9 h-9 text-zinc-500" />
        </div>
        <p className="text-lg font-bold text-zinc-700">El pago expiró</p>
        <p className="text-sm text-zinc-500">Se canceló la order. Podés reintentar el cobro.</p>
        <button
          onClick={onExpire}
          className="mt-2 bg-[#E06D00] hover:bg-[#D97706] text-white font-bold py-2.5 px-6 rounded-xl transition-colors"
        >
          Volver al carrito
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
          {phase.status === 'error' ? (
            <TriangleAlert className="w-9 h-9 text-amber-500" />
          ) : (
            <QrCode className="w-9 h-9 text-zinc-700" />
          )}
        </div>

        <div>
          <p className="font-bold text-zinc-900 text-lg">
            {phase.status === 'error' ? 'No se pudo verificar el pago' : 'Cobrando con Mercado Pago'}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            El QR se muestra en la pantalla del Point Smart. El comprador lo escanea con su app de Mercado Pago.
          </p>
        </div>

        <div className="text-3xl font-extrabold text-zinc-900">{formatCurrency(total)}</div>

        <p className={`text-sm font-semibold ${remaining <= 60 ? 'text-red-600' : 'text-zinc-500'}`}>
          Expira en {mm}:{ss}
        </p>

        {phase.status === 'error' && (
          <p className="text-xs text-zinc-400">{phase.message}</p>
        )}

        {phase.status === 'waiting' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 text-[#E06D00] animate-spin" />
            Esperando el pago...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 rounded-xl transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
