// ============================================================
// Tipos e interfaces estrictos para el sistema CantoBar POS
// ============================================================

export type PaymentMethod = 'Efectivo' | 'Transferencia';
export type UserRole = 'admin' | 'vendedor';

export interface Profile {
  id: string; // = auth.users.id
  email: string;
  full_name: string;
  role: UserRole;
}

export interface LocalConfig {
  id: string;
  name: string;
  subtitle: string;
  address: string;
  phone: string;
  cuit: string;
  ticket_footer_message: string;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface Drink {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
}

export interface Sale {
  id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  seller_id: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  drink_id: string | null;
  drink_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

// Venta "completa" con sus items, usada en el historial.
// seller_name se completa en el cliente haciendo join con profiles.
export interface SaleWithItems extends Sale {
  items: SaleItem[];
  seller_name?: string;
}

// Item del carrito en memoria, antes de confirmar la venta
export interface CartItem {
  drink_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

// Formularios de alta/edición
export type CategoryFormData = Pick<Category, 'name' | 'display_order' | 'is_active'>;
export type DrinkFormData = Pick<
  Drink,
  'category_id' | 'name' | 'description' | 'price' | 'is_available'
>;
export type LocalConfigFormData = Omit<LocalConfig, 'id'>;
export type ProfileRoleFormData = Pick<Profile, 'role'>;
