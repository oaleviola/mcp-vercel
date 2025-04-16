import { NextRequest, NextResponse } from 'next/server';
import { processCorrections } from '../../../../mcp-auto-fixer';

export async function POST(request: NextRequest) {
  try {
    const { aiSuggestions, deploymentData } = await request.json();
    
    // Validate received data
    if (!aiSuggestions || !deploymentData) {
      return NextResponse.json(
        { error: 'Invalid data. aiSuggestions and deploymentData required' },
        { status: 400 }
      );
    }
    
    // Process the suggested corrections
    const result = await processCorrections(aiSuggestions, deploymentData);
    
    // TypeScript type assertion to access success property
    const typedResult = result as { success: boolean };
    
    // Return the result
    return NextResponse.json(result, { 
      status: typedResult.success ? 200 : 500 
    });
  } catch (error: any) {
    console.error('Error applying corrections:', error);
    return NextResponse.json(
      { error: 'Internal error applying corrections', message: error.message },
      { status: 500 }
    );
  }
}
