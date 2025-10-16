import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Environment variables check
    const hasRakutenKey = !!process.env.NEXT_PUBLIC_RAKUTEN_APP_ID;
    const hasBaseUrl = !!process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL;
    
    // Basic API connectivity test
    let apiStatus = 'unknown';
    try {
      const testResponse = await fetch('/api/test', { 
        method: 'GET',
        headers: { 'User-Agent': 'Health-Check/1.0' }
      });
      apiStatus = testResponse.ok ? 'healthy' : 'degraded';
    } catch {
      apiStatus = 'unhealthy';
    }
    
    const responseTime = Date.now() - startTime;
    const status = hasRakutenKey && hasBaseUrl ? 'healthy' : 'degraded';
    
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: {
        node_env: process.env.NODE_ENV,
        vercel_env: process.env.VERCEL_ENV || 'local'
      },
      checks: {
        environment_variables: hasRakutenKey && hasBaseUrl,
        api_connectivity: apiStatus,
        response_time_ms: responseTime
      },
      uptime: process.uptime ? Math.floor(process.uptime()) : 0
    }, { 
      status: status === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      response_time_ms: Date.now() - startTime
    }, { status: 503 });
  }
}
