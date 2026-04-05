import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';

function chartTooltipStyle(isDark) {
  return {
    background: isDark ? '#1c2237' : '#ffffff',
    border: `1px solid ${isDark ? '#2d3548' : '#e2e8f0'}`,
    borderRadius: 12,
    color: isDark ? '#e2e8f0' : '#0f172a',
    fontSize: 12,
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 8px 24px rgba(15,23,42,0.08)',
  };
}

export function MonthlyRevenueChart({ data, isDark }) {
  const grid = isDark ? '#2d3548' : '#e2e8f0';
  const tick = isDark ? '#94a3b8' : '#64748b';
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="adminOvBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3090cf" stopOpacity={1} />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.9} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
        />
        <Tooltip
          contentStyle={chartTooltipStyle(isDark)}
          formatter={(value) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Revenue']}
          cursor={{ fill: isDark ? 'rgba(48,144,207,0.08)' : 'rgba(48,144,207,0.06)' }}
        />
        <Bar dataKey="revenue" fill="url(#adminOvBarGrad)" radius={[8, 8, 0, 0]} maxBarSize={52} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrdersStatusDonut({ data, isDark }) {
  const tick = isDark ? '#94a3b8' : '#64748b';
  const total = data.reduce((s, d) => s + d.value, 0);
  const innerLabel = total > 0 ? `${Math.round((data[0]?.value / total) * 100) || 0}%` : '—';

  return (
    <div className="admin-ov-donut-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle(isDark)} formatter={(v, n) => [v, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="admin-ov-donut-center">
        <span className="admin-ov-donut-center__value">{innerLabel}</span>
        <span className="admin-ov-donut-center__label" style={{ color: tick }}>
          top segment
        </span>
      </div>
    </div>
  );
}

export function SalesTrendArea({ data, isDark }) {
  const grid = isDark ? '#2d3548' : '#e2e8f0';
  const tick = isDark ? '#94a3b8' : '#64748b';
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="adminOvAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: tick, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={chartTooltipStyle(isDark)}
          formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Sales']}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#adminOvAreaGrad)"
          animationDuration={1200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SparklineLine({ data, color, isDark }) {
  const stroke = color || '#3090cf';
  return (
    <ResponsiveContainer width="100%" height={56}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="sales"
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MiniRadialGauge({ percent, isDark }) {
  const p = Math.min(100, Math.max(0, percent));
  const chartData = [{ name: 'x', value: p, fill: '#3090cf' }];
  return (
    <ResponsiveContainer width="100%" height={100}>
      <RadialBarChart
        innerRadius="68%"
        outerRadius="100%"
        data={chartData}
        startAngle={225}
        endAngle={-45}
        cx="50%"
        cy="50%"
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: isDark ? '#2d3548' : '#e2e8f0' }}
          dataKey="value"
          cornerRadius={6}
          animationDuration={1000}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export function MiniBarsSpark({ data, isDark }) {
  const grid = 'transparent';
  return (
    <ResponsiveContainer width="100%" height={56}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <Bar
          dataKey="sales"
          fill="url(#adminOvMiniBar)"
          radius={[4, 4, 0, 0]}
          maxBarSize={8}
          animationDuration={800}
        />
        <defs>
          <linearGradient id="adminOvMiniBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}
