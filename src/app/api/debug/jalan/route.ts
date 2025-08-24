import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.JALAN_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'JALAN_API_KEY not set' });
  }
  
  try {
    const searchParams = new URLSearchParams({
      key: apiKey,
      xml_ptn: '1',
      count: '10',
      start: '1',
      order: '1',
      pref: '130000', // 東京都
      l_area: '137100', // 東京23区
      s_area: '137102', // 新宿・代々木
    });

    const url = `http://jws.jalan.net/APILite/HotelSearch/V1/?${searchParams}`;
    console.log('Testing Jalan API URL:', url);
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'User-Agent': 'ShudenOut/1.0'
      }
    });

    const responseText = await response.text();
    
    return NextResponse.json({
      status: response.status,
      ok: response.ok,
      url: url,
      responsePreview: responseText.substring(0, 1000),
      fullResponse: responseText,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
