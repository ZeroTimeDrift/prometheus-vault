'use client';

import { motion } from 'framer-motion';
import { decisions } from '@/data/mock';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export default function DecisionsLog() {
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
            Recent Decisions
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Agent decision log — each entry is an autonomous OODA cycle
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-xl bg-bg-card border border-gray-800/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-800/50 text-xs uppercase tracking-wider text-gray-500 font-sans">
            <div className="col-span-2">Time</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-5">Reasoning</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Tx</div>
          </div>

          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {decisions.map((d, i) => (
              <motion.div
                key={i}
                variants={item}
                className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-gray-800/30 last:border-0 hover:bg-bg-hover/50 transition-colors"
              >
                <div className="col-span-2 font-mono text-xs text-gray-400">
                  {d.time}
                </div>
                <div className="col-span-2 font-mono text-sm text-gray-200 font-medium">
                  {d.action}
                </div>
                <div className="col-span-5 text-sm text-gray-400 leading-relaxed">
                  {d.reasoning}
                </div>
                <div className="col-span-1">
                  <span className={`
                    inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full
                    ${d.status === 'success' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }
                  `}>
                    {d.status === 'success' ? '✓' : '✗'}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  {d.txHash ? (
                    <a
                      href={`https://solscan.io/tx/${d.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-cyan-glow/60 hover:text-cyan-glow transition-colors"
                    >
                      {d.txHash}
                      <span className="ml-1">↗</span>
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-gray-600">—</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Mobile cards */}
        <motion.div 
          variants={container} 
          initial="hidden" 
          whileInView="show" 
          viewport={{ once: true }}
          className="md:hidden space-y-3"
        >
          {decisions.map((d, i) => (
            <motion.div
              key={i}
              variants={item}
              className="rounded-xl bg-bg-card border border-gray-800/50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-gray-500">{d.time}</span>
                <span className={`
                  text-xs font-mono px-2 py-1 rounded-full
                  ${d.status === 'success' 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }
                `}>
                  {d.status === 'success' ? '✓ OK' : '✗ Fail'}
                </span>
              </div>
              <p className="font-mono text-sm text-gray-200 font-medium mb-1">{d.action}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{d.reasoning}</p>
              {d.txHash && (
                <a
                  href={`https://solscan.io/tx/${d.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 font-mono text-xs text-cyan-glow/60 hover:text-cyan-glow transition-colors"
                >
                  {d.txHash} ↗
                </a>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
