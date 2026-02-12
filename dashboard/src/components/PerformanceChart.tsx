'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { performanceData } from '@/data/mock';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string } }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-card border border-gray-700/50 rounded-lg px-4 py-3 shadow-xl">
        <p className="text-xs text-gray-500 font-sans mb-1">{label}</p>
        <p className="font-mono text-lg font-bold text-gray-100">
          ${payload[0].value.toFixed(2)}
        </p>
        {payload[0].payload.label && (
          <p className="text-xs text-cyan-glow/80 mt-1">{payload[0].payload.label}</p>
        )}
      </div>
    );
  }
  return null;
}

export default function PerformanceChart() {
  return (
    <section className="px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="rounded-xl bg-bg-card border border-gray-800/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-sans font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-cyan-glow/60">◆</span>
              Portfolio Performance
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Value over time (SOL denominated → USD)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">10d</span>
            <div className="w-px h-3 bg-gray-700" />
            <span className="font-mono text-sm text-gray-300">
              ${performanceData[performanceData.length - 1].value.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(107, 114, 128, 0.1)" 
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                stroke="rgba(107, 114, 128, 0.3)"
                tick={{ fill: '#6b7280', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[196, 202]}
                stroke="rgba(107, 114, 128, 0.3)"
                tick={{ fill: '#6b7280', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `$${value}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00f0ff"
                strokeWidth={2}
                fill="url(#colorValue)"
                dot={false}
                activeDot={{ 
                  r: 5, 
                  fill: '#00f0ff', 
                  stroke: '#0a0a0f', 
                  strokeWidth: 2 
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </section>
  );
}
