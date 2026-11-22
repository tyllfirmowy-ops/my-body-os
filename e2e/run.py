"""Uruchom: npm run build:single && python3 e2e/run.py [nazwa_scenariusza ...]"""
import json, sys, time, traceback
from common import serve, browser, new_page
import scenarios

def main(names):
    todo = [s for s in scenarios.ALL if not names or s.__name__ in names]
    results, failed = {}, 0
    with serve() as url, browser() as b:
        for s in todo:
            ctx, pg = new_page(b, accept_downloads=True)
            t = time.time()
            try:
                obs = s(pg, url, ctx) if s.__code__.co_argcount == 3 else s(pg, url)
                if pg.errors: raise AssertionError(f'błędy JS: {pg.errors[:2]}')
                results[s.__name__] = {'status': 'PASS', 'sec': round(time.time() - t, 1), **({'obs': obs} if obs else {})}
            except Exception as e:
                failed += 1
                results[s.__name__] = {'status': 'FAIL', 'error': str(e).split('\n')[0][:300], 'where': traceback.format_exc().splitlines()[-3][:200]}
            ctx.close()
    print(json.dumps(results, ensure_ascii=False, indent=1))
    print(f'\n{len(todo) - failed}/{len(todo)} PASS')
    sys.exit(1 if failed else 0)

if __name__ == '__main__': main(sys.argv[1:])
