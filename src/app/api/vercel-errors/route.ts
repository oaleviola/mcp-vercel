import { NextRequest, NextResponse } from 'next/server';
import { handleVercelErrorWebhook } from '../../../../mcp-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create mock response object to adapt to the existing function
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => data
      })
    };
    
    const result = await handleVercelErrorWebhook(body, mockRes);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing Vercel error webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
