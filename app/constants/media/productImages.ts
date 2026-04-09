import { ImageSourcePropType } from "react-native";

export type ProductImageKey =
  | "amstel.png"
  | "bifeAncho.png"
  | "bifeChorizo.jpg"
  | "carvao7kg.png"
  | "coca2l.png"
  | "cocaLata.png"
  | "contraFile.jpeg"
  | "corona.png"
  | "coxinhaAsa.png"
  | "denver.png"
  | "espeto_baby_beef.jpg"
  | "esptoCoracao.png"
  | "esptoLinguica.png"
  | "esptoSobrecoxa.png"
  | "fileFrangoTEMP.jpeg"
  | "flatIron.png"
  | "fraldinha.png"
  | "guaranaLata.png"
  | "gurana2l.png"
  | "heineken350ml.png"
  | "heinekenLongNeck.png"
  | "original350ml.png"
  | "panceta.png"
  | "paoQueijo.png"
  | "StrogonoffFrango.jpeg"
  | "toscana.png"
  | "tulipinhaTEMP.jpg";

export const PRODUCT_IMAGES: Record<ProductImageKey, ImageSourcePropType> = {
  "amstel.png": require("@/assets/images/productsImages/amstel.png"),
  "bifeAncho.png": require("@/assets/images/productsImages/bifeAncho.png"),
  "bifeChorizo.jpg": require("@/assets/images/productsImages/bifeChorizo.jpg"),
  "carvao7kg.png": require("@/assets/images/productsImages/carvao7kg.png"),
  "coca2l.png": require("@/assets/images/productsImages/coca2l.png"),
  "cocaLata.png": require("@/assets/images/productsImages/cocaLata.png"),
  "contraFile.jpeg": require("@/assets/images/productsImages/contraFile.jpeg"),
  "corona.png": require("@/assets/images/productsImages/corona.png"),
  "coxinhaAsa.png": require("@/assets/images/productsImages/coxinhaAsa.png"),
  "denver.png": require("@/assets/images/productsImages/denver.png"),
  "espeto_baby_beef.jpg": require("@/assets/images/productsImages/espeto_baby_beef.jpg"),
  "esptoCoracao.png": require("@/assets/images/productsImages/esptoCoracao.png"),
  "esptoLinguica.png": require("@/assets/images/productsImages/esptoLinguica.png"),
  "esptoSobrecoxa.png": require("@/assets/images/productsImages/esptoSobrecoxa.png"),
  "fileFrangoTEMP.jpeg": require("@/assets/images/productsImages/fileFrangoTEMP.jpeg"),
  "flatIron.png": require("@/assets/images/productsImages/flatIron.png"),
  "fraldinha.png": require("@/assets/images/productsImages/fraldinha.png"),
  "guaranaLata.png": require("@/assets/images/productsImages/guaranaLata.png"),
  "gurana2l.png": require("@/assets/images/productsImages/gurana2l.png"),
  "heineken350ml.png": require("@/assets/images/productsImages/heineken350ml.png"),
  "heinekenLongNeck.png": require("@/assets/images/productsImages/heinekenLongNeck.png"),
  "original350ml.png": require("@/assets/images/productsImages/original350ml.png"),
  "panceta.png": require("@/assets/images/productsImages/panceta.png"),
  "paoQueijo.png": require("@/assets/images/productsImages/paoQueijo.png"),
  "StrogonoffFrango.jpeg": require("@/assets/images/productsImages/StrogonoffFrango.jpeg"),
  "toscana.png": require("@/assets/images/productsImages/toscana.png"),
  "tulipinhaTEMP.jpg": require("@/assets/images/productsImages/tulipinhaTEMP.jpg"),
};

export const PRODUCT_IMAGE_LABELS: Record<ProductImageKey, string> = {
  "amstel.png": "Amstel",
  "bifeAncho.png": "Bife Ancho",
  "bifeChorizo.jpg": "Bife Chorizo",
  "carvao7kg.png": "Carvão 7kg",
  "coca2l.png": "Coca 2L",
  "cocaLata.png": "Coca Lata",
  "contraFile.jpeg": "Contra Filé",
  "corona.png": "Corona",
  "coxinhaAsa.png": "Coxinha da Asa",
  "denver.png": "Denver",
  "espeto_baby_beef.jpg": "Espeto Baby Beef",
  "esptoCoracao.png": "Espeto de Coração",
  "esptoLinguica.png": "Espeto de Linguiça",
  "esptoSobrecoxa.png": "Espeto de Sobrecoxa",
  "fileFrangoTEMP.jpeg": "Filé de Frango",
  "flatIron.png": "Flat Iron",
  "fraldinha.png": "Fraldinha",
  "guaranaLata.png": "Guaraná Lata",
  "gurana2l.png": "Guaraná 2L",
  "heineken350ml.png": "Heineken 350ml",
  "heinekenLongNeck.png": "Heineken Long Neck",
  "original350ml.png": "Original 350ml",
  "panceta.png": "Panceta",
  "paoQueijo.png": "Pão de Queijo",
  "StrogonoffFrango.jpeg": "Strogonoff de Frango",
  "toscana.png": "Toscana",
  "tulipinhaTEMP.jpg": "Tulipinha",
};

export const PRODUCT_IMAGE_OPTIONS = Object.keys(PRODUCT_IMAGES) as ProductImageKey[];

export function getProductImage(key?: string | null) {
  if (!key) return null;
  const normalized = key.trim() as ProductImageKey;
  return PRODUCT_IMAGES[normalized] ?? null;
}

export function getProductImageLabel(key?: string | null) {
  if (!key) return '';
  const normalized = key.trim() as ProductImageKey;
  return PRODUCT_IMAGE_LABELS[normalized] ?? normalized.replace(/\.[^.]+$/, '');
}
