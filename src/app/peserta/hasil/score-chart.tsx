"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ScoreChart({ data }: { data: { name: string; score: number; max: number; min: number }[] }) {
  return (
    <div className="h-56 w-full" aria-label="Grafik perbandingan skor TWK, TIU, TKP">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} domain={[0, 225]} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="score" name="Skor" fill="#1b2f57" radius={[4, 4, 0, 0]} />
          <Bar dataKey="min" name="Ambang" fill="#d9c48f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
