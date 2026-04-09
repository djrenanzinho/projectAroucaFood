import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { ADMIN_EMAILS } from '@/constants/auth/adminEmails';
import { auth, db } from '@/config/firebase';
import type { Product } from '@/types/Product';

const BRAND = '#942229';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
type ExpiryFilter = 'all' | 'warning' | 'expired';

const getExpiryStatus = (expiryDate?: string | null) => {
  if (!expiryDate) {
    return { label: 'Validade: -', expired: false, warning: false };
  }

  const parsed = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Validade: -', expired: false, warning: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((parsed.getTime() - today.getTime()) / DAY_IN_MS);

  if (diffDays < 0) {
    return { label: 'Validade: Vencido', expired: true, warning: false };
  }

  if (diffDays === 0) {
    return { label: 'Validade: Vence hoje', expired: false, warning: true };
  }

  if (diffDays === 1) {
    return { label: 'Validade: 1 dia', expired: false, warning: true };
  }

  return {
    label: `Validade: ${diffDays} dias`,
    expired: false,
    warning: diffDays < 30,
  };
};

const formatExpiryDate = (expiryDate?: string | null) => {
  if (!expiryDate) {
    return '-';
  }

  const [year, month, day] = expiryDate.split('-');
  if (!year || !month || !day) {
    return expiryDate;
  }

  return `${day}/${month}/${year}`;
};

export default function ProdutosScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ExpiryFilter>('all');

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return email ? ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email) : false;
  }, [user]);

  const loadProducts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'produtos'));
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data?.name ?? 'Produto',
          price: Number(data?.price) || 0,
          category: data?.category ?? '-',
          highlights: Boolean(data?.highlights),
          stock: Number(data?.stock ?? 0),
          expiryDate: typeof data?.expiryDate === 'string' ? data.expiryDate : null,
          createdAt: data?.createdAt ?? null,
          updatedAt: data?.updatedAt ?? null,
        };
      });
      setProducts(list);
    } catch (err) {
      Alert.alert('Erro', 'Falha ao carregar produtos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso restrito', 'Você será redirecionado.', [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
      return;
    }
    loadProducts();
  }, [isAdmin, loadProducts, router]);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      setRefreshing(true);
      loadProducts();
    }, [isAdmin, loadProducts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, [loadProducts]);

  const summary = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        const expiryStatus = getExpiryStatus(product.expiryDate);

        acc.total += 1;

        if (expiryStatus.expired) {
          acc.expired += 1;
        } else if (expiryStatus.warning) {
          acc.warning += 1;
        }

        return acc;
      },
      { total: 0, warning: 0, expired: 0 }
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'all') {
      return products;
    }

    return products.filter((product) => {
      const expiryStatus = getExpiryStatus(product.expiryDate);

      if (activeFilter === 'expired') {
        return expiryStatus.expired;
      }

      return expiryStatus.warning && !expiryStatus.expired;
    });
  }, [activeFilter, products]);

  const openOptions = (item: Product) => {
    setSelected(item);
    setOptionsVisible(true);
  };

  const closeOptions = () => {
    setOptionsVisible(false);
    setSelected(null);
  };

  const handleEdit = () => {
    if (!selected) return;
    closeOptions();
    router.push({ pathname: '/adminConfigs/estoque', params: { editId: selected.id } });
  };

  const handleDelete = () => {
    if (!selected) return;
    Alert.alert('Excluir produto', `Deseja excluir "${selected.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'produtos', selected.id));
            await loadProducts();
            closeOptions();
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Product }) => {
    const expiryStatus = getExpiryStatus(item.expiryDate);
    const outOfStock = (item.stock ?? 0) <= 0;
    const cardStyle = expiryStatus.expired
      ? styles.cardExpired
      : expiryStatus.warning
        ? styles.cardWarning
        : null;

    return (
      <Pressable style={[styles.card, cardStyle]} onPress={() => openOptions(item)}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>Categoria: {item.category || '-'}</Text>
          <Text style={styles.cardMeta}>Destaque: {item.highlights ? 'Sim' : 'Não'}</Text>
          <Text style={[styles.cardMeta, outOfStock && styles.cardMetaAlert]}>
            Estoque: {outOfStock ? 'Sem estoque' : item.stock ?? 0}
          </Text>
          <Text
            style={[
              styles.cardMeta,
              (expiryStatus.expired || expiryStatus.warning) && styles.cardMetaAlert,
              expiryStatus.warning && !expiryStatus.expired && styles.cardMetaWarning,
            ]}>
            {expiryStatus.label}
          </Text>
          {activeFilter !== 'all' && item.expiryDate ? (
            <Text style={styles.cardMeta}>Data de validade: {formatExpiryDate(item.expiryDate)}</Text>
          ) : null}
          <Text style={styles.cardPrice}>R$ {item.price.toFixed(2)}</Text>
        </View>
        <Text style={styles.editHint}>Editar</Text>
      </Pressable>
    );
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Produtos</Text>
        <Pressable style={[styles.button, styles.primary]} onPress={() => router.push('/adminConfigs/estoque')}>
          <Text style={styles.buttonText}>Novo</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Pressable
          style={[styles.summaryCard, activeFilter === 'all' && styles.summaryCardActive]}
          onPress={() => setActiveFilter('all')}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{summary.total}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.summaryCard,
            styles.summaryWarningCard,
            activeFilter === 'warning' && styles.summaryCardActive,
          ]}
          onPress={() => setActiveFilter('warning')}>
          <Text style={styles.summaryLabel}>A vencer</Text>
          <Text style={styles.summaryValue}>{summary.warning}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.summaryCard,
            styles.summaryExpiredCard,
            activeFilter === 'expired' && styles.summaryCardActive,
          ]}
          onPress={() => setActiveFilter('expired')}>
          <Text style={styles.summaryLabel}>Vencidos</Text>
          <Text style={styles.summaryValue}>{summary.expired}</Text>
        </Pressable>
      </View>

      <Text style={styles.filterHint}>
        {activeFilter === 'all'
          ? 'Exibindo todos os produtos.'
          : activeFilter === 'warning'
            ? 'Exibindo somente produtos a vencer.'
            : 'Exibindo somente produtos vencidos.'}
      </Text>

      {loading ? (
        <Text style={styles.loading}>Carregando...</Text>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={[
            styles.listContent,
            filteredProducts.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum produto encontrado nesse filtro.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Modal transparent visible={optionsVisible} animationType="fade" onRequestClose={closeOptions}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOptions} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.name ?? 'Produto'}</Text>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.button, styles.secondary, styles.modalButton]} onPress={handleEdit}>
                <Text style={[styles.buttonText, styles.secondaryText]}>Editar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primary, styles.modalButton]} onPress={handleDelete}>
                <Text style={styles.buttonText}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf6f0', padding: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#2c1b12' },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: BRAND },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BRAND,
  },
  buttonText: { fontWeight: '800', color: '#fff' },
  secondaryText: { color: BRAND },
  loading: { color: '#6e5a4b' },
  listContent: { paddingBottom: 24 },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#eadfd2',
  },
  summaryCardActive: {
    borderWidth: 2,
    borderColor: '#2c1b12',
  },
  summaryWarningCard: {
    backgroundColor: '#fff7d6',
    borderColor: '#e5c24d',
  },
  summaryExpiredCard: {
    backgroundColor: '#fde2e2',
    borderColor: '#e48d8d',
  },
  summaryLabel: {
    color: '#6e5a4b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#2c1b12',
    fontSize: 22,
    fontWeight: '800',
  },
  filterHint: {
    color: '#6e5a4b',
    marginBottom: 12,
    fontWeight: '600',
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6e5a4b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eadfd2',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cardWarning: {
    backgroundColor: '#fff7d6',
    borderColor: '#e5c24d',
  },
  cardExpired: {
    backgroundColor: '#fde2e2',
    borderColor: '#e48d8d',
  },
  cardTitle: { fontWeight: '800', fontSize: 15, color: '#2c1b12' },
  cardMeta: { color: '#6e5a4b' },
  cardMetaAlert: { color: BRAND, fontWeight: '800' },
  cardMetaWarning: { color: '#8a6a00' },
  cardPrice: { color: BRAND, fontWeight: '800', marginTop: 4 },
  editHint: { color: BRAND, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eadfd2',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#2c1b12' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, paddingVertical: 12 },
});
