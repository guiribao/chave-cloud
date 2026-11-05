# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### Arquivos enviados (storage em disco)

Todos os uploads (ex.: logo da banca) são gravados no disco do servidor, em `STORAGE_DIR`
(padrão: `./storage`, ignorado pelo git), e servidos pela rota `/arquivos/<chave>`.
No banco fica apenas a chave (caminho relativo, ex.: `logo_banca/<uuid>.png`).

Em produção, defina `STORAGE_DIR` com um caminho absoluto **fora da pasta do deploy**
(ex.: `/var/lib/chave-cloud/storage`), com permissão de escrita para o usuário do processo
e incluído na rotina de backup. Assim os arquivos sobrevivem a novos deploys.

Para aceitar um novo tipo de upload, adicione uma regra em `app/storage/upload.server.ts`.

### DIY

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`
