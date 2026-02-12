import HeroHeader from '@/components/HeroHeader';
import PortfolioCards from '@/components/PortfolioCards';
import OODALoop from '@/components/OODALoop';
import PerformanceChart from '@/components/PerformanceChart';
import DecisionsLog from '@/components/DecisionsLog';
import ProtocolRates from '@/components/ProtocolRates';
import RiskParameters from '@/components/RiskParameters';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary relative scanline grid-bg">
      <div className="relative z-10 max-w-7xl mx-auto">
        <HeroHeader />
        <PortfolioCards />
        
        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-gray-800/50 to-transparent" />
        
        <OODALoop />
        
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-gray-800/50 to-transparent" />
        
        <PerformanceChart />
        
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-gray-800/50 to-transparent" />
        
        <DecisionsLog />
        
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-gray-800/50 to-transparent" />
        
        {/* Two column layout for rates + risk */}
        <div className="lg:grid lg:grid-cols-2">
          <ProtocolRates />
          <RiskParameters />
        </div>
        
        <Footer />
      </div>
    </main>
  );
}
