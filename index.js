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
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "notext.news");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
}

app.get("/", async function(req, res) {
  return res.render("index", {
    title: "NoText News",
    data: { htmlLang: "en" }
  });
});

app.get("/from/:source", async function(req, res) {
  let source = req.params.source;
  let s = sources[source];

  if (s == undefined) {
    return res.sendStatus(404);
  }

  let name = s.name;

  return res.render("news", {
    source: source,
    name: name,
    title: `NoText: ${name}`
  });
});

app.get("/sizer/:source/:width", async function(req, res) {
  let source = req.params.source;
  let viewportWidth = Number(req.params.width);

  let size;
  for (const [type, dimensions] of Object.entries(sizes)) {
    let width = dimensions[0];
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

  const data = fs.readFileSync(`data/${source}.page-${size}.json`);

  return res.send(data);
});

app.listen(port, () => console.log(`Listening on port ${port}`));

this.run = async () => {
  // intentional sync work; little DO box can't handle more than one
  for (const size of Object.keys(sizes)) {
    for (const source of Object.keys(sources)) {
      await render(source, size);
    }
  }

  setTimeout(this.run, 1000 - new Date().getMilliseconds() + 1);
};

this.run();
