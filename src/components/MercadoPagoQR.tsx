import { useEffect, useRef, useState } from 'react';
import { QrCode, Loader2, CheckCircle2, XCircle, TriangleAlert } from 'lucide-react';
import { toDataURL } from 'qrcode';
import { checkMpOrder, MP_POS_STATIC_QR } from '../lib/mercadopago';
import { CartItem } from '../types';
import { formatCurrency } from '../lib/format';

interface MercadoPagoQRProps {
  cart: CartItem[];
  orderId: string;
  qrData: string | null;
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
  qrData,
  expirationSeconds,
  onPaid,
  onCancel,
  onExpire,
}: MercadoPagoQRProps) {
  const total = cart.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
  const [remaining, setRemaining] = useState(expirationSeconds);
  const [phase, setPhase] = useState<Phase>({ status: 'waiting' });
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [staticQrImage, setStaticQrImage] = useState<string | null>(null);
  const [showCajaQr, setShowCajaQr] = useState(false);
  const paidRef = useRef(false);

  // Genera la imagen del QR a partir del qr_data que devuelve MP.
  useEffect(() => {
    if (!qrData) {
      setQrError(true);
      return;
    }
    let cancelled = false;
    toDataURL(qrData, { width: 240, margin: 0 })
      .then((url) => {
        if (!cancelled) setQrImage(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [qrData]);

  // Genera la imagen del QR estático de la caja (modelo híbrido).
  useEffect(() => {
    let cancelled = false;
    toDataURL(MP_POS_STATIC_QR, { width: 240, margin: 0 })
      .then((url) => {
        if (!cancelled) setStaticQrImage(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Imprime el QR visible (ventana nueva con solo la imagen).
  function handlePrintQr() {
    const image = showCajaQr ? staticQrImage : qrImage;
    if (!image) return;
    const win = window.open('', 'impresion-qr', 'width=320,height=360');
    if (!win) return;
    win.document.write(
      '<html><head><title>QR Mercado Pago</title>' +
        '<style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#333}img{width:240px;height:240px}p{margin:8px 0 0;font-size:13px}</style>' +
        '</head><body><img src="' +
        image +
        '" onload="window.print()" /><p>CantoBar - QR Mercado Pago</p></body></html>'
    );
    win.document.close();
    win.focus();
  }

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
        // Pagado: la order pasa a "processed" (y/o la transacción
        // queda "processed"/"accredited").
        const paid =
          data.status === 'processed' ||
          data.payment_status === 'processed' ||
          data.payment_status_detail === 'accredited';
        if (paid) {
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
      <div className="flex bg-zinc-100 rounded-xl p-1 text-sm font-semibold">
        <button
          onClick={() => setShowCajaQr(false)}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            !showCajaQr ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          QR de esta venta
        </button>
        <button
          onClick={() => setShowCajaQr(true)}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            showCajaQr ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          QR de la caja
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
        <div className="flex flex-col items-center justify-center gap-2">
          {showCajaQr ? (
            staticQrImage ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm">
                <img src={staticQrImage} alt="QR de la caja Mercado Pago" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                <QrCode className="w-9 h-9 text-zinc-700" />
              </div>
            )
          ) : qrError ? (
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
              <TriangleAlert className="w-9 h-9 text-amber-500" />
            </div>
          ) : qrImage ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm">
              <img src={qrImage} alt="Código QR Mercado Pago" className="w-56 h-56" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
              {phase.status === 'error' ? (
                <TriangleAlert className="w-9 h-9 text-amber-500" />
              ) : (
                <QrCode className="w-9 h-9 text-zinc-700" />
              )}
            </div>
          )}
        </div>

        <div>
          <p className="font-bold text-zinc-900 text-lg">
            {showCajaQr
              ? 'QR de la caja'
              : phase.status === 'error'
                ? 'No se pudo verificar el pago'
                : qrError
                  ? 'No se pudo generar el QR'
                  : 'Cobrando con Mercado Pago'}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {showCajaQr ? (
              <>
                Escaneá este QR con la app de Mercado Pago para pagar esta venta.
                <br />
                Imprimilo una vez y pegálo en la barra: cada venta queda vinculada a él.
              </>
            ) : qrError ? (
              'Volvé a intentar el cobro o usá otro método de pago.'
            ) : (
              'Escaneá el código con la app de Mercado Pago para pagar.'
            )}
          </p>
        </div>

        {!showCajaQr && <div className="text-3xl font-extrabold text-zinc-900">{formatCurrency(total)}</div>}

        <p className={`text-sm font-semibold ${remaining <= 60 ? 'text-red-600' : 'text-zinc-500'}`}>
          Expira en {mm}:{ss}
        </p>

        {phase.status === 'error' && (
          <p className="text-xs text-zinc-400">{phase.message}</p>
        )}

        {phase.status === 'waiting' && !qrError && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 text-[#E06D00] animate-spin" />
            Esperando el pago...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePrintQr}
          disabled={!qrImage && !staticQrImage}
          className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          Imprimir QR
        </button>
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