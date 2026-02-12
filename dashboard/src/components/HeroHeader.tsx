'use client';

import { motion } from 'framer-motion';
import { WALLET_ADDRESS } from '@/data/mock';

export default function HeroHeader() {
  const shortAddress = `${WALLET_ADDRESS.slice(0, 4)}...${WALLET_ADDRESS.slice(-4)}`;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-glow/5 to-transparent pointer-events-none" />
      
      <div className="relative px-6 py-12 md:py-16 text-center">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="font-mono text-4xl md:text-6xl font-bold tracking-wider mb-3">
            <span className="gradient-text">PROMETHEUS</span>
            <span className="text-gray-400 ml-3">VAULT</span>
          </h1>
          
          <p className="text-gray-500 text-sm md:text-base font-sans tracking-wide mb-6">
            Autonomous DeFi Yield Optimizer on Solana
          </p>
        </motion.div>

        {/* Status + Wallet */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8"
        >
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-card border border-green-500/20">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 status-pulse" />
            </div>
            <span className="text-green-400 text-sm font-mono font-medium">RUNNING</span>
          </div>

          {/* Wallet address */}
          <a
            href={`https://solscan.io/account/${WALLET_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-card border border-gray-700/50 hover:border-cyan-glow/30 transition-colors group"
          >
            <svg className="w-4 h-4 text-gray-500 group-hover:text-cyan-glow transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="font-mono text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
              {shortAddress}
            </span>
            <svg className="w-3 h-3 text-gray-600 group-hover:text-cyan-glow transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Bottom border line */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-glow/20 to-transparent" />
    </motion.header>
  );
}
