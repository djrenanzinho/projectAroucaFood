import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Product } from '@/types/Product';

const BRAND = '#942229';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type ExpiryFilter = 'all' | 'warning' | 'expired';

const getExpiryStatus = (expiryDate?: string | null) => {
  if (!expiryDate) return { label: '-', expired: false, warning: false };
  const parsed = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { label: '-', expired: false, warning: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((parsed.getTime() - today.getTime()) / DAY_IN_MS);
  if (diff < 0) return { label: 'Vencido', expired: true, warning: false };
  if (diff === 0) return { label: 'Vence hoje', expired: false, warning: true };
  if (diff < 30) return { label: `${diff}d`, expired: false, warning: true };
  return { label: `${diff}d`, expired: false, warning: false };
};

const formatInput = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const toStorageDate = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 6) return { value: '', valid: !d };
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = 2000 + Number(d.slice(4, 6));
  const date = new Date(year, month - 1, day);
  const valid =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!valid) return { value: '', valid: false };
  return { value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, valid: true };
};

const toDisplayDate = (v?: string | null) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y.slice(-2)}`;
};

type FormState = {
  id: string;
  name: string;
  price: string;
  category: string;
  stock: string;
  expiryDate: string;
  highlights: boolean;
};

const emptyForm = (): FormState => ({
  id: '', name: '', price: '', category: '', stock: '', expiryDate: '', highlights: false,
});

export default function EstoqueWebScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'produtos'), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data?.name ?? '',
          price: Number(data?.price) || 0,
          category: data?.category ?? '-',
          highlights: Boolean(data?.highlights),
          stock: Number(data?.stock ?? 0),
          expiryDate: typeof data?.expiryDate === 'string' ? data.expiryDate : null,
        };
      });
      setProducts(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warning = products.filter((p) => { const s = getExpiryStatus(p.expiryDate); return s.warning && !s.expired; }).length;
    const expired = products.filter((p) => getExpiryStatus(p.expiryDate).expired).length;
    return { total: products.length, warning, expired };
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q));
    }
    if (expiryFilter === 'warning') list = list.filter((p) => { const s = getExpiryStatus(p.expiryDate); return s.warning && !s.expired; });
    if (expiryFilter === 'expired') list = list.filter((p) => getExpiryStatus(p.expiryDate).expired);
    return list;
  }, [products, search, expiryFilter]);

  const openNew = () => { setForm(emptyForm()); setPanel(true); };
  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      category: p.category ?? '',
      stock: String(p.stock ?? 0),
      expiryDate: toDisplayDate(p.expiryDate),
      highlights: p.highlights ?? false,
    });
    setPanel(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Atenção', 'Informe nome e preço.');
      return;
    }
    const price = Number(form.price.replace(',', '.'));
    if (Number.isNaN(price)) { Alert.alert('Atenção', 'Preço inválido.'); return; }
    const stock = form.stock === '' ? 0 : Number(form.stock);
    if (Number.isNaN(stock) || stock < 0) { Alert.alert('Atenção', 'Estoque inválido.'); return; }
    const { value: expiryDate, valid } = toStorageDate(form.expiryDate);
    if (!valid) { Alert.alert('Atenção', 'Data de validade inválida. Use DD/MM/AA.'); return; }

    const payload = {
      name: form.name.trim(),
      price,
      category: form.category.trim() || '-',
      stock,
      expiryDate: expiryDate || null,
      highlights: form.highlights,
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      if (form.id) {
        await updateDoc(doc(db, 'produtos', form.id), payload);
      } else {
        await addDoc(collection(db, 'produtos'), { ...payload, createdAt: serverTimestamp() });
      }
      setPanel(false);
      setForm(emptyForm());
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Product) => {
    Alert.alert('Excluir', `Excluir "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'produtos', p.id)); } catch { Alert.alert('Erro', 'Não foi possível excluir.'); }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Main table area */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.pageTitle}>Estoque</Text>
            <Text style={styles.pageSubtitle}>{summary.total} produtos</Text>
          </View>
          <Pressable style={styles.primaryBtn} onPress={openNew}>
            <Text style={styles.primaryBtnText}>+ Novo produto</Text>
          </Pressable>
        </View>

        {/* Filtros */}
        <View style={styles.filterRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.tabRow}>
            {([
              { key: 'all' as ExpiryFilter, label: `Todos (${summary.total})` },
              { key: 'warning' as ExpiryFilter, label: `⚠️ A vencer (${summary.warning})` },
              { key: 'expired' as ExpiryFilter, label: `🔴 Vencidos (${summary.expired})` },
            ] as const).map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tabBtn, expiryFilter === tab.key && styles.tabBtnActive]}
                onPress={() => setExpiryFilter(tab.key)}>
                <Text style={[styles.tabBtnText, expiryFilter === tab.key && styles.tabBtnTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={BRAND} /></View>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {['Produto', 'Categoria', 'Preço', 'Estoque', 'Validade', 'Destaque', ''].map((h) => (
                <Text key={h} style={[styles.th, h === 'Produto' && { flex: 3 }, h === '' && { flex: 0, width: 120 }]}>{h}</Text>
              ))}
            </View>
            {filtered.map((p) => {
              const exp = getExpiryStatus(p.expiryDate);
              const outOfStock = (p.stock ?? 0) <= 0;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.tableRow,
                    exp.expired && styles.rowExpired,
                    exp.warning && !exp.expired && styles.rowWarning,
                  ]}>
                  <Text style={[styles.td, { flex: 3 }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.td} numberOfLines={1}>{p.category}</Text>
                  <Text style={styles.td}>R$ {p.price.toFixed(2)}</Text>
                  <Text style={[styles.td, outOfStock && styles.tdAlert]}>{outOfStock ? 'Sem estoque' : p.stock}</Text>
                  <Text style={[styles.td, exp.expired && styles.tdAlert, exp.warning && !exp.expired && styles.tdWarning]}>
                    {p.expiryDate ? toDisplayDate(p.expiryDate) : '-'}
                    {exp.expired ? ' 🔴' : exp.warning ? ' ⚠️' : ''}
                  </Text>
                  <Text style={styles.td}>{p.highlights ? '⭐ Sim' : 'Não'}</Text>
                  <View style={[styles.td, { flex: 0, width: 120, flexDirection: 'row', gap: 8 }]}>
                    <Pressable style={styles.editBtn} onPress={() => openEdit(p)}>
                      <Text style={styles.editBtnText}>Editar</Text>
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => handleDelete(p)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {filtered.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Side panel */}
      {panel && (
        <View style={styles.sidePanel}>
          <View style={styles.sidePanelHeader}>
            <Text style={styles.sidePanelTitle}>{form.id ? 'Editar produto' : 'Novo produto'}</Text>
            <Pressable onPress={() => setPanel(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {([
              { label: 'Nome', key: 'name', placeholder: 'Nome do produto' },
              { label: 'Preço', key: 'price', placeholder: 'Ex: 79.90', keyboard: 'decimal-pad' },
              { label: 'Categoria', key: 'category', placeholder: 'Ex: Churrasco' },
              { label: 'Estoque', key: 'stock', placeholder: 'Ex: 10', keyboard: 'number-pad' },
            ] as const).map(({ label, key, placeholder, keyboard }) => (
              <View key={key} style={styles.formField}>
                <Text style={styles.formLabel}>{label}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={placeholder}
                  value={form[key] as string}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
                  keyboardType={keyboard as any}
                />
              </View>
            ))}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Data de validade</Text>
              <TextInput
                style={styles.formInput}
                placeholder="DD/MM/AA (opcional)"
                value={form.expiryDate}
                onChangeText={(t) => setForm((f) => ({ ...f, expiryDate: formatInput(t) }))}
                keyboardType="number-pad"
                maxLength={8}
              />
              <Text style={styles.formHelper}>Digite apenas números. Ex: 030426</Text>
            </View>
            <View style={[styles.formField, styles.switchRow]}>
              <Text style={styles.formLabel}>Destaque (Promoções)</Text>
              <Switch
                value={form.highlights}
                onValueChange={(v) => setForm((f) => ({ ...f, highlights: v }))}
                trackColor={{ true: BRAND, false: '#ccc' }}
              />
            </View>
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setPanel(false)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? 'Salvando...' : form.id ? 'Atualizar' : 'Criar'}</Text>
              </Pressable>
            </View>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#2c1b12' },
  pageSubtitle: { fontSize: 13, color: '#6e5a4b' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  searchInput: {
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#d9cfc2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9cfc2',
    backgroundColor: '#fff',
  },
  tabBtnActive: { backgroundColor: '#2c1b12', borderColor: '#2c1b12' },
  tabBtnText: { fontSize: 13, color: '#6e5a4b', fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  // Table
  table: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8ddd4', overflow: 'hidden' },
  tableHeader: { backgroundColor: '#f8f4f0' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0e8e0', gap: 8,
  },
  rowWarning: { backgroundColor: '#fffbea' },
  rowExpired: { backgroundColor: '#fff0f0' },
  th: { flex: 1, fontWeight: '700', color: '#3c2b1e', fontSize: 12 },
  td: { flex: 1, fontSize: 14, color: '#2c1b12' },
  tdAlert: { color: BRAND, fontWeight: '700' },
  tdWarning: { color: '#92600a', fontWeight: '700' },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: BRAND, backgroundColor: '#fff',
  },
  editBtnText: { color: BRAND, fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fde2e2',
  },
  deleteBtnText: { color: BRAND, fontWeight: '700', fontSize: 12 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6e5a4b' },
  // Side panel
  sidePanel: {
    width: 360,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e8ddd4',
  },
  sidePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8ddd4',
  },
  sidePanelTitle: { fontSize: 17, fontWeight: '800', color: '#2c1b12' },
  closeBtn: { fontSize: 18, color: '#6e5a4b', fontWeight: '700' },
  formContent: { padding: 20, gap: 14, paddingBottom: 40 },
  formField: { gap: 6 },
  formLabel: { fontWeight: '700', fontSize: 13, color: '#3c2b1e' },
  formInput: {
    borderWidth: 1, borderColor: '#d9cfc2', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fdfaf6',
  },
  formHelper: { fontSize: 11, color: '#a08060' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#d9cfc2', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#6e5a4b', fontWeight: '700' },
});
