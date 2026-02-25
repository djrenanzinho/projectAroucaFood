import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { ADMIN_EMAILS } from '@/constants/adminEmails';
import { auth, db } from '@/firebaseConfig';
import type { Product } from '@/types/Product';

const BRAND = '#942229';

export default function ProdutosScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

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

  const renderItem = ({ item }: { item: Product }) => (
    <Pressable style={styles.card} onPress={() => openOptions(item)}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>Categoria: {item.category || '-'}</Text>
        <Text style={styles.cardMeta}>Destaque: {item.highlights ? 'Sim' : 'Não'}</Text>
        <Text style={styles.cardMeta}>Estoque: {item.stock ?? 0}</Text>
        <Text style={styles.cardPrice}>R$ {item.price.toFixed(2)}</Text>
      </View>
      <Text style={styles.editHint}>Editar</Text>
    </Pressable>
  );

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

      {loading ? (
        <Text style={styles.loading}>Carregando...</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.listContent}
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
  cardTitle: { fontWeight: '800', fontSize: 15, color: '#2c1b12' },
  cardMeta: { color: '#6e5a4b' },
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
