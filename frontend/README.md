# Frontend

- Источник правды: `frontend/`
- Dev-сервер: `npm run dev`
- Сборка: `npm run build`
- Smoke: `npm run smoke`
- Nix backend: `nix run --impure .#backend`
- Nix dev: `nix run --impure .#dev`
- Nix smoke: `nix run --impure .#smoke`

Бэкенд раздаёт `frontend/index.html` и `frontend/dist/*`.

Smoke стартует с `#/book/<book>` и пишет артефакты в `artifacts/ui-smoke/`.

Для ручной проверки:

```bash
cd frontend
npm run dev
```
