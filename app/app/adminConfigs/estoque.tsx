import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
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
import { auth, db } from '@/config/firebase';
import { ADMIN_EMAILS } from '@/constants/auth/adminEmails';
import { PRODUCT_IMAGE_OPTIONS, getProductImage, getProductImageLabel } from '@/constants/media/productImages';

const BRAND = '#942229';
const DEFAULT_CATEGORIES = [
  'Churrasco',
  'Suínos e Frangos',
  'Bebidas',
  'Cervejas',
  'Espetos',
  'Itens para churrasco',
  'Hamburguer',
  'Acompanhamentos',
  'Kits',
];

type Category = { id: string; name: string };
const mapDefaultCategories = (): Category[] => DEFAULT_CATEGORIES.map((c) => ({ id: `default-${c}`, name: c }));

const formatExpiryInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const formatStorageDateToInput = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year.slice(-2)}`;
};

const normalizeExpiryDateForSave = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return { value: '', valid: true };
  }

  if (digits.length !== 6) {
    return { value: '', valid: false };
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = 2000 + Number(digits.slice(4, 6));

  const date = new Date(year, month - 1, day);
  const isValid =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) {
    return { value: '', valid: false };
  }

  return {
    value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    valid: true,
  };
};

type FormState = {
  id: string;
  name: string;
  price: string;
  category: string;
  highlights: boolean;
  stock: string;
  expiryDate: string;
  image: string;
};

export default function EstoqueScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [categories, setCategories] = useState<Category[]>(mapDefaultCategories());

  const [form, setForm] = useState<FormState>({
    id: '',
    name: '',
    price: '',
    category: DEFAULT_CATEGORIES[0],
    highlights: false,
    stock: '',
    expiryDate: '',
    image: PRODUCT_IMAGE_OPTIONS[0] ?? '',
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
            expiryDate: formatStorageDateToInput(typeof data?.expiryDate === 'string' ? data.expiryDate : ''),
            image: typeof data?.image === 'string' ? data.image : PRODUCT_IMAGE_OPTIONS[0] ?? '',
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
    setForm({
      id: '',
      name: '',
      price: '',
      category: categories[0]?.name ?? DEFAULT_CATEGORIES[0],
      highlights: false,
      stock: '',
      expiryDate: '',
      image: PRODUCT_IMAGE_OPTIONS[0] ?? '',
    });

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

    const imageKey = form.image?.trim() || '';
    const expiryDateInput = form.expiryDate.trim();
    const expiryDateNormalized = normalizeExpiryDateForSave(expiryDateInput);

    if (!expiryDateNormalized.valid) {
      Alert.alert('Atenção', 'Data de validade inválida. Use o formato DD/MM/AA.');
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
          image: imageKey || null,
          highlights: form.highlights,
          stock: stockNumber,
          expiryDate: expiryDateNormalized.value || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'produtos'), {
          name: form.name.trim(),
          price: priceNumber,
          category,
          image: imageKey || null,
          highlights: form.highlights,
          stock: stockNumber,
          expiryDate: expiryDateNormalized.value || null,
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
              <Text style={styles.label}>Imagem</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              >
                {PRODUCT_IMAGE_OPTIONS.map((img) => {
                  const selected = form.image === img;
                  const source = getProductImage(img);
                  return (
                    <Pressable
                      key={img}
                      style={[styles.imageChip, selected && styles.imageChipSelected]}
                      onPress={() => setForm((f) => ({ ...f, image: img }))}
                    >
                      {source ? <Image source={source} style={styles.imageThumb} resizeMode="cover" /> : null}
                      <Text style={[styles.imageText, selected && styles.imageTextSelected]} numberOfLines={1}>
                        {getProductImageLabel(img)}
                      </Text>
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
            <View style={styles.field}>
              <Text style={styles.label}>Data de validade</Text>
              <TextInput
                value={form.expiryDate}
                onChangeText={(t) => setForm((f) => ({ ...f, expiryDate: formatExpiryInput(t) }))}
                placeholder="DD/MM/AA (opcional)"
                keyboardType="number-pad"
                maxLength={8}
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.helperInline}>Digite apenas os números. Exemplo: 030426</Text>
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
            <Text style={styles.formTitle}>Gerenciar categorias</Text>
            <View style={styles.addCategoryRow}>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder={renameTarget ? "Novo nome da categoria" : "Nova categoria"}
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

                  <View style={styles.categoryActions}>
                    <Pressable
                      style={[styles.button, styles.secondary, styles.categoryActionButton]}
                      onPress={() => handleStartRename(cat)}
                    >
                      <Text style={[styles.buttonText, styles.secondaryText]}>Renomear</Text>
                    </Pressable>

                    {!cat.id.startsWith('default-') ? (
                      <Pressable
                        style={[styles.button, styles.dangerButton, styles.categoryActionButton]}
                        onPress={() => handleRemoveCategory(cat.id)}
                      >
                        <Text style={styles.buttonText}>Remover</Text>
                      </Pressable>
                    ) : null}
                  </View>
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
  helperInline: { color: '#6e5a4b', fontSize: 12 },
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
  dangerButton: { backgroundColor: BRAND },
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
  imageChip: {
    width: 110,
    borderWidth: 1,
    borderColor: '#d9cfc2',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fdfaf6',
    alignItems: 'center',
    gap: 6,
  },
  imageChipSelected: {
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  imageThumb: { width: 70, height: 70, borderRadius: 10 },
  imageText: { fontSize: 12, textAlign: 'center', color: '#3c2b1e', fontWeight: '700' },
  imageTextSelected: { color: BRAND },
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
    flex: 1,
    paddingRight: 12,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  categoryActionButton: {
    flex: 0,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
