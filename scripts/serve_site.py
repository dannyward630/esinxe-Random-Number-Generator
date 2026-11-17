"""Serve the project locally with consistent JavaScript module MIME types."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SiteHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int, nargs="?", default=8765)
    parser.add_argument("--directory", default=".")
    args = parser.parse_args()
    handler = partial(SiteHandler, directory=args.directory)
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        address = f"http://127.0.0.1:{server.server_port}/"
        print(f"Serving {args.directory} at {address}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
