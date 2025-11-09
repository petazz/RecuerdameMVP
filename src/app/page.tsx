"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

export default function Home() {
  const [centros, setCentros] = useState([]);

  useEffect(() => {
    const fetchCentros = async () => {
      const { data, error } = await supabase.from("centers").select("*");
      if (data) setCentros(data);
      if (error) console.log("Error:", error.message);
    };
    fetchCentros();
  }, []);

  return (
    <main>
      <h1>Centros guardados en Supabase:</h1>
      <ul>
        {centros.map((c: any) => (
          <li key={c.id}>
            {c.name} ({c.timezone})
          </li>
        ))}
      </ul>
    </main>
  );
}
