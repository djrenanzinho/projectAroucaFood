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

export const PRODUCT_IMAGE_OPTIONS = Object.keys(PRODUCT_IMAGES) as ProductImageKey[];

export function getProductImage(key?: string | null) {
  if (!key) return null;
  const normalized = key.trim() as ProductImageKey;
  return PRODUCT_IMAGES[normalized] ?? null;
}
