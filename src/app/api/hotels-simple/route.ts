import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "hotel api route active",
    timestamp: new Date().toISOString()
  });
}
