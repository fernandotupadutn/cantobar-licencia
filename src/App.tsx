import { useEffect, useMemo, useState } from 'react';
import { Wrench, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { useAuth, AuthProvider } from './lib/AuthContext';
import {
  CartItem,
  Category,
  CategoryFormData,
  Drink,
  DrinkFormData,
  LocalConfig,
  LocalConfigFormData,
  PaymentMethod,
  Profile,
  SaleWithItems,
} from './types';

import Navbar, { ActiveView } from './components/Navbar';
import SearchBar from './components/SearchBar';
import CategorySection from './components/CategorySection';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import CategoryModal from './components/CategoryModal';
import DrinkModal from './components/DrinkModal';
import ThermalTicket from './components/ThermalTicket';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import SubscriptionGuard from './components/SubscriptionGuard';

function AppContent({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const isAdmin = profile.role === 'admin';

  // ---------------------------------------------------------------
  // Estado general
  // ---------------------------------------------------------------
  const [activeView, setActiveView] = useState<ActiveView>('sell');
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');

  const [localConfig, setLocalConfig] = useState<LocalConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  const [categoryModalState, setCategoryModalState] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [drinkModalState, setDrinkModalState] = useState<{
    open: boolean;
    drink: Drink | null;
    defaultCategoryId?: string;
  }>({ open: false, drink: null });

  const [ticketToPrint, setTicketToPrint] = useState<SaleWithItems | null>(null);

  // ---------------------------------------------------------------
  // Carga inicial de datos
  // ---------------------------------------------------------------
  useEffect(() => {
    loadLocalConfig();
    loadCategories();
    loadDrinks();
  }, []);

  useEffect(() => {
    if (activeView === 'history') {
      loadSales();
    }
  }, [activeView]);

  useEffect(() => {
    if (ticketToPrint) {
      const timeout = setTimeout(() => window.print(), 150);
      return () => clearTimeout(timeout);
    }
  }, [ticketToPrint]);

  useEffect(() => {
    const handleAfterPrint = () => setTicketToPrint(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Si un vendedor quedaba con el panel de admin abierto y pierde el rol, lo mandamos a Vender
  useEffect(() => {
    if (!isAdmin && activeView === 'admin') {
      setActiveView('sell');
    }
  }, [isAdmin, activeView]);

  async function loadLocalConfig() {
    const { data, error } = await supabase.from('local_config').select('*').limit(1).maybeSingle();
    if (error) {
      console.error('Error cargando local_config:', error.message);
      return;
    }
    setLocalConfig(data as LocalConfig | null);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) {
      console.error('Error cargando categories:', error.message);
      return;
    }
    setCategories((data ?? []) as Category[]);
  }

  async function loadDrinks() {
    const { data, error } = await supabase.from('drinks').select('*').order('name', { ascending: true });
    if (error) {
      console.error('Error cargando drinks:', error.message);
      return;
    }
    setDrinks((data ?? []) as Drink[]);
  }

  async function loadSales() {
    setLoadingSales(true);
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('Error cargando sales:', salesError.message);
      setLoadingSales(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase.from('sale_items').select('*');
    if (itemsError) {
      console.error('Error cargando sale_items:', itemsError.message);
      setLoadingSales(false);
      return;
    }

    const { data: profilesData } = await supabase.from('profiles').select('*');

    const salesWithItems: SaleWithItems[] = (salesData ?? []).map((sale) => {
      const seller = (profilesData ?? []).find((p) => p.id === sale.seller_id);
      return {
        ...sale,
        items: (itemsData ?? []).filter((item) => item.sale_id === sale.id),
        seller_name: seller?.full_name || seller?.email,
      };
    });

    setSales(salesWithItems);
    setLoadingSales(false);
  }

  // ---------------------------------------------------------------
  // Catálogo filtrado por búsqueda
  // ---------------------------------------------------------------
  const filteredDrinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drinks;
    return drinks.filter(
      (d) => d.name.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)
    );
  }, [search, drinks]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.is_active || (isAdmin && editMode)),
    [categories, editMode, isAdmin]
  );

  // ---------------------------------------------------------------
  // Carrito
  // ---------------------------------------------------------------
  function addToCart(drink: Drink) {
    setCart((prev) => {
      const existing = prev.find((i) => i.drink_id === drink.id);
      if (existing) {
        return prev.map((i) => (i.drink_id === drink.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { drink_id: drink.id, name: drink.name, unit_price: drink.price, quantity: 1 }];
    });
  }

  function incrementItem(drinkId: string) {
    setCart((prev) => prev.map((i) => (i.drink_id === drinkId ? { ...i, quantity: i.quantity + 1 } : i)));
  }

  function decrementItem(drinkId: string) {
    setCart((prev) =>
      prev.map((i) => (i.drink_id === drinkId ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0)
    );
  }

  function removeItem(drinkId: string) {
    setCart((prev) => prev.filter((i) => i.drink_id !== drinkId));
  }

  function clearCart() {
    setCart([]);
  }

  // ---------------------------------------------------------------
  // Checkout: crea la venta + items en Supabase (con seller_id) e imprime el ticket
  // ---------------------------------------------------------------
  async function handleCheckout(method: PaymentMethod) {
    if (cart.length === 0) return;
    setIsCharging(true);

    try {
      // La venta se registra vía la RPC create_sale(): el servidor
      // resuelve precio/nombre/disponibilidad del catálogo y calcula
      // el total. El cliente solo envía drink_id + quantity, así no
      // se pueden inventar precios ni montos desde el navegador.
      const { data, error } = await supabase.rpc('create_sale', {
        p_payment_method: method,
        p_items: cart.map((item) => ({ drink_id: item.drink_id, quantity: item.quantity })),
      });

      if (error || !data) throw error ?? new Error('No se pudo crear la venta');

      const saleWithItems: SaleWithItems = {
        ...(data as SaleWithItems),
        seller_name: profile.full_name || profile.email,
      };

      setTicketToPrint(saleWithItems);
      setSales((prev) => [saleWithItems, ...prev]);
      clearCart();
    } catch (err) {
      console.error('Error al registrar la venta:', err);
      alert('Hubo un error al registrar la venta. Revisá la consola para más detalles.');
    } finally {
      setIsCharging(false);
    }
  }

  function handleReprint(sale: SaleWithItems) {
    setTicketToPrint(sale);
  }

  async function saveLocalConfig(formData: LocalConfigFormData) {
    if (localConfig) {
      const { data, error } = await supabase
        .from('local_config')
        .update(formData)
        .eq('id', localConfig.id)
        .select('*')
        .single();
      if (error) throw error;
      setLocalConfig(data as LocalConfig);
    } else {
      const { data, error } = await supabase.from('local_config').insert(formData).select('*').single();
      if (error) throw error;
      setLocalConfig(data as LocalConfig);
    }
  }

  async function saveCategory(formData: CategoryFormData) {
    if (categoryModalState.category) {
      const { data, error } = await supabase
        .from('categories')
        .update(formData)
        .eq('id', categoryModalState.category.id)
        .select('*')
        .single();
      if (error) throw error;
      setCategories((prev) => prev.map((c) => (c.id === data.id ? (data as Category) : c)));
    } else {
      const { data, error } = await supabase.from('categories').insert(formData).select('*').single();
      if (error) throw error;
      setCategories((prev) => [...prev, data as Category]);
    }
  }

  async function deleteCategory(category: Category) {
    const hasDrinks = drinks.some((d) => d.category_id === category.id);
    if (hasDrinks) {
      alert('No se puede eliminar una categoría que tiene bebidas cargadas. Eliminá o reasigná las bebidas primero.');
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;

    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    if (error) {
      console.error(error);
      alert('No se pudo eliminar la categoría.');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
  }

  async function saveDrink(formData: DrinkFormData) {
    if (drinkModalState.drink) {
      const { data, error } = await supabase
        .from('drinks')
        .update(formData)
        .eq('id', drinkModalState.drink.id)
        .select('*')
        .single();
      if (error) throw error;
      setDrinks((prev) => prev.map((d) => (d.id === data.id ? (data as Drink) : d)));
    } else {
      const { data, error } = await supabase.from('drinks').insert(formData).select('*').single();
      if (error) throw error;
      setDrinks((prev) => [...prev, data as Drink]);
    }
  }

  async function deleteDrink(drink: Drink) {
    if (!confirm(`¿Eliminar "${drink.name}"?`)) return;
    const { error } = await supabase.from('drinks').delete().eq('id', drink.id);
    if (error) {
      console.error(error);
      alert('No se pudo eliminar la bebida.');
      return;
    }
    setDrinks((prev) => prev.filter((d) => d.id !== drink.id));
    setCart((prev) => prev.filter((i) => i.drink_id !== drink.id));
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      <Navbar
        localConfig={localConfig}
        profile={profile}
        activeView={activeView}
        onChangeView={setActiveView}
        onSignOut={signOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {activeView === 'sell' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex-1">
                  <SearchBar value={search} onChange={setSearch} />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setEditMode((v) => !v)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
                      editMode
                        ? 'bg-zinc-800 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    {editMode ? 'Salir de administración' : 'Administrar catálogo'}
                  </button>
                )}
              </div>

              {isAdmin && editMode && (
                <button
                  onClick={() => setCategoryModalState({ open: true, category: null })}
                  className="w-full mb-4 border-2 border-dashed border-zinc-300 rounded-xl py-3 text-sm font-semibold text-zinc-500 hover:border-[#E06D00] hover:text-[#E06D00] transition-colors"
                >
                  + Nueva categoría
                </button>
              )}

              {visibleCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  drinks={filteredDrinks.filter((d) => d.category_id === category.id)}
                  editMode={isAdmin && editMode}
                  onAddToCart={addToCart}
                  onEditDrink={(drink) => setDrinkModalState({ open: true, drink })}
                  onDeleteDrink={deleteDrink}
                  onEditCategory={(cat) => setCategoryModalState({ open: true, category: cat })}
                  onDeleteCategory={deleteCategory}
                  onAddDrinkToCategory={(cat) =>
                    setDrinkModalState({ open: true, drink: null, defaultCategoryId: cat.id })
                  }
                />
              ))}

              {visibleCategories.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-10">Todavía no hay categorías cargadas.</p>
              )}
            </div>

            <div className="lg:sticky lg:top-32 lg:self-start lg:h-[calc(100vh-9rem)]">
              <Cart
                items={cart}
                isCharging={isCharging}
                onIncrement={incrementItem}
                onDecrement={decrementItem}
                onRemove={removeItem}
                onClear={clearCart}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        )}

        {activeView === 'history' && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">Historial de ventas</h2>
            <SalesHistory sales={sales} loading={loadingSales} onReprint={handleReprint} />
          </div>
        )}

        {activeView === 'admin' && isAdmin && (
          <AdminPanel localConfig={localConfig} onSaveLocalConfig={saveLocalConfig} />
        )}
      </main>

      {categoryModalState.open && (
        <CategoryModal
          category={categoryModalState.category}
          nextDisplayOrder={categories.length}
          onClose={() => setCategoryModalState({ open: false, category: null })}
          onSave={saveCategory}
        />
      )}

      {drinkModalState.open && (
        <DrinkModal
          drink={drinkModalState.drink}
          categories={categories}
          defaultCategoryId={drinkModalState.defaultCategoryId}
          onClose={() => setDrinkModalState({ open: false, drink: null })}
          onSave={saveDrink}
        />
      )}

      {ticketToPrint && <ThermalTicket sale={ticketToPrint} localConfig={localConfig} />}
    </div>
  );
}

function Gate() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#E06D00] animate-spin" />
      </div>
    );
  }

  if (!session) return <Login />;

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center px-4 text-center">
        <p className="text-sm text-zinc-500">
          Tu usuario todavía no tiene un perfil asignado. Pedile a un administrador que te dé de alta.
        </p>
      </div>
    );
  }

  return <AppContent profile={profile} />;
}

export default function App() {
  return (
    // SubscriptionGuard va POR FUERA de todo lo demás: si el servicio está
    // suspendido, ni siquiera se monta el login ni el resto de la app.
    <SubscriptionGuard>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SubscriptionGuard>
  );
}
