import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BRAND_PRIMARY } from '@/constants/ui/colors';
import type { Product } from '@/types/Product';
import type { Order } from '@/types/Order';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/Order';

const BRAND = BRAND_PRIMARY;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type Stat = { label: string; value: number | string; color?: string; sub?: string };

function StatCard({ label, value, color, sub }: Stat) {
  return (
    <View style={[styles.statCard, color ? { borderTopColor: color, borderTopWidth: 4 } : null]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function DashboardScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'produtos'), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data?.name ?? '',
          price: Number(data?.price) || 0,
          category: data?.category ?? null,
          stock: Number(data?.stock ?? 0),
          expiryDate: typeof data?.expiryDate === 'string' ? data.expiryDate : null,
          highlights: Boolean(data?.highlights),
        };
      });
      setProducts(list);
      setLoadingProducts(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          customerName: data?.customerName ?? '-',
          status: data?.status ?? 'novo',
          total: Number(data?.total) || 0,
          items: data?.items ?? [],
          createdAt: data?.createdAt ?? null,
        };
      });
      setOrders(list);
      setLoadingOrders(false);
    });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const outOfStock = products.filter((p) => (p.stock ?? 0) <= 0).length;
    const expiring = products.filter((p) => {
      if (!p.expiryDate) return false;
      const d = new Date(`${p.expiryDate}T00:00:00`);
      const diff = Math.ceil((d.getTime() - today.getTime()) / DAY_IN_MS);
      return diff >= 0 && diff < 30;
    }).length;
    const expired = products.filter((p) => {
      if (!p.expiryDate) return false;
      const d = new Date(`${p.expiryDate}T00:00:00`);
      return d < today;
    }).length;

    const novos = orders.filter((o) => o.status === 'novo').length;
    const emPreparo = orders.filter((o) => o.status === 'em_preparo').length;
    const prontos = orders.filter((o) => o.status === 'pronto').length;
    const totalHoje = orders.filter((o) => {
      if (!o.createdAt) return false;
      const d = o.createdAt.toDate();
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    return { outOfStock, expiring, expired, novos, emPreparo, prontos, totalHoje };
  }, [products, orders]);

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);

  if (loadingProducts || loadingOrders) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Dashboard</Text>
      <Text style={styles.pageSubtitle}>Visão geral em tempo real</Text>

      {/* Pedidos */}
      <Text style={styles.sectionTitle}>Pedidos</Text>
      <View style={styles.statsRow}>
        <StatCard label="Hoje" value={stats.totalHoje} color="#3b82f6" />
        <StatCard label="Novos" value={stats.novos} color="#3b82f6" sub="Aguardando preparo" />
        <StatCard label="Em preparo" value={stats.emPreparo} color="#f59e0b" />
        <StatCard label="Prontos" value={stats.prontos} color="#22c55e" sub="Aguardando retirada" />
        <StatCard label="Total de pedidos" value={orders.length} />
      </View>

      {/* Estoque */}
      <Text style={styles.sectionTitle}>Estoque</Text>
      <View style={styles.statsRow}>
        <StatCard label="Produtos" value={products.length} />
        <StatCard label="Sem estoque" value={stats.outOfStock} color={stats.outOfStock > 0 ? BRAND : '#22c55e'} />
        <StatCard label="A vencer (30d)" value={stats.expiring} color={stats.expiring > 0 ? '#f59e0b' : '#22c55e'} />
        <StatCard label="Vencidos" value={stats.expired} color={stats.expired > 0 ? BRAND : '#22c55e'} />
      </View>

      {/* Últimos pedidos */}
      <Text style={styles.sectionTitle}>Pedidos recentes</Text>
      {recentOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum pedido ainda.</Text>
        </View>
      ) : (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCellHead, { flex: 2 }]}>Cliente</Text>
            <Text style={[styles.tableCellHead, { flex: 1 }]}>Total</Text>
            <Text style={[styles.tableCellHead, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableCellHead, { flex: 1 }]}>Data</Text>
          </View>
          {recentOrders.map((order) => (
            <View key={order.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                {order.customerName}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                R$ {order.total.toFixed(2)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.statusBadge,
                    { backgroundColor: ORDER_STATUS_COLORS[order.status] },
                  ]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Text>
              </View>
              <Text style={[styles.tableCell, { flex: 1, color: '#9e8a7a' }]}>
                {order.createdAt
                  ? order.createdAt.toDate().toLocaleDateString('pt-BR')
                  : '-'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 32, paddingBottom: 60, gap: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6e5a4b' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#2c1b12' },
  pageSubtitle: { fontSize: 14, color: '#6e5a4b', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#2c1b12', marginTop: 16, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd4',
    minWidth: 140,
    gap: 4,
  },
  statValue: { fontSize: 32, fontWeight: '800', color: '#2c1b12' },
  statLabel: { fontSize: 13, color: '#6e5a4b', fontWeight: '600' },
  statSub: { fontSize: 11, color: '#a08060' },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e8ddd4',
    alignItems: 'center',
  },
  emptyText: { color: '#6e5a4b' },
  table: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ddd4',
    overflow: 'hidden',
  },
  tableHeader: { backgroundColor: '#f8f4f0' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8e0',
    alignItems: 'center',
    gap: 8,
  },
  tableCellHead: { fontWeight: '700', color: '#3c2b1e', fontSize: 13 },
  tableCell: { fontSize: 14, color: '#2c1b12' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    overflow: 'hidden',
  },
});
