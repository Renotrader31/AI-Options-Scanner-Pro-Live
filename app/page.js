/**
 * Ultimate Scanner Pro AI - Enhanced Trading Interface
 * 
 * Fixed analyze button issue and added comprehensive options strategies
 * including jade lizard, iron condors, butterfly spreads, and more.
 * 
 * LATEST: P&L Calculation Bug Fixed - v2.1.1 (2025-09-17)
 */

'use client';

import { useState, useEffect } from 'react';

export default function UltimateScanner() {
  // State management
  const [activeTab, setActiveTab] = useState('ai-picks');
  const [liveData, setLiveData] = useState(null);
  const [trades, setTrades] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [enhancedStrategies, setEnhancedStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [portfolioView, setPortfolioView] = useState('active'); // 'active', 'closed', 'all'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'pnl', 'symbol'

  // Fix hydration issue
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Trade form state
  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    assetType: 'STOCK',
    type: 'BUY',
    strategyType: 'SINGLE', // SINGLE, SPREAD, STRADDLE, STRANGLE, IRON_CONDOR, etc.
    quantity: '',
    price: '',
    stopLoss: '',
    takeProfit: '',
    notes: '',
    // Single option fields
    optionType: 'CALL',
    strikePrice: '',
    expirationDate: '',
    premium: '',
    // Multi-leg fields
    legs: [
      {
        action: 'BUY', // BUY or SELL
        optionType: 'CALL',
        strikePrice: '',
        expirationDate: '',
        premium: '',
        quantity: ''
      }
    ]
  });
