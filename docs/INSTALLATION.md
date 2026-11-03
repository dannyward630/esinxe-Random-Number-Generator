# Install and verify esinxe

The repository is the source of truth. These instructions build the current
checkout and do not assume that a package with this name/version on a registry
contains these changes. Runtime dependencies are not required.

## Python

From the repository root:

```sh
python -m pip install .
python -c "import esinxe; print(esinxe.Random(42).scope('world').raw('tile'))"
```

The optional C extension is built when a supported compiler is available. The
Python fallback has identical results. Build a distributable wheel with
`python -m pip install build` followed by `python -m build --wheel`, then install
the wheel from `dist/` using pip. Python 3.9 or newer is required. Generic stubs
and `py.typed` are included.

```python
import esinxe
world = esinxe.Random(42).scope("world")
tiles = world.rawBatch([("height", esinxe.i64(x)) for x in range(-16, 16)])
ids = ["forest", "desert", "tundra"]
biome = world.stableChoice(ids, ids, "region", esinxe.i64(-1))
```

## JavaScript / TypeScript

From the repository root, run `npm pack ./JavaScript --pack-destination .`.
In your application, install the resulting tarball using
`npm install /absolute/path/to/esinxe-1.1.0.tgz`. The ESM package includes TypeScript
declarations and supports Node 18+. Browser projects can import
`JavaScript/src/index.js` directly or use their normal bundler.

```javascript
import { Random, i64 } from "esinxe";
const world = new Random(42n).scope("world");
const ids = ["forest", "desert", "tundra"];
const biome = world.stableChoice(ids, ids, "region", i64(-1));
```

## Verified artifacts and integration

The [CI workflow](https://github.com/dannyward630/esinxe-Random-Number-Generator/actions/workflows/ci.yml)
uploads an `esinxe-packages` artifact containing a Linux wheel, source archive,
npm tarball, and SHA-256 manifest. Download an artifact from a successful run on
the commit you intend to use. Python wheels are platform/interpreter-specific;
use the source archive or build locally when the wheel tag does not match.

CI installs a wheel and npm tarball into temporary consumers outside the checkout
and checks runtime behavior plus generic typing. To reproduce those checks,
install `requirements-dev.txt`, run `npm ci --prefix JavaScript`, then run
`python scripts/check_python_package.py` and
`python scripts/check_javascript_package.py`.

[Verdant](../examples/world/README.md) is a dependency-free browser integration.
Its reusable generator and worker protocol demonstrate streamed chunks, stable
IDs, and optional decoration without changing core content. Its terrain smoothing
is application code. See the [measured backend comparison](../research/PRACTICAL_VALUE_BENCHMARK.md)
for where batching helps and why the experimental Philox mapping remains research.
