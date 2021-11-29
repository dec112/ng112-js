module.exports = {
  entryPoints: ["src/index.ts"],
  out: './docs',
  excludeExternals: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeInternal: true,
  includeVersion: true,
}