import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const importFile = path.resolve(__dirname, "../data/products-import.json");

const firebaseConfig = {
  apiKey: "AIzaSyDFOZITJ8YNb8XuIaXZQ_u1yut9xhFF9eE",
  authDomain: "arouca-food.firebaseapp.com",
  projectId: "arouca-food",
  storageBucket: "arouca-food.appspot.com",
  messagingSenderId: "271556033301",
  appId: "1:271556033301:web:0ef7c5d7ca86a9fbc0471c",
  measurementId: "G-F0RK7ZB3CJ",
};

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value) => Boolean(value);

const toStringOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text;
};

const toExpiryDate = (value) => {
  const text = toStringOrNull(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
};

const readProductsFromFile = async () => {
  const raw = await fs.readFile(importFile, "utf-8");
  const sanitized = raw.replace(/^\uFEFF/, "").trim();

  let data;
  try {
    data = JSON.parse(sanitized);
  } catch (err) {
    throw new Error(
      `Falha ao ler data/products-import.json. Verifique se o arquivo é JSON válido. Erro: ${err?.message ?? err}`
    );
  }

  if (!Array.isArray(data)) {
    throw new Error("O arquivo data/products-import.json deve conter um array.");
  }
  return data;
};

const main = async () => {
  const email = process.env.FIREBASE_ADMIN_EMAIL;
  const password = process.env.FIREBASE_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Defina FIREBASE_ADMIN_EMAIL e FIREBASE_ADMIN_PASSWORD antes de rodar o import."
    );
  }

  const products = await readProductsFromFile();
  const validProducts = products
    .map((item) => {
      const name = toStringOrNull(item?.name);
      const category = toStringOrNull(item?.category);
      if (!name || !category) return null;

      return {
        name,
        price: toNumber(item?.price, 0),
        category,
        image: toStringOrNull(item?.image),
        highlights: toBool(item?.highlights),
        stock: Math.max(0, toNumber(item?.stock, 0)),
        expiryDate: toExpiryDate(item?.expiryDate),
      };
    })
    .filter(Boolean);

  if (validProducts.length === 0) {
    throw new Error("Nenhum produto válido encontrado no JSON.");
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, email, password);

  try {
    const existingProductsSnap = await getDocs(collection(db, "produtos"));
    const existingByName = new Map();

    existingProductsSnap.forEach((productDoc) => {
      const data = productDoc.data();
      const key = normalize(data?.name);
      if (key) {
        existingByName.set(key, { id: productDoc.id, data });
      }
    });

    const existingCategoriesSnap = await getDocs(collection(db, "categorias"));
    const existingCategories = new Set(
      existingCategoriesSnap.docs
        .map((d) => d.data())
        .map((data) => normalize(data?.nome ?? data?.name))
        .filter(Boolean)
    );

    let createdProducts = 0;
    let updatedProducts = 0;
    let skippedProducts = products.length - validProducts.length;
    let createdCategories = 0;

    const categoriesToEnsure = Array.from(
      new Set(validProducts.map((p) => p.category.trim()).filter(Boolean))
    );

    for (const categoryName of categoriesToEnsure) {
      const key = normalize(categoryName);
      if (existingCategories.has(key)) continue;

      await addDoc(collection(db, "categorias"), {
        nome: categoryName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      existingCategories.add(key);
      createdCategories += 1;
    }

    for (const product of validProducts) {
      const key = normalize(product.name);
      const existing = existingByName.get(key);

      const payload = {
        name: product.name,
        price: product.price,
        category: product.category,
        image: product.image,
        highlights: product.highlights,
        stock: product.stock,
        expiryDate: product.expiryDate,
        updatedAt: serverTimestamp(),
      };

      if (existing) {
        await updateDoc(doc(db, "produtos", existing.id), payload);
        updatedProducts += 1;
      } else {
        await addDoc(collection(db, "produtos"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        createdProducts += 1;
      }
    }

    console.log("Importação concluída com sucesso.");
    console.log(`Produtos criados: ${createdProducts}`);
    console.log(`Produtos atualizados: ${updatedProducts}`);
    console.log(`Produtos ignorados (inválidos): ${skippedProducts}`);
    console.log(`Categorias criadas: ${createdCategories}`);
  } finally {
    await signOut(auth);
  }
};

main().catch((err) => {
  console.error("Erro ao importar produtos:", err?.message ?? err);
  process.exitCode = 1;
});
