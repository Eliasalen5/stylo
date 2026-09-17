"use client";

import type { BusinessStats, DailyPoint, EntityMetric } from "@/lib/stats";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

const money = (value: number) =>
  `ARS ${value.toLocaleString("es-AR")}`;

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

function EntityBars({
  title,
  data,
}: {
  title: string;
  data: EntityMetric[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 h-64 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-400">
            Sin datos en el período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Turnos" fill="#18181b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export function StatsOverview({
  stats,
}: {
  stats: BusinessStats;
}) {
  const { totals, revenue, byService, byProfessional, daily } = stats;

  const dailyPoints: DailyPoint[] = daily;

  return (
    <div className="w-full max-w-5xl space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Estadísticas</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Últimos {stats.periodDays} días
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card label="Turnos totales" value={String(totals.total)} />
        <Card label="Ingresos" value={money(revenue.total)} />
        <Card label="Confirmados" value={String(totals.confirmed)} />
        <Card label="Completados" value={String(totals.completed)} />
        <Card label="Cancelados" value={String(totals.cancelled)} />
        <Card label="No asistió" value={String(totals.noShow)} />
        <Card label="Pendientes" value={String(totals.pending)} />
      </section>

      <section>
        <h2 className="text-sm font-semibold">Turnos e ingresos por día</h2>
        <div className="mt-2 h-64 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          {dailyPoints.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-zinc-400">
              Sin datos en el período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(value, name) => [value, name === "count" ? "Turnos" : name]} />
                <Legend />
                <Line type="monotone" dataKey="count" name="Turnos" stroke="#18181b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Ingresos por día</h2>
        <div className="mt-2 h-64 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          {dailyPoints.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-zinc-400">
              Sin datos en el período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip formatter={(value) => [money(Number(value)), "Ingresos"]} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Ingresos" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <EntityBars title="Turnos por servicio" data={byService} />
      <EntityBars title="Turnos por profesional" data={byProfessional} />
    </div>
  );
}