interface Env { ASSETS: Fetcher }
export default {
 async fetch(request: Request,env:Env):Promise<Response>{
  if(new URL(request.url).pathname.startsWith('/api/'))return Response.json({error:'STEP 服务尚未上线：站点管理员需要开通 Cloudflare Workers Paid 并部署 CAD 容器。3MF 与 STL 本地互转已可使用。'},{status:503});
  return env.ASSETS.fetch(request);
 }
};
