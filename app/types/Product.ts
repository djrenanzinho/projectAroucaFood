import type { Timestamp } from "firebase/firestore";

export type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  image?: string | null;
  highlights?: boolean;
  stock?: number | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};
