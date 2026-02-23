import { NextResponse } from 'next/server';

// HEAD
export async function HEAD() {
    /* Health check HEAD endpoint for load balancer probes. */
    
    return new Response('ok', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}

// GET
export async function GET(request: Request) {
    /* Health check GET endpoint for load balancer health checks. */
    
    try {
        // log basic request info for debugging health checks
        console.log('health check', request.method);
        
        return new Response('ok', {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        console.error('health check error', error);
        return new Response('error', {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }
}

