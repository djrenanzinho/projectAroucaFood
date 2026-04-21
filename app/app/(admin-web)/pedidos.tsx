import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { Order, OrderItem, OrderStatus } from '@/types/Order';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
} from '@/types/Order';
import { BRAND_PRIMARY } from '@/constants/ui/colors';

const BRAND = BRAND_PRIMARY;

const ALL_STATUSES: (OrderStatus | 'all')[] = [
  'all',
  'novo',
  'em_preparo',
  'pronto',
  'entregue',
  'cancelado',
];

type NewItem = { name: string; price: string; qty: string };

export default function PedidosWebScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New order form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState<NewItem[]>([{ name: '', price: '', qty: '1' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          customerName: data?.customerName ?? '-',
          customerEmail: data?.customerEmail ?? null,
          customerPhone: data?.customerPhone ?? null,
          customerAddress: data?.customerAddress ?? null,
          items: Array.isArray(data?.items) ? data.items : [],
          total: Number(data?.total) || 0,
          status: data?.status ?? 'novo',
          origem: data?.origem ?? null,
          notes: data?.notes ?? null,
          createdAt: data?.createdAt ?? null,
          updatedAt: data?.updatedAt ?? null,
          updatedBy: data?.updatedBy ?? null,
        };
      });
      setOrders(list);
      setLoading(false);
      // refresh selected if open
      setSelected((current) => {
        if (!current) return current;
        const refreshed = list.find((o) => o.id === current.id);
        return refreshed ?? current;
      });
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          (o.customerPhone ?? '').includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const status of ORDER_STATUS_FLOW) {
      c[status] = orders.filter((o) => o.status === status).length;
    }
    c['cancelado'] = orders.filter((o) => o.status === 'cancelado').length;
    return c;
  }, [orders]);

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    if (order.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'pedidos', order.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email ?? null,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancel = async (order: Order) => {
    Alert.alert('Cancelar pedido', `Cancelar o pedido de "${order.customerName}"?`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'pedidos', order.id), {
              status: 'cancelado',
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser?.email ?? null,
            });
          } catch {
            Alert.alert('Erro', 'Não foi possível cancelar.');
          }
        },
      },
    ]);
  };

  const nextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = ORDER_STATUS_FLOW.indexOf(current);
    if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return null;
    return ORDER_STATUS_FLOW[idx + 1];
  };

  // New order form
  const addItemRow = () => setNewItems((prev) => [...prev, { name: '', price: '', qty: '1' }]);
  const removeItemRow = (i: number) => setNewItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItemRow = (i: number, field: keyof NewItem, value: string) => {
    setNewItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const handleCreateOrder = async () => {
    if (!newName.trim()) { Alert.alert('Atenção', 'Informe o nome do cliente.'); return; }
    const validItems: OrderItem[] = newItems
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        price: Number(it.price.replace(',', '.')) || 0,
        qty: Math.max(1, Number(it.qty) || 1),
      }));
    if (validItems.length === 0) { Alert.alert('Atenção', 'Adicione pelo menos um item.'); return; }
    const total = validItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    setSaving(true);
    try {
      await addDoc(collection(db, 'pedidos'), {
        customerName: newName.trim(),
        customerPhone: newPhone.trim() || null,
        customerAddress: newAddress.trim() || null,
        items: validItems,
        total,
        status: 'novo',
        origem: 'manual',
        notes: newNotes.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email ?? null,
      });
      setNewName(''); setNewPhone(''); setNewAddress(''); setNewNotes('');
      setNewItems([{ name: '', price: '', qty: '1' }]);
      setShowNewForm(false);
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Não foi possível criar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (order: Order) => {
    if (!order.createdAt) return '-';
    return order.createdAt.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <View style={styles.root}>
      {/* Main list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.pageTitle}>Pedidos</Text>
            <Text style={styles.pageSubtitle}>{orders.length} pedidos</Text>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => { setShowNewForm(true); setSelected(null); }}>
            <Text style={styles.primaryBtnText}>+ Novo pedido</Text>
          </Pressable>
        </View>

        {/* Status tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {ALL_STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[styles.tabBtn, statusFilter === s && styles.tabBtnActive]}
              onPress={() => setStatusFilter(s)}>
              <Text style={[styles.tabBtnText, statusFilter === s && styles.tabBtnTextActive]}>
                {s === 'all' ? 'Todos' : ORDER_STATUS_LABELS[s]} ({counts[s] ?? 0})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={BRAND} /></View>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {['#', 'Cliente', 'Total', 'Itens', 'Status', 'Data', ''].map((h) => (
                <Text
                  key={h}
                  style={[
                    styles.th,
                    h === '#' && { flex: 0, width: 80 },
                    h === 'Cliente' && { flex: 3 },
                    h === '' && { flex: 0, width: 200 },
                  ]}>
                  {h}
                </Text>
              ))}
            </View>
            {filtered.map((order) => {
              const next = nextStatus(order.status);
              const isSelected = selected?.id === order.id;
              return (
                <Pressable
                  key={order.id}
                  style={[styles.tableRow, isSelected && styles.rowSelected]}
                  onPress={() => { setSelected(order); setShowNewForm(false); }}>
                  <Text style={[styles.td, { flex: 0, width: 80, fontSize: 11, color: '#a08060' }]}
                    numberOfLines={1}>
                    #{order.id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[styles.td, { flex: 3 }]} numberOfLines={1}>{order.customerName}</Text>
                  <Text style={styles.td}>R$ {order.total.toFixed(2)}</Text>
                  <Text style={styles.td}>{order.items.length} item(s)</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusBadge, { backgroundColor: ORDER_STATUS_COLORS[order.status] }]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Text>
                  </View>
                  <Text style={[styles.td, { color: '#9e8a7a', fontSize: 12 }]} numberOfLines={1}>
                    {formatDate(order)}
                  </Text>
                  <View style={[{ flex: 0, width: 200, flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                    {next && order.status !== 'cancelado' ? (
                      <Pressable
                        style={styles.advanceBtn}
                        onPress={() => handleStatusChange(order, next)}
                        disabled={updatingStatus}>
                        <Text style={styles.advanceBtnText}>
                          → {ORDER_STATUS_LABELS[next]}
                        </Text>
                      </Pressable>
                    ) : null}
                    {order.status !== 'cancelado' && order.status !== 'entregue' ? (
                      <Pressable style={styles.cancelBtn} onPress={() => handleCancel(order)}>
                        <Text style={styles.cancelBtnText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {filtered.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Nenhum pedido encontrado.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Detail panel */}
      {selected && !showNewForm && (
        <View style={styles.sidePanel}>
          <View style={styles.sidePanelHeader}>
            <Text style={styles.sidePanelTitle}>Pedido #{selected.id.slice(-6).toUpperCase()}</Text>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.detailContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Cliente</Text>
              <Text style={styles.detailText}>{selected.customerName}</Text>
              {selected.customerPhone ? <Text style={styles.detailMeta}>📞 {selected.customerPhone}</Text> : null}
              {selected.customerAddress ? <Text style={styles.detailMeta}>📍 {selected.customerAddress}</Text> : null}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Itens</Text>
              {selected.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.qty}x {item.name}</Text>
                  <Text style={styles.itemPrice}>R$ {(item.price * item.qty).toFixed(2)}</Text>
                </View>
              ))}
              <View style={[styles.itemRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>R$ {selected.total.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Status</Text>
              <View style={styles.statusFlow}>
                {ORDER_STATUS_FLOW.map((s) => {
                  const isActive = selected.status === s;
                  const isDone = ORDER_STATUS_FLOW.indexOf(s) < ORDER_STATUS_FLOW.indexOf(selected.status as OrderStatus);
                  return (
                    <Pressable
                      key={s}
                      style={[
                        styles.statusFlowBtn,
                        isActive && { backgroundColor: ORDER_STATUS_COLORS[s], borderColor: ORDER_STATUS_COLORS[s] },
                        isDone && styles.statusFlowDone,
                      ]}
                      onPress={() => handleStatusChange(selected, s)}
                      disabled={updatingStatus || selected.status === 'cancelado'}>
                      <Text
                        style={[
                          styles.statusFlowBtnText,
                          (isActive || isDone) && { color: '#fff' },
                        ]}>
                        {ORDER_STATUS_LABELS[s]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selected.status !== 'cancelado' && selected.status !== 'entregue' ? (
                <Pressable style={styles.cancelOrderBtn} onPress={() => handleCancel(selected)}>
                  <Text style={styles.cancelOrderBtnText}>Cancelar pedido</Text>
                </Pressable>
              ) : null}
            </View>

            {selected.notes ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Observações</Text>
                <Text style={styles.detailText}>{selected.notes}</Text>
              </View>
            ) : null}

            <View style={styles.detailSection}>
              <Text style={styles.detailMeta}>Criado: {formatDate(selected)}</Text>
              {selected.updatedBy ? (
                <Text style={styles.detailMeta}>Atualizado por: {selected.updatedBy}</Text>
              ) : null}
              {selected.origem ? (
                <Text style={styles.detailMeta}>Origem: {selected.origem}</Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      )}

      {/* New order form panel */}
      {showNewForm && (
        <View style={styles.sidePanel}>
          <View style={styles.sidePanelHeader}>
            <Text style={styles.sidePanelTitle}>Novo pedido</Text>
            <Pressable onPress={() => setShowNewForm(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.detailContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Cliente</Text>
              <TextInput style={styles.formInput} placeholder="Nome *" value={newName} onChangeText={setNewName} />
              <TextInput style={styles.formInput} placeholder="Telefone" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
              <TextInput style={styles.formInput} placeholder="Endereço" value={newAddress} onChangeText={setNewAddress} />
            </View>

            <View style={styles.detailSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.detailSectionTitle}>Itens</Text>
                <Pressable onPress={addItemRow}>
                  <Text style={{ color: BRAND, fontWeight: '700', fontSize: 13 }}>+ Adicionar</Text>
                </Pressable>
              </View>
              {newItems.map((item, i) => (
                <View key={i} style={styles.newItemRow}>
                  <TextInput
                    style={[styles.formInput, { flex: 3 }]}
                    placeholder="Nome do item"
                    value={item.name}
                    onChangeText={(t) => updateItemRow(i, 'name', t)}
                  />
                  <TextInput
                    style={[styles.formInput, { flex: 1 }]}
                    placeholder="Preço"
                    value={item.price}
                    onChangeText={(t) => updateItemRow(i, 'price', t)}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.formInput, { width: 56 }]}
                    placeholder="Qtd"
                    value={item.qty}
                    onChangeText={(t) => updateItemRow(i, 'qty', t)}
                    keyboardType="number-pad"
                  />
                  {newItems.length > 1 ? (
                    <Pressable onPress={() => removeItemRow(i)} style={styles.removeItemBtn}>
                      <Text style={styles.removeItemBtnText}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Observações</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 80 }]}
                placeholder="Observações do pedido (opcional)"
                value={newNotes}
                onChangeText={setNewNotes}
                multiline
              />
            </View>

            <Pressable style={[styles.primaryBtn, { marginTop: 8 }]} onPress={handleCreateOrder} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Criando...' : 'Criar pedido'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { padding: 32, paddingBottom: 60, gap: 16 },
  centered: { padding: 32, alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#2c1b12' },
  pageSubtitle: { fontSize: 13, color: '#6e5a4b' },
  tabRow: { gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d9cfc2', backgroundColor: '#fff' },
  tabBtnActive: { backgroundColor: '#2c1b12', borderColor: '#2c1b12' },
  tabBtnText: { fontSize: 13, color: '#6e5a4b', fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  searchInput: {
    borderWidth: 1, borderColor: '#d9cfc2', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14,
  },
  primaryBtn: { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  table: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8ddd4', overflow: 'hidden' },
  tableHeader: { backgroundColor: '#f8f4f0' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0e8e0', gap: 8 },
  rowSelected: { backgroundColor: '#fdf6f0' },
  th: { flex: 1, fontWeight: '700', color: '#3c2b1e', fontSize: 12 },
  td: { flex: 1, fontSize: 14, color: '#2c1b12' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, color: '#fff', fontWeight: '700', fontSize: 12, overflow: 'hidden' },
  advanceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#2c1b12' },
  advanceBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fde2e2' },
  cancelBtnText: { color: BRAND, fontWeight: '700', fontSize: 12 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6e5a4b' },
  // Side panel
  sidePanel: { width: 380, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e8ddd4' },
  sidePanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e8ddd4' },
  sidePanelTitle: { fontSize: 17, fontWeight: '800', color: '#2c1b12' },
  closeBtnText: { fontSize: 18, color: '#6e5a4b', fontWeight: '700' },
  detailContent: { padding: 20, gap: 8, paddingBottom: 40 },
  detailSection: { gap: 6, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0e8e0' },
  detailSectionTitle: { fontSize: 12, fontWeight: '800', color: '#a08060', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailText: { fontSize: 15, color: '#2c1b12', fontWeight: '600' },
  detailMeta: { fontSize: 13, color: '#6e5a4b' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 14, color: '#2c1b12' },
  itemPrice: { fontSize: 14, color: '#2c1b12', fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#f0e8e0', marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#2c1b12' },
  totalValue: { fontSize: 16, fontWeight: '800', color: BRAND },
  statusFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statusFlowBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d9cfc2', backgroundColor: '#fff' },
  statusFlowDone: { backgroundColor: '#9e8a7a', borderColor: '#9e8a7a' },
  statusFlowBtnText: { fontSize: 12, fontWeight: '700', color: '#6e5a4b' },
  cancelOrderBtn: { borderWidth: 1, borderColor: BRAND, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  cancelOrderBtnText: { color: BRAND, fontWeight: '700', fontSize: 13 },
  formInput: { borderWidth: 1, borderColor: '#d9cfc2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fdfaf6', marginBottom: 8 },
  newItemRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  removeItemBtn: { paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#fde2e2', borderRadius: 6 },
  removeItemBtnText: { color: BRAND, fontWeight: '700', fontSize: 12 },
});
