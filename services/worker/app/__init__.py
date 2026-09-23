import os
import sys

_repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_api_dir = os.path.join(_repo_root, "services", "api")
_api_app = os.path.join(_api_dir, "app")

if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)
if _api_dir not in sys.path:
    sys.path.insert(0, _api_dir)

if os.path.isdir(_api_app) and _api_app not in __path__:
    __path__.append(_api_app)
