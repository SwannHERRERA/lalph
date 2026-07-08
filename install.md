pi --session 019f1e8e-42cf-7acc-9e39-375b3dfef521

From this repo, replace your global pnpm-installed lalph with the local checkout by linking it globally:

```sh
  cd /Users/swannherrera/repos/github.com/tim-smart/lalph

  pnpm install
  pnpm build
  pnpm link --global

  hash -r
  which lalph
  lalph --version
```

Your lalph should resolve to the pnpm global shim, but that shim will point at this local repo’s dist/cli.mjs.

For ongoing local development, after edits run:

```sh
  pnpm build
```

No need to link again.

If you prefer a copied install instead of a symlink:

```sh
  cd /Users/swannherrera/repos/github.com/tim-smart/lalph
  pnpm install
  pnpm build
  pnpm add -g "file:$PWD"
```

To go back to the published package later:

```sh
  pnpm remove -g lalph
  pnpm add -g lalph
```
