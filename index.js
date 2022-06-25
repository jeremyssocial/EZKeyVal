const { readFileSync, writeFileSync, existsSync, lstatSync } = require('fs');

const { App, buildRes, serveFromFS, getBodyJSON } = require('@peter-schweitzer/ezserver');

const { port, route, dataPath } = require('./config.json');

const LOG = console.log;
const WARN = console.warn;
const ERR = console.error;

/** @returns {void} */
function saveToFS() {
  writeFileSync(dataPath, JSON.stringify(values), { encoding: 'utf8', flag: 'w' });
}

/** @returns {Object<string, any>} */
function readFromFS() {
  return (
    (!existsSync(dataPath)
      ? ERR("path doesn't exist", dataPath)
      : !lstatSync(dataPath).isFile()
      ? ERR('path is not a file', dataPath)
      : JSON.parse(readFileSync(dataPath) || WARN('file is empty', dataPath) || '{}')) || {}
  );
}

let values = readFromFS();

const app = new App(port);

app.addResolver('/', (req, res) => {
  serveFromFS(res, './EZServer/html/home.html');
});

app.endpoints.add(route, (req, res) => {
  buildRes(res, 'Bad Request\nmight use unsupported method', { code: 400, mime: 'text/plain' });
});

app.rest.get(route, (req, res) => {
  LOG('\n> GET:\n-------');
  LOG(' ip:', req.socket.remoteAddress);

  let key = req.url.substring(route.length + 1);
  LOG('key:', key);

  let val;
  LOG('val:', (val = values[key] || null));

  buildRes(res, JSON.stringify({ value: val }), { code: 200, mime: 'application/json' });
});

app.rest.put(route, async (req, res) => {
  LOG('\n> PUT:\n-------');
  LOG(' ip:', req.socket.remoteAddress);

  let key = req.url.substring(route.length + 1);
  LOG('key:', key);

  let { json, http_code } = await getBodyJSON(req);

  let val = values[key];
  LOG('old val:', val);

  if ((val = json.value) !== undefined) ((values[key] = val) || true) && LOG('new val:', val);
  else !(http_code = 0) && LOG('VALUE UNCHANGED');

  saveToFS();

  res.writeHead(http_code).end();
});

