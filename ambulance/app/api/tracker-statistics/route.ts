import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Parse the URL and get the callback parameter
  const url = new URL(request.url)
  const callback = url.searchParams.get('__callback__')
  const data = url.searchParams.get('data')

  // Parse the data if it exists
  let parsedData = {}
  try {
    if (data) {
      parsedData = JSON.parse(decodeURIComponent(data))
    }
  } catch (error) {
    console.error('Error parsing data:', error)
  }

  // Return a JSONP response
  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    data: parsedData
  }

  // If there's a callback, wrap the response in the callback function
  if (callback) {
    return new NextResponse(`${callback}(${JSON.stringify(response)})`, {
      headers: {
        'Content-Type': 'application/javascript'
      }
    })
  }

  // Otherwise return JSON
  return NextResponse.json(response)
}
