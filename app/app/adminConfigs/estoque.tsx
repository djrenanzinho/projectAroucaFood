import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { ADMIN_EMAILS } from '@/constants/adminEmails';

const BRAND = '#942229';
const DEFAULT_CATEGORIES = ['Churrasco', 'Suínos e Frangos', 'Kits', 'Bebidas'];

type Category = { id: string; name: string };
const mapDefaultCategories = (): Category[] => DEFAULT_CATEGORIES.map((c) => ({ id: `default-${c}`, name: c }));

export default function EstoqueScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [categories, setCategories] = useState<Category[]>(mapDefaultCategories());

  const [form, setForm] = useState({
    id: '',
    name: '',
    price: '',
    category: DEFAULT_CATEGORIES[0],
    highlights: false,
    stock: '',
  });
  const [saving, setSaving] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [renameTarget, setRenameTarget] = useState<Category | null>(null);
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return email ? ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email) : false;
  }, [user]);

  const parseNumber = (value: string) => Number(value.replace(',', '.').trim());

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
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'categorias'));
        const fetched: Category[] = snap.docs
          .map((d) => {
            const data = d.data();
            const name = typeof data?.nome === 'string' ? data.nome.trim() : typeof data?.name === 'string' ? data.name.trim() : '';
            return name ? { id: d.id, name } : null;
          })
          .filter(Boolean) as Category[];

        const unique = new Map<string, Category>();
        [...fetched, ...mapDefaultCategories()].forEach((cat) => {
          const key = cat.name.toLowerCase();
          if (!unique.has(key)) unique.set(key, cat);
        });

        const list = Array.from(unique.values());
        setCategories(list);
        setForm((f) => ({ ...f, category: f.category || list[0]?.name || '' }));
      } catch (err) {
        console.warn('Falha ao carregar categorias', err);
      }
    };

    loadCategories();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    if (!editId) {
      resetForm();
      return;
    }

    const loadProduct = async () => {
      setPrefillLoading(true);
      try {
        const snap = await getDoc(doc(db, 'produtos', String(editId)));
        if (snap.exists()) {
          const data = snap.data();
          const incomingCat = typeof data?.category === 'string' && data.category.trim() ? data.category.trim() : DEFAULT_CATEGORIES[0];
          setCategories((prev) => {
            const exists = prev.some((c) => c.name.toLowerCase() === incomingCat.toLowerCase());
            return exists ? prev : [...prev, { id: `temp-${incomingCat}`, name: incomingCat }];
          });
          setForm({
            id: snap.id,
            name: data?.name ?? '',
            price: data?.price != null ? String(data.price) : '',
            category: incomingCat,
            highlights: Boolean(data?.highlights),
            stock: data?.stock != null ? String(data.stock) : '',
          });
        } else {
          Alert.alert('Produto não encontrado', 'Verifique se ele ainda existe.');
          resetForm();
        }
      } catch (err) {
        Alert.alert('Erro', 'Falha ao carregar produto para edição.');
        resetForm();
      } finally {
        setPrefillLoading(false);
      }
    };

    loadProduct();
  }, [editId, isAdmin]);

  const resetForm = () =>
    setForm({ id: '', name: '', price: '', category: categories[0]?.name ?? DEFAULT_CATEGORIES[0], highlights: false, stock: '' });

  const handleAddCategory = async () => {
    const value = newCategory.trim();
    if (!value) return;

    // Renomear categoria existente
    if (renameTarget) {
      const duplicate = categories.some(
        (c) => c.id !== renameTarget.id && c.name.toLowerCase() === value.toLowerCase()
      );
      if (duplicate) {
        Alert.alert('Atenção', 'Já existe uma categoria com esse nome.');
        return;
      }
      try {
        if (!renameTarget.id.startsWith('default-') && !renameTarget.id.startsWith('temp-')) {
          await updateDoc(doc(db, 'categorias', renameTarget.id), {
            nome: value,
            updatedAt: serverTimestamp(),
          });
        }
        setCategories((prev) =>
          prev.map((c) => (c.id === renameTarget.id ? { ...c, name: value } : c))
        );
        setForm((f) => ({ ...f, category: f.category === renameTarget.name ? value : f.category }));
        setRenameTarget(null);
        setNewCategory('');
        return;
      } catch (err) {
        Alert.alert('Erro', 'Não foi possível renomear a categoria.');
        return;
      }
    }

    try {
      const exists = categories.some((c) => c.name.toLowerCase() === value.toLowerCase());
      if (exists) {
        setForm((f) => ({ ...f, category: value }));
        setNewCategory('');
        return;
      }

      const docRef = await addDoc(collection(db, 'categorias'), {
        nome: value,
        createdAt: serverTimestamp(),
      });

      const nextCat = { id: docRef.id, name: value };
      setCategories((prev) => [...prev, nextCat]);
      setForm((f) => ({ ...f, category: value }));
      setNewCategory('');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível criar a categoria.');
    }
  };

  const handleRemoveCategory = (catId: string) => {
    const target = categories.find((c) => c.id === catId);
    if (!target) return;
    const isDefault = target.id.startsWith('default-');
    const isTemp = target.id.startsWith('temp-');
    if (isDefault) {
      Alert.alert('Não permitido', 'Categorias padrão não podem ser removidas.');
      return;
    }

    Alert.alert('Remover categoria', `Deseja remover "${target.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!isTemp) {
              await deleteDoc(doc(db, 'categorias', catId));
            }
            setCategories((prev) => {
              const next = prev.filter((c) => c.id !== catId);
              if (next.length === 0) return mapDefaultCategories();
              if (form.category === target.name) {
                setForm((f) => ({ ...f, category: next[0].name }));
              }
              return next;
            });
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível remover a categoria.');
          }
        },
      },
    ]);
  };

  const handleStartRename = (cat: Category) => {
    setRenameTarget(cat);
    setNewCategory(cat.name);
  };

  const handleCancelRename = () => {
    setRenameTarget(null);
    setNewCategory('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Atenção', 'Informe nome e preço.');
      return;
    }
    const priceNumber = parseNumber(form.price);
    if (Number.isNaN(priceNumber)) {
      Alert.alert('Atenção', 'Preço inválido.');
      return;
    }

    const stockNumber = form.stock === '' ? 0 : parseNumber(form.stock);
    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      Alert.alert('Atenção', 'Estoque deve ser um número zero ou positivo.');
      return;
    }

    const category = form.category.trim();
    if (!category) {
      Alert.alert('Atenção', 'Informe uma categoria.');
      return;
    }
    setCategories((prev) => {
      const exists = prev.some((c) => c.name.toLowerCase() === category.toLowerCase());
      return exists ? prev : [...prev, { id: `temp-${category}`, name: category }];
    });

    try {
      setSaving(true);
      if (form.id) {
        await updateDoc(doc(db, 'produtos', form.id), {
          name: form.name.trim(),
          price: priceNumber,
          category,
          highlights: form.highlights,
          stock: stockNumber,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'produtos'), {
          name: form.name.trim(),
          price: priceNumber,
          category,
          highlights: form.highlights,
          stock: stockNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar produto', err);
      Alert.alert('Erro', err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>Edite ou crie produtos rapidamente.</Text>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{form.id ? 'Editar produto' : 'Novo produto'}</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="Nome do produto"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Preço</Text>
              <TextInput
                value={form.price}
                onChangeText={(t) => setForm((f) => ({ ...f, price: t }))}
                placeholder="Ex: 79.90"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {categories.map((cat) => {
                  const selected = form.category === cat.name;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setForm((f) => ({ ...f, category: cat.name }))}
                      onLongPress={() => handleRemoveCategory(cat.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{cat.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Estoque</Text>
              <TextInput
                value={form.stock}
                onChangeText={(t) => setForm((f) => ({ ...f, stock: t }))}
                placeholder="Ex: 10"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.switchRow]}>
              <Text style={styles.label}>Destaque (Promoções)</Text>
              <Switch
                value={form.highlights}
                onValueChange={(v) => setForm((f) => ({ ...f, highlights: v }))}
                trackColor={{ true: BRAND, false: '#ccc' }}
                thumbColor={form.highlights ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={[styles.button, styles.secondary]} onPress={resetForm} disabled={saving}>
                <Text style={[styles.buttonText, styles.secondaryText]}>Limpar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primary]} onPress={handleSave} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Salvando...' : form.id ? 'Atualizar' : 'Criar'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.categoryCard}>
            <Text style={styles.formTitle}>Criar ou Remover categorias</Text>
            <View style={styles.addCategoryRow}>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="Nova categoria"
                style={[styles.input, styles.addCategoryInput]}
              />
              <Pressable style={[styles.button, styles.primary, styles.addCategoryButton]} onPress={handleAddCategory}>
                <Text style={styles.buttonText}>{renameTarget ? 'Salvar nome' : 'Criar'}</Text>
              </Pressable>
            </View>
            <View>
              {renameTarget ? (
              <Pressable onPress={handleCancelRename} style={styles.cancelRenameBtn}>
                <Text style={styles.cancelRenameText}>Cancelar renomear</Text>
              </Pressable>
            ) : null}
            </View>
            <View style={styles.categoryList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Pressable
                    style={[styles.button, styles.secondary, styles.removeButton]}
                    onPress={() =>
                      cat.id.startsWith('default-') ? handleStartRename(cat) : handleRemoveCategory(cat.id)
                    }
                  >
                    <Text style={[styles.buttonText, styles.secondaryText]}>
                      {cat.id.startsWith('default-') ? 'Renomear' : 'Remover'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {prefillLoading ? <Text style={styles.loading}>Carregando produto...</Text> : null}
          <Text style={styles.helper}>Use a aba Produtos para listar e escolher itens para editar.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf6f0' },
  content: { padding: 16, paddingBottom: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#2c1b12' },
  subtitle: { color: '#6e5a4b' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eadfd2',
    gap: 10,
  },
  formTitle: { fontWeight: '800', color: '#2c1b12' },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eadfd2',
    gap: 10,
  },
  field: { gap: 6 },
  label: { fontWeight: '700', color: '#3c2b1e' },
  input: {
    borderWidth: 1,
    borderColor: '#d9cfc2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fdfaf6',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: BRAND },
  primaryText: { color: '#fff' },
  secondary: { borderWidth: 1, borderColor: BRAND, backgroundColor: 'transparent' },
  secondaryText: { color: BRAND },
  buttonText: { fontWeight: '800', color: '#fff' },
  loading: { color: '#6e5a4b' },
  helper: { color: '#6e5a4b', marginTop: -2 },
  cancelRenameBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelRenameText: {
    color: BRAND,
    fontWeight: '800',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d9cfc2',
  },
  chipSelected: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3c2b1e',
  },
  chipTextSelected: {
    color: '#fff',
  },
  addCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addCategoryInput: {
    flex: 1,
  },
  addCategoryButton: {
    paddingHorizontal: 16,
  },
  categoryList: {
    gap: 8,
    marginTop: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#eadfd2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fdfaf6',
  },
  categoryName: {
    fontWeight: '700',
    color: '#2c1b12',
  },
  removeButton: {
    flex: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
