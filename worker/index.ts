import { Container, getContainer } from '@cloudflare/containers';
export class CadContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = false;
}
interface Env { CAD: DurableObjectNamespace<CadContainer>; ASSETS: Fetcher; ACCESS_KEY: string }
export default {
 async fetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!env.ACCESS_KEY) return Response.json({error:'服务尚未配置访问口令'}, {status:503});
  const supplied = request.headers.get('Authorization') || '';
  const digest = async (v:string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  const [a,b] = await Promise.all([digest(supplied),digest(`Bearer ${env.ACCESS_KEY}`)]);
  if (a.reduce((n,v,i)=>n|(v^b[i]),0)) return Response.json({error:'访问口令不正确'}, {status:401});
  if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return new Response('Forbidden',{status:403});
  const valid = (url.pathname === '/api/jobs' && request.method === 'POST') || (/^\/api\/jobs\/[a-f0-9]{32}(\/download)?$/.test(url.pathname) && request.method === 'GET');
  if (!valid) return new Response('Not found',{status:404});
  if (Number(request.headers.get('Content-Length')) > 50*1024*1024) return Response.json({error:'文件最大 50 MB'}, {status:413});
  const headers = new Headers(request.headers); headers.delete('Authorization');
  try {
   const res = await getContainer(env.CAD,'cad-v1').fetch(new Request(request,{headers}));
   const output = new Response(res.body,res); output.headers.set('Cache-Control','no-store'); return output;
  } catch { return Response.json({error:'转换服务暂不可用，请稍后重试'}, {status:503}); }
 }
};
