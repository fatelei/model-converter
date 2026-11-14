from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import os,json,uuid,time,threading,subprocess,sys,shutil
ROOT=Path(os.environ.get('JOB_ROOT','/private/tmp/model-converter-jobs'));ROOT.mkdir(exist_ok=True)
LOCK=threading.Lock();SLOTS=threading.BoundedSemaphore(1);MAX=50*1024**2

def run(job):
    try:
        try:
            with (job/'log.txt').open('w') as log:
                subprocess.run([sys.executable,str(Path(__file__).with_name('convert.py')),str(job)],stdout=log,stderr=log,timeout=480,check=False)
            if not (job/'done.json').exists(): (job/'done.json').write_text(json.dumps({'status':'error','error':'转换进程失败，模型可能过于复杂'}))
        except subprocess.TimeoutExpired: (job/'done.json').write_text(json.dumps({'status':'error','error':'转换超过 8 分钟，请简化模型'}))
    finally: SLOTS.release()

def cleanup():
    while True:
        time.sleep(60)
        with LOCK:
            for d in ROOT.iterdir():
                if d.is_dir() and time.time()-d.stat().st_mtime>3600: shutil.rmtree(d,ignore_errors=True)

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,data):
        body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
    def do_POST(self):
        if urlparse(self.path).path!='/api/jobs': return self.reply(404,{'error':'未找到'})
        q=parse_qs(urlparse(self.path).query)
        try:
            cfg={k:q[k][0] for k in ('source','target','unit')};cfg['tolerance']=float(q.get('tolerance',['0.1'])[0]);size=int(self.headers.get('Content-Length','0'))
            if cfg['source'] not in ('3mf','stl','step') or cfg['target'] not in ('3mf','stl','step') or cfg['source']==cfg['target']: raise ValueError()
            if cfg['unit'] not in ('millimeter','centimeter','meter','inch') or cfg['tolerance'] not in (.05,.1,.3): raise ValueError()
            if size<=0 or size>MAX: return self.reply(413,{'error':'文件须小于 50 MB，且不能为空'})
        except (KeyError,ValueError): return self.reply(400,{'error':'转换参数无效'})
        if not SLOTS.acquire(False): return self.reply(429,{'error':'转换服务正在处理另一项任务，请稍后重试'})
        job=ROOT/uuid.uuid4().hex
        try:
            job.mkdir(); self.connection.settimeout(60)
            with (job/'input').open('wb') as f:
                left=size
                while left:
                    data=self.rfile.read(min(left,1024*1024))
                    if not data: raise ValueError('上传中断')
                    f.write(data);left-=len(data)
            (job/'request.json').write_text(json.dumps(cfg));threading.Thread(target=run,args=(job,),daemon=True).start()
        except Exception:
            SLOTS.release();shutil.rmtree(job,ignore_errors=True);return self.reply(400,{'error':'文件上传失败'})
        self.reply(202,{'id':job.name,'status':'processing'})
    def do_GET(self):
        import re
        path=urlparse(self.path).path
        if path=='/health': return self.reply(200,{'ok':True})
        match=re.fullmatch(r'/api/jobs/([a-f0-9]{32})(/download)?',path)
        if not match: return self.reply(404,{'error':'未找到'})
        job=ROOT/match[1]
        with LOCK:
            if not job.exists(): return self.reply(404,{'error':'任务已过期或服务已重启，请重新转换'})
            state=json.loads((job/'done.json').read_text()) if (job/'done.json').exists() else {'status':'processing'}
            if not match[2]: return self.reply(200,state)
            if state['status']!='done': return self.reply(409,{'error':'转换尚未完成'})
            cfg=json.loads((job/'request.json').read_text());result=job/('result.'+cfg['target'])
            self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(result.stat().st_size));self.send_header('Content-Disposition','attachment; filename="converted.'+cfg['target']+'"');self.send_header('Cache-Control','no-store');self.end_headers()
            with result.open('rb') as f: shutil.copyfileobj(f,self.wfile)
    def log_message(self,fmt,*args): pass

if __name__=='__main__':
    threading.Thread(target=cleanup,daemon=True).start()
    ThreadingHTTPServer((os.environ.get('HOST','127.0.0.1'),int(os.environ.get('PORT','8080'))),Handler).serve_forever()
