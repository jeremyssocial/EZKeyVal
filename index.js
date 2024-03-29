//todo: add event listener on data.json change

const { readFile, writeFile, existsSync, lstatSync } = require('fs');
const { App, buildRes, serveFromFS, getBodyJSON, throw404 } = require('@peter-schweitzer/ezserver');

const {
  port = '1337',
  route = '/ezkv',
  dataPath = './data.json',
  logging = false,
  DEBUG_ROUTS_ENABLED = false,
  aggressiveSync = false,
  noSync = false,
  syncInterval = 900000,
} = require('./config.json');

const LOG = console.log;
const WARN = console.warn;
const ERR = console.error;

let values = {};

/** @returns {void} */
function writeToFS() {
  try {
    writeFile(dataPath, JSON.stringify(values), { encoding: 'utf8', flag: 'w' });
  } catch (err) {
    ERR('unable to write to FS', err);
  }
}

function readFromFS() {
  readFile(dataPath, (err, data) => {
    if (err) {
      ERR('error while reading from FS', err);
      existsSync(dataPath) || lstatSync(dataPath).isFile() || writeToFS();
    } else
      try {
        let vals = JSON.parse(data);
        values = vals;
      } catch (err) {
        ERR('error while parsing data', err);
      }
  });
}

function logInteraction(a, m, k, o, n = null) {
  LOG(`address: ${a} | method: ${m} | key: ${k} | (old) value: ${o}` + `${n === null ? '' : ` | new value: ${n}`}`);
}

readFromFS();
if (!aggressiveSync && !noSync) setInterval(readFromFS, syncInterval);

const app = new App();
app.listen(process.env.PORT || port);

app.add('/', (req, res) => {
  serveFromFS(res, './html/home.html');
});

if (DEBUG_ROUTS_ENABLED) {
  app.add('/debug/load', (req, res) => {
    buildRes(res, 'resyncing data');
    readFromFS();
  });

  app.add('/debug/data', (req, res) => {
    serveFromFS(res, dataPath);
  });

  app.add('/debug/dump', (req, res) => {
    WARN('dump', values);
    buildRes(res, JSON.stringify(values));
  });

  app.add('/debug/reset', (req, res) => {
    WARN('reset', values);
    values = {};
    readFromFS();
    buildRes(res, 'resetting data');
  });
}

app.add('/favicon.ico', throw404);

app.add('/', (req, res) => {
  serveFromFS(res, './admin_panel/index.html');
});

app.add('/values', (req, res) => {
  buildRes(res, JSON.stringify(values), { mime: 'application/json' });
});

app.addRoute('/', (req, res) => {
  serveFromFS(res, `./admin_panel${req.url}`);
});

app.addRoute(route, (req, res) => {
  buildRes(res, 'Bad Request\nmight use unsupported method', { code: 400 });
});

app.get(route, (req, res) => {
  const val = values[req.url];

  if (aggressiveSync) values = readFromFS();

  buildRes(res, JSON.stringify({ value: val }), { mime: 'application/json' });

  logging && logInteraction(req.socket.remoteAddress, 'GET', req.url, val);
});

app.put(route, async (req, res) => {
  const { json, http_code } = await getBodyJSON(req);
  const key = req.url.substring(route.length + 1);

  const old_val = values[key];
  values[key] = json.value || old_val;

  res.writeHead(http_code).end();

  writeToFS();
  logging && logInteraction(req.socket.remoteAddress, 'PUT', req.url, old_val, values[req.url]);
});
