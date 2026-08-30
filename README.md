# CantoBar POS

Sistema de punto de venta para CantoBar, con autenticación y control de acceso por roles (**admin** / **vendedor**). Construido con React + TypeScript + Tailwind CSS + Supabase.

## Nota sobre el diseño

El brief pedía una réplica píxel-por-píxel de una imagen de referencia, pero **la imagen no llegó adjunta a la conversación** — solo la descripción textual. La interfaz se construyó siguiendo al pie de la letra la paleta y disposición descritas (fondo `#F4F4F5`, tarjetas blancas, acentos naranjas `#E06D00`/`#D97706`). Si me compartís la imagen, ajusto cualquier detalle visual para que coincida.

## Puesta en marcha

1. Instalá las dependencias (con `pnpm`, `npm` o `yarn`, el que uses):
   ```bash
   pnpm install
   ```

2. Creá el proyecto en [Supabase](https://supabase.com) y ejecutá `supabase_schema.sql` desde el SQL Editor. Esto crea:
   - Las tablas del POS (`local_config`, `categories`, `drinks`, `sales`, `sale_items`).
   - La tabla `profiles`, vinculada 1 a 1 con `auth.users`, con un `role` (`admin`/`vendedor`).
   - Un trigger que crea automáticamente el perfil (`vendedor` por defecto) cada vez que alguien se registra.
   - Políticas RLS reales: lectura abierta a cualquier usuario logueado, y escritura sobre catálogo/config/usuarios restringida a `admin`. Las ventas solo se pueden insertar con el propio `seller_id`.

3. Copiá `.env.example` a `.env` y completá tus credenciales:
   ```bash
   cp .env.example .env
   ```

4. **Creá tu primer usuario admin** (el sistema no trae ninguno por defecto):
   - Abrí la app y andá a "¿No tenés cuenta?" → por ahora no hay pantalla de auto-registro pública; usá el panel de Supabase (**Authentication → Users → Add user**) o pedile a un admin ya existente que lo cree desde "Administración → Usuarios".
   - Para el primer usuario, como todavía no hay ningún admin, corré en el SQL Editor:
     ```sql
     update profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
     ```
   - Iniciá sesión con ese usuario: vas a ver la pestaña "Administración".

5. Corré el servidor de desarrollo:
   ```bash
   pnpm run dev
   ```

## Roles y permisos

| Funcionalidad | Vendedor | Admin |
|---|---|---|
| Vender (catálogo + carrito + cobro) | ✅ | ✅ |
| Ver historial de ventas y reimprimir tickets | ✅ | ✅ |
| Agregar/editar/eliminar categorías y bebidas | ❌ | ✅ |
| Panel de Ganancias (por período, método de pago, vendedor) | ❌ | ✅ |
| Configuración del local | ❌ | ✅ |
| Gestión de usuarios (alta, cambio de rol) | ❌ | ✅ |

La restricción real vive en dos capas: la UI oculta lo que cada rol no puede usar, y las políticas RLS de Supabase bloquean esas mismas operaciones a nivel de base de datos aunque alguien intente saltarse la interfaz. Las ventas, además, solo se pueden registrar vía la función `create_sale()` (RPC): precios y totales se resuelven en el servidor, no en el navegador.

## Alta de usuarios (Edge Function `create-user`)

El alta de usuarios desde "Administración → Usuarios" no usa `supabase.auth.signUp()` del navegador: va por la **Edge Function** `create-user` (`supabase/functions/create-user/index.ts`), que corre en el servidor con la `service_role` key y usa `auth.admin.createUser()`.

Ventajas:

- **Funciona con el signup público desactivado** (que es lo recomendado y obligatorio si querés cerrar el registro público).
- **No reemplaza la sesión del admin**: antes, `signUp()` logueaba temporalmente al admin como el usuario nuevo; ahora eso no pasa.
- La función **autoriza por sí misma**: solo la puede llamar un usuario logueado con rol `admin` (valida el JWT y chequea `profiles.role`). La `service_role` key nunca viaja al navegador.

### Deploy (una sola vez)

```bash
# Instalá el CLI de Supabase si no lo tenés
pnpm dlx supabase login

# Vinculá este proyecto con tu proyecto de Supabase
pnpm dlx supabase link --project-ref TU_PROJECT_REF

# Subí la función
pnpm deploy:functions   # (equivale a: supabase functions deploy create-user)
```

El `TU_PROJECT_REF` es el identificador corto que aparece en la URL de tu proyecto (p. ej. `https://ltxtymctpijyzcntamin.supabase.co` → `ltxtymctpijyzcntamin`). La primera vez pedirá registrar el dominio/verificación de la URL de la función.

## Estructura del proyecto

```
src/
  types/index.ts           Tipos TypeScript (incluye Profile, UserRole)
  lib/
    supabaseClient.ts       Cliente de Supabase
    AuthContext.tsx         Contexto de sesión + perfil (login/logout)
    format.ts               Helpers de moneda, fecha y N° de ticket
  components/
    Login.tsx                Pantalla de inicio de sesión
    Navbar.tsx                Header con nombre, badge de rol y logout
    SearchBar.tsx             Buscador de bebidas
    CategorySection.tsx       Sección por categoría con ABM (solo admin)
    DrinkCard.tsx              Tarjeta de producto
    Cart.tsx                   Panel "Pedido actual" + cobro
    CartItemRow.tsx            Fila de ítem del carrito
    SalesHistory.tsx           Historial con vendedor, badge de pago y reimpresión
    AdminPanel.tsx              Contenedor de pestañas: Ganancias / Config / Usuarios
    ReportsPanel.tsx            Reportes de ganancias por período/método/vendedor
    UsersManagement.tsx         Alta de usuarios y cambio de rol
    CategoryModal.tsx           Modal alta/edición de categoría
    DrinkModal.tsx               Modal alta/edición de bebida
    ThermalTicket.tsx            Ticket térmico 58mm para impresión
    ModalShell.tsx                Shell genérico reutilizado por los modales
  App.tsx                     Gate de auth + orquestador principal
```

## Funcionalidades

- **Autenticación**: login por email/contraseña contra Supabase Auth; sesión persistida y reactiva a cambios (`onAuthStateChange`).
- **RBAC**: vendedor vende e imprime/reimprime; admin además administra catálogo, ve reportes de ganancias, edita la config del local y gestiona usuarios.
- **Catálogo**: búsqueda en tiempo real, ABM de categorías/bebidas (solo admin).
- **Carrito y cobro**: "Contado"/"Transferencia", registra la venta vía la RPC `create_sale()` (el servidor valida precios contra el catálogo y calcula el total; el cliente solo envía `drink_id` y `quantity`) y guarda el `seller_id` del usuario logueado.
- **Impresión térmica automática**: en la app de escritorio imprime por **QZ Tray** en ESC/POS raw (ticket de 58mm con control exacto: centrado, doble alto, code page WPC1252 y corte), con **fallback a `window.print()`** sobre el ticket HTML oculto si QZ no está disponible (por ejemplo en la versión web). Reimpresión disponible desde el historial.
- **Historial**: cronológico, con badge de método de pago, vendedor que la registró, detalle expandible y reimpresión.
- **Reportes (admin)**: ganancia total, desglose Efectivo vs Transferencia, desglose por vendedor, filtro por período (hoy / 7 días / 30 días / todo).
- **Configuración del local (admin)**: nombre, subtítulo, dirección, teléfono, CUIT y mensaje de pie del ticket.
- **Gestión de usuarios (admin)**: alta de usuarios nuevos con rol inicial (vía Edge Function `create-user`, funciona con el signup público desactivado) y cambio de rol de usuarios existentes.

## Sistema de licencias / suscripción

Además de su propia base de datos, la app se conecta a una base **central** de administración (otro proyecto de Supabase, compartido entre todos tus clientes) para chequear si la suscripción de este cliente está activa. Si está `suspendido`, bloquea toda la app —incluso el login— con un mensaje de "Servicio suspendido".

Variables nuevas en `.env` (ver `.env.example`): `VITE_ADMIN_SUPABASE_URL`, `VITE_ADMIN_SUPABASE_ANON_KEY`, `VITE_PROJECT_ID`.

Archivos: `src/lib/adminSupabaseClient.ts` (cliente independiente, no toca la sesión de auth del cantobar) y `src/components/SubscriptionGuard.tsx` (envuelve toda la app en `App.tsx`, por fuera del login).

### Esquema mínimo del lado de la base CENTRAL (no confundir con `supabase_schema.sql`, que es la base propia de este cantobar)

```sql
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'activo' check (status in ('activo', 'suspendido')),
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

-- Lectura anónima permitida SOLO de status: es lo único que la app
-- necesita para el guard. No expongas acá datos de facturación ni de
-- otros clientes — creá una vista o columnas separadas si necesitás
-- guardar más info sensible en la misma tabla.
create policy "projects: lectura pública del status" on projects
  for select using (true);
```

> ⚠️ **Nota de seguridad**: cualquier `VITE_*` termina embebido en el bundle JS y es visible para quien abra las devtools — esto es inherente a cualquier app que corre en el navegador, no un descuido de este código. Lo que importa es que la `anon key` de la base central solo tenga permiso de **lectura** sobre `projects` (RLS de arriba), y que esa tabla no contenga nada más sensible que el `status`. Nunca uses ahí una `service_role` key.
>
> El guard actual **bloquea por defecto también ante errores de red** (falla al conectar, `VITE_PROJECT_ID` mal configurado, etc.), no solo ante `suspendido`. Es la postura más segura para un sistema de licencias, pero si preferís que un corte de conexión no tumbe la app en producción, se puede ajustar `SubscriptionGuard.tsx` para dejar pasar (`fail open`) en el caso `error` en vez de bloquear.
>
> La licencia se re-chequea cada 60 segundos y al recuperar el foco de la ventana, así que una suspensión se aplica con la app abierta en menos de un minuto.

## Seguridad

Medidas implementadas (en `supabase_schema.sql`, que es **idempotente**: podés volver a ejecutarlo sobre una base ya existente):

- **RLS por rol** en todas las tablas: lectura para logueados, escritura de catálogo/config/usuarios solo `admin`.
- **Escritura de ventas solo por RPC**: `create_sale()` calcula precios, nombres y totales leyendo el catálogo en el servidor. El cliente solo envía `drink_id` + `quantity`. Se **revocaron** `INSERT/UPDATE/DELETE` de `sales` y `sale_items` para `anon`/`authenticated`: no se puede falsificar un precio ni un total desde el navegador.
- **CHECK constraints**: precios y totales `>= 0`, cantidades `> 0`, `subtotal = unit_price * quantity`.
- **Trigger de integridad**: `sales.total_amount` siempre se recalcula desde sus items.
- **Trigger anti-manipulación**: el precio grabado en un item debe coincidir con el del catálogo.
- **Trigger anti-lockout**: no se puede quitar el rol `admin` al último administrador del sistema.
- **Sin XSS**: React escapa todo el renderizado; no se usan `dangerouslySetInnerHTML` ni `eval`.
- **`created_at` de ventas** lo fija el servidor (`now()`), no se puede backdatear.

Pasos manuales pendientes en el **dashboard de Supabase** (no se pueden automatizar desde el código):

1. **Authentication → Providers → Email**: desactivar **"Allow new users to sign up"** (no hay registro público; los usuarios se crean desde Administración vía la Edge Function `create-user`). Si lo dejás activado, cualquiera puede autoregistrarse como `vendedor` por API.
2. **Authentication → Policies → Password**: exigir contraseñas más fuertes (mínimo 8–12 caracteres) y activar la verificación de contraseñas comprometidas.
3. En la base **central** de licencias, verificar que `projects` solo exponga el `status` (nada de datos de facturación ni de otros clientes), y que la anon key de ahí no tenga permisos de escritura.
4. **Auth rate limits**: los límites por defecto de Supabase (login, signup) aplican automáticamente; no bajes los umbrales.

> La validación de licencia es 100% client-side: es un disuasivo para usuarios no técnicos, no una protección contra alguien que edite el bundle JS. Para protección real habría que mover la validación a un backend (Edge Function o proxy) con credenciales que no viajen al navegador.



## Build de producción

```bash
pnpm run build
pnpm run preview
```

## Versión de escritorio (Electron) y auto-update

La app también se puede empaquetar como aplicación de escritorio (Electron) y distribuirse con **actualizaciones automáticas** vía GitHub Releases.

### Scripts de Electron

| Script | Para qué |
|---|---|
| `pnpm dev:electron` | Correr la app de escritorio en modo desarrollo |
| `pnpm build:electron` | Compilar main + preload + renderer |
| `pnpm start:electron` | Previsualizar el build empaquetado |
| `pnpm dist:win` | Generar instalador `.exe` (NSIS) |
| `pnpm dist:win:publish` | Generar y **publicar** el release a GitHub (con auto-update) |

### Cómo funciona el auto-update

`electron/main.ts` usa `electron-updater`: al arrancar la app (en producción) chequea si hay una versión nueva en GitHub Releases. Si hay, la UI (`UpdateBanner`) muestra un banner con **el porcentaje de descarga en tiempo real**, y al terminar pregunta si querés "Reiniciar y actualizar".

El porcentaje llega del evento `download-progress` del updater a través de un puente segurizado por IPC (preload con `contextIsolation`).

### Publicar una versión nueva (release)

1. **Cargá las credenciales como secrets** en GitHub → Settings → Secrets and variables → Actions (una sola vez):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_SUPABASE_URL`, `VITE_ADMIN_SUPABASE_ANON_KEY`
   - `VITE_PROJECT_ID`

2. **Subí un tag con la versión nueva** (la versión debe incrementarse respecto del release anterior para que el updater la detecte). El `package.json` no necesita tocarse si manejás la versión solo con el tag, pero mantenelo alineado:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. El workflow `.github/workflows/release.yml` se dispara solo, compila en un runner de **Windows**, genera el instalador NSIS y **publica el release** en GitHub con el `.exe` y el `latest.yml` (que es lo que usa el auto-update para saber dónde descargar).

4. El usuario descarga el instalador desde la sección **Releases** del repo. Cuando saques una versión nueva, las apps instaladas detectan la actualización automáticamente y muestran el porcentaje de descarga.

> El instalador no está firmado digitalmente, así que Windows mostrará la advertencia de "editor desconocido". Es normal salvo que se compre un certificado de firma de código.

### Impresión térmica con QZ Tray (Windows)

La app de escritorio imprime el ticket en **ESC/POS raw** a través de [QZ Tray](https://qz.io) — sin diálogo de impresión, directo a la impresora **por defecto** de Windows, con el formato exacto (centrado, doble alto para el encabezado, code page WPC1252 y corte de papel).

**Setup por equipo donde vaya a imprimir (una sola vez):**

1. Instalá [QZ Tray](https://qz.io/download/) en la PC (descargá el instalador `.exe` para Windows y seguí el asistente).
2. Fijate que la impresora térmica quede como **impresora predeterminada** de Windows (Configuración → Dispositivos → Impresoras y escáneres → Establecer como predeterminada). La app usa siempre la predeterminada.
3. Asegurate de tener la impresora configurada como **raw/generic** (los drivers "Generic / Text Only" o el driver ESC/POS del fabricante funcionan; la app usa `forceRaw`).
4. **Firma silenciosa (para que NO pregunte al imprimir)**: sin esto, QZ muestra "¿Permitir?" en cada impresión. Abrí QZ Tray → **Advanced → Site Manager** → **"+"** → *Create New* → **Yes** a las tres preguntas. Se crea la carpeta **"QZ Tray Demo Cert"** en el Escritorio.
5. Copiá de esa carpeta `digital-certificate.txt` y `private-key.pem` a la carpeta `auth/` de la app:
   - **App instalada:** `%APPDATA%\CantoBar POS\auth\` (creala si no existe).
   - **En desarrollo:** `auth/` en la raíz del proyecto.

   La app firma los requests con esas claves (usando `node:crypto` en el proceso principal de Electron, la clave privada no viaja en el bundle web).

> ⚠️ **Varias PC (producción):** el demo cert de Site Manager solo es confiable **en la PC donde se generó**. Para imprimir igual de bien en todas las máquinas conviene generar UN par de claves propio (o comprar el certificado de QZ), copiar `override.crt` al `C:\Program Files\QZ Tray\` de cada equipo y usar ese mismo par en la carpeta `auth/` de todas. Así la firma vale en todos lados y no hay que configurar equipo por equipo.

**Si no aparece nada al cobrar:** la app cae automáticamente a `window.print()`, así que en ese caso revisá que QZ Tray esté corriendo (icono en la bandeja del sistema) y que la carpeta `auth/` tenga los dos archivos.

El código vive en `src/lib/thermalPrint.ts` y el script de QZ viene en `public/vendor/qz-tray.js` (v2.2.6). Si tu impresora muestra caracteres raros en los acentos, cambiá en ese archivo `QZ_ENCODING = 'Cp1252'` → `'Cp850'` y `ESCPOS_CODEPAGE = 16` → `2` (y viceversa).

### Distribución de credenciales

Las claves embebidas en el bundle son las `anon` públicas (por diseño). El `VITE_PROJECT_ID` identifica la instancia para el control de licencias. Si tenés varios clientes con distintos `project_id`, generá un instalador por cliente con su `.env`/secret correspondiente.
