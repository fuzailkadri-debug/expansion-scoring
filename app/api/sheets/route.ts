// Proxy Google Sheets published CSV to avoid CORS issues
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return Response.json({ error: 'url param required' }, { status: 400 });

  // Only allow Google Sheets URLs
  if (!url.includes('docs.google.com/spreadsheets')) {
    return Response.json({ error: 'Only Google Sheets URLs are allowed' }, { status: 400 });
  }

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csv = await res.text();
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
