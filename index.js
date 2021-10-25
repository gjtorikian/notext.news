const path = require("path");
const fs = require("fs");

const express = require("express");
const app = express();
const port = 3000;
const { render, sizes, sources } = require("./render");

const VIEWS_PATH = path.join(__dirname, "views");

let mustacheExpress = require("mustache-express");

app.engine("mustache", mustacheExpress());

app.set("view engine", "mustache");
app.set("views", VIEWS_PATH);

app.use(express.static("public"));

const isProd = process.env.NODE_ENV == "production";
if (isProd) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "notext.news");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
}

app.get("/", async function (req, res) {
  let timestampInfo = {};
  for (const source of Object.keys(sources)) {
    if (fs.existsSync(`data/${source}-timestamp`)) {
      timestampInfo[source] = fs.readFileSync(`data/${source}-timestamp`);
    } else {
      timestampInfo[source] = "???";
    }
  }

  return res.render("index", {
    title: "NoText News",
    htmlLang: "en",
    url: "",
    timestampInfo: timestampInfo,
  });
});

app.get("/from/:source", async function (req, res) {
  let source = req.params.source;
  let s = sources[source];

  if (s == undefined) {
    return res.sendStatus(404);
  }

  let name = s.name;
  let htmlLang = s.htmlLang;

  return res.render("news", {
    source: source,
    name: name,
    htmlLang: htmlLang,
    title: `NoText: ${name}`,
    url: `from/${source}`,
  });
});

app.get("/sizer/:source/:width", async function (req, res) {
  let source = req.params.source;
  let viewportWidth = Number(req.params.width);

  let size;
  for (const [type, dimensions] of Object.entries(sizes)) {
    let width = dimensions.width;
    if (viewportWidth <= width) {
      if (size == undefined) {
        size = type;
      }
      break;
    } else {
      size = "xlarge";
    }
    size = type;
  }

  let data;
  if (app.locals[`${source}-${size}`] === undefined) {
    data = fs.readFileSync(`data/${source}.page-${size}.json`);
  } else {
    data = app.locals[`${source}-${size}`];
  }

  return res.send(data);
});

process.on("uncaughtException", function (e) {
  console.error(`An error occurred: ${e}\n${e.stack}"`);
  process.exit(1);
});

app.listen(port, () => console.log(`Listening on port ${port}`));

this.run = async () => {
  // intentional sync work; little DO box can't handle more than one page read
  for (const size of Object.keys(sizes)) {
    for (const source of Object.keys(sources)) {
      const page = await render(source, size);
      app.locals[`${source}-${size}`] = page;

      let date = new Date();
      let isoDateTime = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
      ).toISOString();

      fs.writeFileSync(
        `data/${source}-timestamp`,
        `${isoDateTime.replace("T", " ").substr(0, 16)}`
      );
    }
  }

  setTimeout(this.run, 1000 - new Date().getMilliseconds() + 1);
};

this.run();
