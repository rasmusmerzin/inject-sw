# @merzin/inject-sw

This is a simple tool to inject a service worker into your bundled website.
This package is for when you don't need fine control over your service worker
but just offline support for your web app. It is intended to be used as a
post-build step in your build pipeline.

Example usage:

```bash
npx @merzin/inject-sw dist
```

Where `dist` is the directory where your website is built and contains an
`index.html` file.

> Note: This package does not generate
> [web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest).
> For your web app to be installable, you need to generate a manifest file and
> include it in your `index.html`.

To use with Vite, add the following to your `package.json`:

```json
{
  "scripts": {
    "build": "vite build && inject-sw dist"
    ...
  }
  "devDependencies": {
    "@merzin/inject-sw": "1"
    ...
  }
}
```

## Base Path

When deploying to a subroute, e.g. GitHub Pages, you should specify the base
path in the `inject-sw` command:

```bash
npx @merzin/inject-sw dist --base /my-app
```

Where `/my-app` is the base path of your website (repository name for GitHub
Pages).

## Ignoring Files

To exclude files from service worker install, add `--ignore` flag. This is
needed for example for Netlify's `_redirects` and `_headers` files which aren't
public and would result in service worker installation failure.

```bash
npx @merzin/inject-sw dist --ignore _redirects,_headers
```
