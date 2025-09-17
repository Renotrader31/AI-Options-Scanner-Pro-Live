/**
 * Options Data API Route for Real-Time Option Prices
 * Uses Polygon.io paid API to fetch live option chain data
 */

import { NextResponse } from 'next/server';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS requests for CORS
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Cache for storing options data with TTL
const optionsCache = new Map();
const CACHE_TTL = 60000; // 1 minute for options (more volatile)

// API Keys
const API_KEYS = {
  POLYGON: process.env.POLYGON_API_KEY || 'demo'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const optionContractsParam = searchParams.get('contracts'); // Format: "SPY240315C00450000,AAPL240315P00180000"
    
    if (!optionContractsParam) {
      return NextResponse.json({
        success: false,
        error: 'No option contracts specified. Use ?contracts=CONTRACT1,CONTRACT2',
        example: '?contracts=SPY240315C00450000,AAPL240315P00180000'
      }, {
        status: 400,
        headers: corsHeaders
      });
    }

    const optionContracts = optionContractsParam.split(',').map(c => c.trim());
    console.log(`📊 Fetching options data for: ${optionContracts.join(', ')}`);
    
    // Check cache first
    const cacheKey = optionContracts.sort().join(',');
    const cached = optionsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log('✅ Returning cached options data');
      return NextResponse.json({
        ...cached.data,
        cached: true
      }, {
        status: 200,
        headers: corsHeaders
      });
    }
    
    // Fetch fresh options data
    const optionsData = await fetchOptionsFromPolygon(optionContracts);
    
    if (optionsData.success) {
      // Cache the successful result
      optionsCache.set(cacheKey, {
        data: optionsData,
        timestamp: Date.now()
      });
    }
    
    return NextResponse.json(optionsData, {
      status: 200,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('Options data API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch options data',
      details: error.message,
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Fetch options data from Polygon.io
async function fetchOptionsFromPolygon(optionContracts) {
  const apiKey = API_KEYS.POLYGON;
  
  // Skip if no valid API key
  if (!apiKey || apiKey === 'demo') {
    throw new Error('Polygon API key not configured for options data');
  }
  
  try {
    console.log(`🔑 Using Polygon API for options: ${apiKey.substring(0, 8)}...`);
    
    const promises = optionContracts.map(async (contract) => {
      // Polygon options snapshot endpoint
      const url = `https://api.polygon.io/v3/snapshot/options/${contract}?apiKey=${apiKey}`;
      
      console.log(`🔗 Polygon Options URL: https://api.polygon.io/v3/snapshot/options/${contract}?apikey=[HIDDEN]`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'AI-Options-Scanner-Pro/1.0'
        }
      });
      
      console.log(`📊 Polygon Options Response for ${contract}: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Polygon Options Error for ${contract}: ${errorText}`);
        
        if (response.status === 404) {
          return {
            contract: contract,
            error: 'Option contract not found or expired',
            status: 'NOT_FOUND'
          };
        }
        
        throw new Error(`Polygon Options API error for ${contract}: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`📊 Polygon Options Raw response for ${contract}:`, data);
      
      if (!data.results) {
        console.warn(`⚠️ No results for option ${contract}`);
        return {
          contract: contract,
          error: 'No option data available',
          status: 'NO_DATA'
        };
      }
      
      const optionData = data.results;
      
      // Extract option details from contract symbol (e.g., SPY240315C00450000)
      const optionDetails = parseOptionContract(contract);
      
      return {
        contract: contract,
        symbol: optionDetails.underlying,
        optionType: optionDetails.type,
        strikePrice: optionDetails.strike,
        expirationDate: optionDetails.expiration,
        
        // Current option prices
        lastPrice: optionData.last_quote?.last || optionData.market_status?.last_quote?.last || 0,
        bid: optionData.last_quote?.bid || 0,
        ask: optionData.last_quote?.ask || 0,
        midPrice: optionData.last_quote ? ((optionData.last_quote.bid + optionData.last_quote.ask) / 2) : 0,
        
        // Volume and Greeks (if available)
        volume: optionData.session?.volume || 0,
        openInterest: optionData.open_interest || 0,
        
        // Greeks (if available in paid tier)
        delta: optionData.greeks?.delta || null,
        gamma: optionData.greeks?.gamma || null,
        theta: optionData.greeks?.theta || null,
        vega: optionData.greeks?.vega || null,
        
        // Metadata
        timestamp: data.results?.updated || new Date().toISOString(),
        status: 'SUCCESS'
      };
    });
    
    const results = await Promise.all(promises);
    const successResults = results.filter(r => r.status === 'SUCCESS');
    const errorResults = results.filter(r => r.status !== 'SUCCESS');
    
    console.log(`✅ Polygon Options Success: ${successResults.length}/${results.length} contracts`);
    
    if (errorResults.length > 0) {
      console.warn(`⚠️ Some option contracts failed:`, errorResults);
    }
    
    return {
      success: true,
      data: successResults,
      errors: errorResults,
      source: 'POLYGON_OPTIONS',
      timestamp: new Date().toISOString(),
      cached: false
    };
    
  } catch (error) {
    console.error('❌ Polygon Options API failed:', error.message);
    throw error;
  }
}

// Parse option contract symbol (e.g., "SPY240315C00450000" -> {underlying: "SPY", expiration: "2024-03-15", type: "CALL", strike: 450})
function parseOptionContract(contract) {
  try {
    // Standard OCC format: SPYYYMMDDCTSSSSSSSS
    // SPY = underlying, YY = year, MM = month, DD = day, C/P = call/put, SSSSSSSS = strike * 1000
    
    const match = contract.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    
    if (!match) {
      throw new Error(`Invalid option contract format: ${contract}`);
    }
    
    const [, underlying, yy, mm, dd, type, strikeStr] = match;
    
    // Convert 2-digit year to 4-digit (assuming 20xx for now)
    const year = `20${yy}`;
    const expiration = `${year}-${mm}-${dd}`;
    
    // Strike price is in cents, divide by 1000
    const strike = parseInt(strikeStr) / 1000;
    
    return {
      underlying,
      expiration,
      type: type === 'C' ? 'CALL' : 'PUT',
      strike
    };
  } catch (error) {
    console.error(`Error parsing option contract ${contract}:`, error);
    return {
      underlying: 'UNKNOWN',
      expiration: 'UNKNOWN',
      type: 'UNKNOWN',
      strike: 0
    };
  }
}