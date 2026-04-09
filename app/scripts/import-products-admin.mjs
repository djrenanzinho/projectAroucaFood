import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const importFile = path.resolve(__dirname, "../data/products-import.json");
const defaultServiceAccountFile = path.resolve(__dirname, "../serviceAccountKey.json");

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
  return text || null;
};

const toExpiryDate = (value) => {
  const text = toStringOrNull(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf-8");
  const sanitized = raw.replace(/^\uFEFF/, "").trim();
  return JSON.parse(sanitized);
};

const readProductsFromFile = async () => {
  let data;
  try {
    data = await readJsonFile(importFile);
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

const getServiceAccountPath = () => process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceAccountFile;

const initAdminApp = async () => {
  const serviceAccountPath = getServiceAccountPath();

  try {
    await fs.access(serviceAccountPath);
  } catch {
    throw new Error(
      `Arquivo de service account não encontrado em ${serviceAccountPath}. Baixe a chave JSON no Firebase/Google Cloud e salve nesse caminho, ou defina GOOGLE_APPLICATION_CREDENTIALS.`
    );
  }

  const serviceAccount = await readJsonFile(serviceAccountPath);

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
};

const main = async () => {
  await initAdminApp();
  const db = getFirestore();

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

  if (!validProducts.length) {
    throw new Error("Nenhum produto válido encontrado no JSON.");
  }

  const existingProductsSnap = await db.collection("produtos").get();
  const existingByName = new Map();

  existingProductsSnap.forEach((productDoc) => {
    const data = productDoc.data();
    const key = normalize(data?.name);
    if (key) {
      existingByName.set(key, { id: productDoc.id, data });
    }
  });

  const existingCategoriesSnap = await db.collection("categorias").get();
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

  const categoriesToEnsure = Array.from(new Set(validProducts.map((p) => p.category.trim()).filter(Boolean)));

  for (const categoryName of categoriesToEnsure) {
    const key = normalize(categoryName);
    if (existingCategories.has(key)) continue;

    await db.collection("categorias").add({
      nome: categoryName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing) {
      await db.collection("produtos").doc(existing.id).update(payload);
      updatedProducts += 1;
    } else {
      await db.collection("produtos").add({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
      createdProducts += 1;
    }
  }

  console.log("Importação concluída com sucesso.");
  console.log(`Produtos criados: ${createdProducts}`);
  console.log(`Produtos atualizados: ${updatedProducts}`);
  console.log(`Produtos ignorados (inválidos): ${skippedProducts}`);
  console.log(`Categorias criadas: ${createdCategories}`);
};

main().catch((err) => {
  console.error("Erro ao importar produtos:", err?.message ?? err);
  process.exitCode = 1;
});
