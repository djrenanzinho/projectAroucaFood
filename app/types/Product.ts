import type { Timestamp } from "firebase/firestore";

export type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  image?: string | null;
  imageStoragePath?: string | null;
  highlights?: boolean;
  stock?: number | null;
  expiryDate?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};
