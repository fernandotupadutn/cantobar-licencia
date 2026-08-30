import { LocalConfig, SaleWithItems } from '../types';
import { formatCurrency, formatDateTime, shortTicketNumber } from './format';

// ---------------------------------------------------------------
// Impresión térmica vía QZ Tray (ESC/POS raw).
//
// QZ Tray se carga como script global (public/vendor/qz-tray.js) y
// expone `window.qz`. Se usa TANTO en la app de escritorio como en la
// versión web: la impresión del ticket es siempre por QZ Tray.
//
// Desde una página servida por https hay que conectar por websocket
// SIN cifrar (ws://localhost:8182, usingSecure=false): si usáramos
// wss, el navegador rechaza el certificado auto-firmado de QZ Tray.
//
// Para que los acentos salgan bien en POS58 compatibles con
// ESC/POS se usa la codificación WPC1252 (Java: "Cp1252") con el
// comando ESC t 16. Si la impresora muestra caracteres raros,
// probar con Cp850 / ESC t 2 (ver documentación de QZ "Raw
// Encoding": las Epson TM-T20 soportan 1252 en specs pero en la
// práctica usan Cp850).
// ---------------------------------------------------------------

const WIDTH = 32; // columnas de Font A en ticket de 58mm

// Codificación que QZ usa para convertir el texto a bytes.
const QZ_ENCODING = 'Cp850';
// Número de code page ESC/POS (ESC t n) para esa codificación.
// 2 = Cp850, 16 = WPC1252. La mayoría de las POS58 genéricas
// soportan Cp850 y acentos en español; WPC1252 suele dar mojibake.
const ESCPOS_CODEPAGE = 2;

const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const chr = (n: number) => String.fromCharCode(n);

const init = () => ESC + '@';
const codepage = (n: number) => ESC + 't' + chr(n);
const align = (n: 0 | 1 | 2) => ESC + 'a' + chr(n);
const bold = (on: boolean) => ESC + 'E' + chr(on ? 1 : 0);
const size = (n: number) => GS + '!' + chr(n); // 0x10 = doble alto, 0x30 = doble alto+ancho
const feed = (n: number) => ESC + 'd' + chr(n);
const cut = (partial = true) => GS + 'V' + chr(partial ? 1 : 0);

const divider = () => '-'.repeat(WIDTH) + LF;
const blank = () => LF;

function center(text: string): string {
  const len = text.length;
  if (len >= WIDTH) return text.slice(0, WIDTH);
  const left = Math.floor((WIDTH - len) / 2);
  return ' '.repeat(left) + text;
}

function rightAlign(text: string): string {
  const len = text.length;
  if (len >= WIDTH) return text.slice(0, WIDTH);
  return ' '.repeat(WIDTH - len) + text;
}

function leftRight(left: string, right: string): string {
  const l = left.slice(0, WIDTH - 2);
  const r = right.slice(0, Math.max(1, WIDTH - l.length));
  const spaces = Math.max(1, WIDTH - l.length - r.length);
  return l + ' '.repeat(spaces) + r;
}

function wrapText(text: string, width = WIDTH): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word.trim()).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [' '];
}

// Convierte los caracteres no imprimibles en espacios para que no
// rompan comandos ESC/POS del medio del texto. El formato es-AR de
// Intl produce espacios no separables (\u00A0) en "$ 5.000": si se
// mandan tal cual, la térmica los imprime como "á" (0xA0 en Cp850),
// así que se reemplazan por un espacio común.
function safeText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F\u00A0\u2007\u202F]/g, ' ');
}

export function buildEscPosTicket(sale: SaleWithItems, localConfig: LocalConfig | null): string {
  const L = localConfig;
  const blocks: string[] = [];

  blocks.push(init());
  blocks.push(codepage(ESCPOS_CODEPAGE));

  // Encabezado centrado
  blocks.push(align(1));
  if (L?.name) {
    wrapText(L.name).forEach((l) => blocks.push(size(0x10) + safeText(l) + size(0x00) + LF));
  } else {
    blocks.push(size(0x10) + 'CANTOBAR' + size(0x00) + LF);
  }
  wrapText(L?.subtitle ?? '').forEach((l) => blocks.push(safeText(l) + LF));
  wrapText(L?.address ?? '').forEach((l) => blocks.push(safeText(l) + LF));
  if (L?.phone) blocks.push('TEL: ' + safeText(L.phone) + LF);
  if (L?.cuit) blocks.push('CUIT: ' + safeText(L.cuit) + LF);

  blocks.push(align(0));
  blocks.push(divider());

  blocks.push(`TICKET: #${shortTicketNumber(sale.id)}` + LF);
  blocks.push(`FECHA: ${formatDateTime(sale.created_at)}` + LF);
  if (sale.seller_name) blocks.push(`VENDEDOR: ${safeText(sale.seller_name)}` + LF);

  blocks.push(divider());

  for (const item of sale.items) {
    const name = safeText(item.drink_name);
    blocks.push(`${item.quantity} x ${name}`.slice(0, WIDTH) + LF);
    const subtotal = formatCurrency(item.subtotal);
    const unit = `${formatCurrency(item.unit_price)} c/u`;
    blocks.push(leftRight(unit, subtotal) + LF);
  }

  blocks.push(divider());

  blocks.push(bold(true) + align(2) + `TOTAL ${formatCurrency(sale.total_amount)}` + align(0) + bold(false) + LF);

  blocks.push(align(1) + `MÉTODO DE PAGO: ${safeText(sale.payment_method).toUpperCase()}` + align(0) + LF);

  blocks.push(divider());

  if (L?.ticket_footer_message) {
    wrapText(L.ticket_footer_message).forEach((l) => blocks.push(center(safeText(l)) + LF));
    blocks.push(blank());
  }

  // Separación extra antes del corte para que la última línea siempre
  // quede completa sobre el papel.
  blocks.push(feed(5));
  blocks.push(cut(true));

  return blocks.join('');
}

// ---------------------------------------------------------------
// Conexión QZ con cache: se reutiliza entre tickets.
// ---------------------------------------------------------------
let qzConnect: Promise<void> | null = null;

function getQz(): Qz | undefined {
  return typeof window !== 'undefined' ? window.qz : undefined;
}

export async function isQzAvailable(): Promise<boolean> {
  const qz = getQz();
  if (!qz) return false;
  try {
    await qz.websocket.connect({ retries: 1, delay: 1 });
    return true;
  } catch {
    return false;
  }
}

async function connectQz(): Promise<void> {
  const qz = getQz();
  if (!qz) throw new Error('QZ Tray no está cargado');
  if (!qzConnect) {
    qzConnect = qz.websocket
      // usingSecure=false: conecta por ws://localhost:8182. Imprescindible
      // en la web (una página https con wss vería el cert auto-firmado de
      // QZ y el navegador lo rechaza). En Electron también funciona igual.
      .connect({ usingSecure: false, retries: 3, delay: 1 })
      .catch((err: unknown) => {
        qzConnect = null;
        throw err;
      });
  }
  return qzConnect;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} (demoró más de ${Math.round(ms / 1000)}s)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Cada paso de impresión se registra en %APPDATA%\CantoBar POS\logs\qz-print.log
// (solo en Electron). En web, se muestra en la consola del navegador.
// Fire-and-forget: el log nunca debe romper el flujo.
function logQz(message: string): void {
  if (window.electronAPI?.qz?.log) {
    window.electronAPI.qz.log(message)?.catch(() => undefined);
  } else {
    console.info('[QZ Tray]', message);
  }
}

// Configura la firma de mensajes de QZ Tray usando el par de claves que
// QZ considera confiable (demo cert de "Site Manager" o nuestro
// override.crt). Sin esta firma, QZ muestra el diálogo "¿Permitir?" en
// CADA impresión. Devuelve false si no hay claves configuradas.
async function ensureQzSecurity(qz: Qz): Promise<boolean> {
  const api = window.electronAPI?.qz;
  if (!api) return false;
  try {
    const { certificate, algorithm, dir } = await api.getSecurity();
    if (!certificate) {
      const hint = dir ? dir : '%APPDATA%\\CantoBar POS\\auth\\';
      console.error(
        '[QZ Tray] No se encontró la firma. Para imprimir sin diálogos, poné digital-certificate.txt y ' +
          `private-key.pem en: ${hint}`
      );
      return false;
    }
    qz.security.setSignatureAlgorithm(algorithm || 'SHA512');
    qz.security.setCertificatePromise((resolve) => resolve(certificate));
    qz.security.setSignaturePromise((toSign) => () => api.sign(toSign));
    return true;
  } catch (err) {
    console.error('[QZ Tray] Error al configurar la firma:', err);
    return false;
  }
}

export async function printEscPosWithQz(sale: SaleWithItems, localConfig: LocalConfig | null): Promise<void> {
  const qz = getQz();
  if (!qz) throw new Error('QZ Tray no está disponible en esta instalación');

  // La firma (silent printing) es OPCIONAL: si están las claves en auth/
  // se firma y QZ no pregunta; si no están, se imprime igual (QZ puede
  // mostrar su diálogo de permiso). Nunca bloquea la impresión.
  const signed = await ensureQzSecurity(qz);
  logQz(signed ? 'Firma configurada (no debería preguntar)' : 'Sin firma: QZ puede pedir permiso para imprimir');

  logQz('Configurando firma OK, conectando a QZ Tray...');
  try {
    await withTimeout(connectQz(), 12_000, 'La conexión con QZ Tray');
  } catch (err) {
    console.error('QZ connect error:', err);
    logQz(`Error de conexión: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(
      `No se pudo conectar con QZ Tray (${err instanceof Error ? err.message : String(err)}). ` +
        'Revisá que esté instalado y abierto (icono en la bandeja del sistema).'
    );
  }
  logQz('Conectado. Consultando la impresora por defecto...');

  let printer: string;
  try {
    printer = await withTimeout(qz.printers.getDefault(), 10_000, 'Consultar la impresora por defecto');
  } catch (err) {
    console.error('QZ getDefault error:', err);
    logQz(`Error al consultar impresoras: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(`No se pudo consultar la impresora por defecto (${err instanceof Error ? err.message : String(err)}).`);
  }
  logQz(`Impresora por defecto: "${printer}"`);
  if (!printer) {
    logQz('No hay impresora por defecto definida en Windows');
    throw new Error(
      'QZ Tray no encontró una impresora predeterminada. Configurá la térmica como ' +
        '"Establecer como predeterminada" en Windows (Configuración > Dispositivos > Impresoras).'
    );
  }

  // Log de las impresoras disponibles para diagnóstico (cuál hay default de verdad).
  try {
    const printers = await withTimeout(qz.printers.find(), 10_000, 'Listar impresoras');
    logQz(`Impresoras disponibles: ${JSON.stringify(printers)}`);
  } catch {
    // No bloquea la impresión.
  }

  const config = qz.configs.create(printer, { encoding: QZ_ENCODING, forceRaw: true });
  const ticket = buildEscPosTicket(sale, localConfig);
  logQz(`Enviando ticket ESC/POS a "${printer}" (${ticket.length} chars)...`);
  try {
    await withTimeout(qz.print(config, [ticket]), 20_000, 'La impresión');
    logQz('Ticket impreso OK');
  } catch (err) {
    console.error('QZ print error:', err);
    logQz(`Error al imprimir: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(`QZ falló al imprimir en "${printer}" (${err instanceof Error ? err.message : String(err)}).`);
  }
}

// ---------------------------------------------------------------
// Public API.
//
// La impresión del ticket es SIEMPRE por QZ Tray (ESC/POS raw), tanto
// en la app de escritorio como en la versión web. NO se usa
// window.print(): sale mal en la impresora térmica. Si QZ falla (no
// está instalado/abierto o no hay impresora por defecto), se lanza un
// error para que el cajero lo vea y pueda reintentar desde el
// historial.
// ---------------------------------------------------------------
export async function printThermalTicket(sale: SaleWithItems, localConfig: LocalConfig | null): Promise<void> {
  await printEscPosWithQz(sale, localConfig);
}