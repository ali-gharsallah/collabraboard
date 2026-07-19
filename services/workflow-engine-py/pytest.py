"""Mini-runner compatible pytest (fixtures + raises) — environnement hors ligne.
Les tests restent 100% compatibles avec le vrai pytest en CI."""
import inspect, traceback
from contextlib import contextmanager

def fixture(fn):
    fn._is_fixture = True
    return fn

@contextmanager
def raises(exc_type):
    class Info: value = None
    info = Info()
    try:
        yield info
    except exc_type as e:
        info.value = e
    else:
        raise AssertionError(f"{exc_type.__name__} attendu, rien levé")

def _resolve(name, fixtures, cache):
    if name in cache: return cache[name]
    fn = fixtures[name]
    args = [_resolve(p, fixtures, cache) for p in inspect.signature(fn).parameters]
    cache[name] = fn(*args)
    return cache[name]

def main(module):
    # Fixtures scopées au module : pas de registre global partagé
    fixtures = {n: f for n, f in vars(module).items()
                if callable(f) and getattr(f, "_is_fixture", False)}
    tests = [(n, f) for n, f in vars(module).items()
             if n.startswith("test_") and callable(f)]
    passed, failed = 0, []
    for name, fn in tests:
        cache = {}
        try:
            args = [_resolve(p, fixtures, cache)
                    for p in inspect.signature(fn).parameters]
            fn(*args)
            print(f"  PASS  {name}")
            passed += 1
        except Exception:
            print(f"  FAIL  {name}")
            failed.append((name, traceback.format_exc()))
    print(f"\n{passed} passés, {len(failed)} échoués / {len(tests)}")
    for n, tb in failed:
        print(f"\n--- {n} ---\n{tb}")
    return 1 if failed else 0
