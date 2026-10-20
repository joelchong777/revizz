import { GET } from './app/api/ingest/staged-paper/route';
import { NextRequest } from 'next/server';

async function main() {
  const req = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
  const res = await GET(req);
  const data = await res.json();
  console.log('Staged papers in list:');
  for (const p of data.stagedPapers || []) {
    console.log(`- ${p.id} (${p.paper?.series}${p.paper?.year} p${p.paper?.paper_code}) [${p.lifecycle_state}]`);
  }

  const singleReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=0455_s24_12');
  const singleRes = await GET(singleReq);
  console.log('Single GET 0455_s24_12 status:', singleRes.status);
}
main();
