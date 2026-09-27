// Paths that only vulnerability scanners ask for. The proxy answers them with a
// bare 404 before anything else runs (docs/plan/admin-cms-adr.md, section 4.5,
// responsibility 1). This site has no PHP, WordPress or dotfiles to serve.

const BLOCKED: readonly RegExp[] = [
  /^\/\.(env|git|svn|hg|aws|ssh|htaccess|htpasswd|npmrc|ds_store)/i,
  /\/\.(env|git|svn)(\/|$|\.)/i,
  /\.php\d?$/i,
  /\/(wp-admin|wp-login|wp-content|wp-includes|wp-json|wordpress|xmlrpc|wlwmanifest)/i,
  /\/(phpmyadmin|phpinfo|pma|adminer|cgi-bin|server-status|actuator|vendor\/phpunit)(\/|$|\.)/i,
  /\/(backup|dump|database)\.(sql|zip|tar|gz|bak)$/i,
];

export function isScannerPath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // An undecodable path is checked as written.
  }
  return BLOCKED.some((pattern) => pattern.test(pathname) || pattern.test(decoded));
}
