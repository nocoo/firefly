import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const block = workflow.match(/ {8}python3 - <<'PY'\n([\s\S]*?)\n {8}PY/);
if (!block?.[1]) throw new Error("Private deployment verifier not found");
const verifier = block[1].split("\n").map((line) => line.slice(8)).join("\n");

const fixture = `
import io, json, os, subprocess, sys, time, urllib.error, urllib.request
scenario = sys.argv[1]
source = 'a' * 40
digest = 'sha256:' + 'b' * 64
reference = 'ghcr.io/nocoo/firefly@' + digest
os.environ['IMAGE_SHA'] = source
os.environ['RELEASE_IMAGES'] = json.dumps([{'service':'web', 'image':'ghcr.io/nocoo/firefly', 'sourceSha':source, 'digest':digest}])
image = {'Id':'image-id', 'RepoDigests':[reference], 'Config':{'Labels':{'org.opencontainers.image.revision':source}}}
container = {'Image':'image-id', 'Config':{'Image':reference}}
if scenario == 'digest': container['Config']['Image'] = 'wrong'
if scenario == 'revision': image['Config']['Labels']['org.opencontainers.image.revision'] = 'c' * 40
def command(args, **kwargs):
    if args[:3] == ['docker','image','inspect']: return json.dumps([image])
    if args[:2] == ['docker','inspect']: return json.dumps([container])
    if args[:2] == ['docker','exec']: return '2.17.1'
    raise AssertionError('Unexpected command')
subprocess.check_output = command
time.sleep = lambda seconds: None
class Response:
    def __init__(self, status, headers, body): self.status, self.headers, self.body = status, headers, body
    def read(self): return self.body
class Opener:
    def __init__(self, handler): self.handler = handler
    def open(self, req, **kwargs):
        assert req.get_header('Host') == 'lizheng.blog'
        assert req.get_header('X-forwarded-proto') == 'https'
        path = req.full_url.removeprefix('http://127.0.0.1:17028')
        if path == '/api/live':
            if scenario == 'timeout': raise TimeoutError('fixture timeout')
            if scenario == 'redirect':
                assert self.handler.redirect_request(req, None, 302, 'redirect', {}, 'https://lizheng.blog/api/live') is None
                raise urllib.error.HTTPError(req.full_url, 302, 'redirect', {}, io.BytesIO(b''))
            data = {'status':'ok', 'component':'firefly', 'version':'2.17.1', 'database':{'connected':True}}
            if scenario == 'version': data['version'] = '0.0.0'
            if scenario == 'database': data['database']['connected'] = False
            body = b'not-json' if scenario == 'json' else json.dumps(data).encode()
            return Response(200, {'Cache-Control':'max-age=60' if scenario == 'cache' else 'no-store'}, body)
        if path == '/': return Response(200, {'Content-Type':'text/html'}, b'<html>fixture</html>')
        if path == '/logo-80.png': return Response(200, {'Content-Type':'image/png'}, b'png')
        if path == '/api/posts?page_size=1': return Response(200, {}, b'{}')
        if path == '/api/admin/authors': return Response(200 if scenario == 'admin' else 401, {}, b'{}')
        if path == '/api/posts' and req.method == 'POST': return Response(201 if scenario == 'write' else 401, {}, b'{}')
        raise AssertionError('Unexpected request')
urllib.request.build_opener = lambda handler: Opener(handler)
exec(compile(sys.stdin.read(), 'private-deployment-verifier', 'exec'))
`;

describe("private deployment verifier behavior", () => {
  it.each(["valid", "digest", "revision", "redirect", "json", "timeout", "version", "database", "cache", "admin", "write"])(
    "fails closed for %s unless all private-origin checks pass",
    (scenario) => {
      const result = spawnSync("python3", ["-c", fixture, scenario], { input: verifier, encoding: "utf8", timeout: 10_000 });
      expect(result.error).toBeUndefined();
      if (scenario === "valid") {
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Private Firefly acceptance passed");
      } else {
        expect(result.status).not.toBe(0);
        expect(result.stdout).not.toContain("Private Firefly acceptance passed");
      }
    },
  );
});
