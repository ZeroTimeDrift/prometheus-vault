'use client';

import { motion } from 'framer-motion';
import { riskParameters } from '@/data/mock';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function RiskParameters() {
  return (
    <section className="px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-6">
          <h2 className="text-lg font-sans font-semibold text-gray-200 flex items-center gap-2">
            <span className="text-amber-glow/60">◆</span>
            Risk Parameters
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Hard-coded safety constraints — the agent cannot override these
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {riskParameters.map((param) => (
            <motion.div
              key={param.label}
              variants={item}
              className="rounded-xl bg-bg-card border border-gray-800/50 p-4 hover:border-amber-glow/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-sans text-gray-400">{param.label}</p>
                <div className="w-2 h-2 rounded-full bg-amber-glow/40" />
              </div>
              <p className="font-mono text-xl font-bold text-gray-100 mb-1">
                {param.value}
              </p>
              <p className="text-xs text-gray-500">
                {param.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
