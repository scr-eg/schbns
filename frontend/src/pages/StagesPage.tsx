import { useEffect, useState } from "react";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface Grade {
  id: string;
  name_ar: string;
}

interface Stage {
  id: string;
  name_ar: string;
  grades: Grade[];
}

export default function StagesPage() {
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    apiGet<{ data: Stage[] }>("/public/stages").then((res) => setStages(res.data));
  }, []);

  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-6">المراحل التعليمية</h1>
        <div className="grid md:grid-cols-3 gap-4">
          {stages.map((stage) => (
            <div key={stage.id} className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold mb-3" style={{ color: "var(--color-primary)" }}>{stage.name_ar}</h2>
              <ul className="space-y-1 text-sm text-gray-600">
                {stage.grades.map((g) => <li key={g.id}>• {g.name_ar}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
