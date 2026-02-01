import { useEffect, useState } from "react";
import api from "../services/api";

interface Variant {
  _id: string;
  sku: string;
  stock: number;
}

interface Product {
  _id: string;
  name: string;
  variants: Variant[];
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
  }, []);

  return (
    <div>
      <h1>Products</h1>
      {products.map((p) => (
        <div key={p._id}>
          <h3>{p.name}</h3>
          <ul>
            {p.variants.map((v) => (
              <li key={v._id}>
                {v.sku} — Stock: {v.stock}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}