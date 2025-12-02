import { NextRequest, NextResponse } from 'next/server';

const EC2_API_BASE = 'http://3.239.173.255';

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: pathArray } = await params;
    const path = pathArray.join('/');
    const url = `${EC2_API_BASE}/${path}`;
    const searchParams = request.nextUrl.searchParams.toString();
    const finalUrl = searchParams ? `${url}?${searchParams}` : url;

    console.log(`Proxying ${request.method} request to: ${finalUrl}`);

    try {
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('connection');

        const body = request.method !== 'GET' && request.method !== 'HEAD'
            ? await request.blob()
            : undefined;

        const response = await fetch(finalUrl, {
            method: request.method,
            headers: headers,
            body: body,
            // @ts-ignore
            duplex: 'half'
        });

        const responseBody = await response.blob();

        return new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to proxy request', details: String(error) },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest, ctx: any) { return proxyRequest(request, ctx); }
export async function POST(request: NextRequest, ctx: any) { return proxyRequest(request, ctx); }
export async function PUT(request: NextRequest, ctx: any) { return proxyRequest(request, ctx); }
export async function DELETE(request: NextRequest, ctx: any) { return proxyRequest(request, ctx); }
export async function PATCH(request: NextRequest, ctx: any) { return proxyRequest(request, ctx); }
