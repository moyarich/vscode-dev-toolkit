# Development

Run from the repository root:

```sh
npm install
npm test
npm run check
npm run pack:toolkit
```

`packages/vscode-dev-toolkit` owns published exports and runtime code; the root is private and only orchestrates workspaces. Keep consumer configuration and demo scenarios in the consuming extension repository.

The `npm pack --workspace @moyarich/vscode-dev-toolkit` command builds the package tarball from its workspace manifest and ensures the `src/` exports and accompanying static overlay assets are included.

## Migration

The former package manifest lived at the repository root. A Git-based install using `github:moyarich/vscode-dev-toolkit` resolves the repository root, which is now private and no longer represents the publishable toolkit. Consumers should migrate to a published version of `@moyarich/vscode-dev-toolkit` from a registry, or a versioned package tarball. Do not assume npm supports a Git URL pointing to a workspace subdirectory.
