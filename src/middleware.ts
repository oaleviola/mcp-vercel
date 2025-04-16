import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware logic can be added here if needed
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: ['/api/:path*'],
};
