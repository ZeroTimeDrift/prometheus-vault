'use client';

import { motion } from 'framer-motion';
import { portfolioStats } from '@/data/mock';

const cards = [
  {
    label: 'Total Value',
    value: `$${portfolioStats.totalValue.toFixed(2)}`,
    subtext: `${portfolioStats.solBalance} SOL reserve`,
    accent: 'cyan',
    large: true,
  },
  {
    label: 'Current APY',
    value: `${portfolioStats.currentAPY}%`,
    subtext: 'pSOL/SOL Multiply',
    accent: 'amber',
    large: false,
  },
  {
    label: 'Active Strategy',
    value: portfolioStats.activeStrategy,
    subtext: 'Kamino Multiply',
    accent: 'cyan',
    large: false,
  },
  {
    label: 'Transactions',
    value: `${portfolioStats.totalTransactions}`,
    subtext: `${portfolioStats.successfulTransactions} successful · ${portfolioStats.totalTransactions - portfolioStats.successfulTransactions} failed`,
    accent: 'cyan',
    large: false,
  },
  {
    label: 'Days Active',
    value: `${portfolioStats.daysActive}`,
    subtext: 'Since Feb 2, 2025',
    accent: 'cyan',
    large: false,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function PortfolioCards() {
  return (
    <section className="px-6 py-8">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            variants={item}
            className={`
              relative rounded-xl bg-bg-card border border-gray-800/50 p-5 
              hover:border-gray-700/80 transition-all duration-300
              ${i === 0 ? 'col-span-2 md:col-span-1 border-glow' : ''}
            `}
          >
            <p className="text-xs uppercase tracking-wider text-gray-500 font-sans mb-2">
              {card.label}
            </p>
            <p className={`
              font-mono font-bold mb-1 
              ${card.large ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'}
              ${card.accent === 'amber' ? 'gradient-text-amber' : 'text-gray-100'}
            `}>
              {card.value}
            </p>
            <p className="text-xs text-gray-500 font-sans">
              {card.subtext}
            </p>
            
            {/* Subtle top accent line */}
            <div className={`absolute top-0 left-4 right-4 h-px ${
              card.accent === 'amber' 
                ? 'bg-gradient-to-r from-transparent via-amber-glow/40 to-transparent' 
                : 'bg-gradient-to-r from-transparent via-cyan-glow/20 to-transparent'
            }`} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
