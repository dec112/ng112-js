module.exports = {
  entryPoints: ["src/index.ts"],
  out: './docs',
  excludeExternals: false,
  excludePrivate: true,
  excludeProtected: true,
  excludeInternal: true,
  includeVersion: true,
}