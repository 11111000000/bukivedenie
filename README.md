**Start Here**

1. Install frontend deps: `make frontend-install`
2. Start development: `make dev-rollup`
3. Open the app at `http://127.0.0.1:5173`
4. Build for checks or release: `make frontend-build`

**Where to edit**

- UI code: `frontend/src/`
- Entry and routing: `frontend/src/main.js`, `frontend/src/router.js`
- API layer: `frontend/src/api.js`
- Backend API: `src/webapp.py`

**Helpful commands**

- `make ui-smoke` - run the browser smoke check and write artifacts to `artifacts/ui-smoke/`
- `python -m src.webapp --host 127.0.0.1 --port 8000` - start only the backend

The canonical UI lives in `frontend/`.
The backend serves `frontend/index.html` and `frontend/dist/*`.
