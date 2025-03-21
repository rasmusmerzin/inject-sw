import { program } from "commander";
import { PathLike } from "fs";
import { readdir, readFile, writeFile } from "fs/promises";

export const main = (args: string[]) =>
  program
    .version("1.0.0")
    .description("Inject service worker into static website")
    .option(
      "-b, --base <base>",
      "base path for imports and service worker scope",
      "/",
    )
    .option(
      "-i, --ignore <files>",
      "comma separated relative file paths to be ignored",
    )
    .argument(
      "[directory]",
      "path to website directory containing index.html",
      ".",
    )
    .action(async (directory, opts) => {
      if (!directory.endsWith("/")) directory = directory + "/";
      const ignore = opts.ignore ? opts.ignore.split(",") : [];
      let base = opts.base;
      if (!base.endsWith("/")) base = base + "/";
      if (!base.startsWith("/")) {
        console.error("error: base path must start with /");
        process.exit(1);
      }
      try {
        await injectTag(directory, base);
        await createRegistrationScript(directory, base);
        await createServiceWorkerScript(directory, ignore, base);
      } catch (error: any) {
        console.error("error: " + error.message);
        process.exit(1);
      }
    })
    .parse(args);

async function injectTag(root: PathLike = "./", base = "/") {
  const tag = `<script src="${base}register-sw.js"></script>`;
  let index;
  try {
    index = await readFile(`${root}index.html`, "utf8");
  } catch (error) {
    throw new Error(`failed to read ${root}index.html`);
  }
  if (index.includes(tag)) return;
  const head = index.indexOf("</head>");
  if (head === -1) throw new Error("could not finding </head> tag");
  let injected;
  if (index.slice(head - 1, head) === "\n")
    injected = index.slice(0, head) + tag + "\n" + index.slice(head);
  else if (index.slice(head - 2, head) === "\n\t")
    injected =
      index.slice(0, head - 2) + "\n\t\t" + tag + index.slice(head - 2);
  else if (index.slice(head - 3, head) === "\n  ")
    injected =
      index.slice(0, head - 3) + "\n    " + tag + index.slice(head - 3);
  else injected = index.slice(0, head) + tag + index.slice(head);
  await writeFile(`${root}index.html`, injected);
}

async function createRegistrationScript(root: PathLike = "./", base = "/") {
  await writeFile(
    `${root}register-sw.js`,
    `navigator.serviceWorker.register("${base}sw.js", { scope: "${base}" });`,
  );
}

async function createServiceWorkerScript(
  root: PathLike = "./",
  ignore: string[] = [],
  base = "/",
) {
  const version = new Date().toISOString();
  let assets = await find(root, [...ignore, "sw.js", "register-sw.js"]);
  assets = assets.map((file) => `${base}${file}`);
  assets = [base, ...assets];
  await writeFile(`${root}sw.js`, serviceWorkerScript(version, assets));
}

async function find(
  root: PathLike = "./",
  ignore: string[] = [],
  prefix = "",
): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = prefix + entry.name;
    if (ignore.includes(path)) continue;
    if (entry.isFile()) paths.push(path);
    else if (entry.isDirectory())
      paths.push(...(await find(`${root}${entry.name}/`, ignore, path + "/")));
  }
  return paths;
}

const serviceWorkerScript = (
  version: string,
  assets: string[],
) => `const VERSION = "version-${version}";
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener("install", (event) => event.waitUntil(install()));
self.addEventListener("activate", (event) => event.waitUntil(activate()));
self.addEventListener("fetch", (event) => event.respondWith(match(event.request)));

async function install() {
  self.skipWaiting();
  const cache = await caches.open(VERSION);
  await cache.addAll(ASSETS);
  await deleteOldVersions();
}

async function activate() {
  self.clients.claim();
  await deleteOldVersions();
}

async function match(request) {
  const response = await caches.match(request);
  if (response) return response;
  return fetch(request);
}

async function deleteOldVersions() {
  const versions = await getInstalledVersions();
  const past_versions = versions.filter((key) => key !== VERSION);
  await Promise.all(past_versions.map((key) => caches.delete(key)));
}

async function getInstalledVersions() {
  const keys = await caches.keys();
  return keys.filter((key) => key.startsWith("version-"));
}`;
