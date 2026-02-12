'use client';

import { motion } from 'framer-motion';
import { protocolRates } from '@/data/mock';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function getRiskColor(risk: string) {
  switch (risk) {
    case 'Low': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'Medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'High': return 'text-red-400 bg-red-500/10 border-red-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export default function ProtocolRates() {
  const maxAPY = Math.max(...protocolRates.map(r => r.apy));

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
            <span className="text-cyan-glow/60">◆</span>
            Protocol Rates
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Current yield rates across monitored protocols — updated every 2h
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {protocolRates.map((rate) => (
            <motion.div
              key={rate.protocol + rate.asset}
              variants={item}
              className={`
                relative rounded-xl bg-bg-card border p-4 transition-all duration-300
                ${rate.active 
                  ? 'border-cyan-glow/30 active-glow' 
                  : 'border-gray-800/50 hover:border-gray-700/80'
                }
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-sans text-sm font-medium text-gray-300">{rate.protocol}</p>
                  <p className="font-mono text-xs text-gray-500 mt-0.5">{rate.asset}</p>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${getRiskColor(rate.risk)}`}>
                  {rate.risk}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <p className={`
                  font-mono text-2xl font-bold
                  ${rate.active ? 'text-cyan-glow' : 'text-gray-200'}
                `}>
                  {rate.apy}%
                </p>
                
                {rate.active && (
                  <span className="flex items-center gap-1.5 text-xs font-mono text-cyan-glow/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow status-pulse" />
                    Active
                  </span>
                )}
              </div>

              {/* APY bar */}
              <div className="mt-3 h-1 bg-gray-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(rate.apy / maxAPY) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className={`h-full rounded-full ${
                    rate.active 
                      ? 'bg-gradient-to-r from-cyan-glow/60 to-cyan-glow' 
                      : 'bg-gradient-to-r from-gray-600/40 to-gray-500/60'
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
