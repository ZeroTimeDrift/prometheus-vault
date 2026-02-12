'use client';

import { motion } from 'framer-motion';
import { oodaSteps } from '@/data/mock';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 },
};

export default function OODALoop() {
  return (
    <section className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-sans font-semibold text-gray-200 flex items-center gap-2">
          <span className="text-cyan-glow/60">◆</span>
          OODA Decision Loop
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Continuous observe → orient → decide → act cycle every 2 hours
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {oodaSteps.map((step, i) => (
          <motion.div key={step.id} variants={item} className="relative">
            {/* Connector line (hidden on first card and on mobile) */}
            {i > 0 && (
              <div className="hidden lg:block absolute -left-4 top-1/2 w-4 h-px bg-gradient-to-r from-cyan-glow/10 to-cyan-glow/30" />
            )}
            
            <div className={`
              relative rounded-xl bg-bg-card border p-5 h-full
              transition-all duration-500
              ${step.active 
                ? 'ooda-active border-cyan-glow/40' 
                : 'border-gray-800/50 hover:border-gray-700/80'
              }
            `}>
              {/* Step number */}
              <div className="flex items-center justify-between mb-3">
                <span className={`
                  text-2xl
                `}>
                  {step.icon}
                </span>
                <span className={`
                  text-xs font-mono px-2 py-1 rounded-full
                  ${step.active 
                    ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/30' 
                    : 'bg-gray-800/50 text-gray-500 border border-gray-700/30'
                  }
                `}>
                  {i + 1}/4
                </span>
              </div>
              
              <h3 className={`
                font-mono font-bold text-lg mb-2 tracking-wide
                ${step.active ? 'text-cyan-glow' : 'text-gray-300'}
              `}>
                {step.label}
              </h3>
              
              <p className="text-sm text-gray-500 leading-relaxed">
                {step.description}
              </p>

              {step.active && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center gap-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow status-pulse" />
                  <span className="text-xs font-mono text-cyan-glow/80">Active</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
