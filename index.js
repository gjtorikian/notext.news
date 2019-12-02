const path = require("path");
const fs = require("fs");

const express = require("express");
const app = express();
const port = 3000;

const cron = require("node-cron");

const render = require("./render");

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

  let name;
  switch (source) {
    case "nytimes":
      name = "New York Times";
      break;
    case "guardian":
      name = "Guardian";
      break;
    case "le-monde":
      name = "Le Monde";
      break;
    case "der-spiegel":
      name = "Der Spiegel";
      break;
    case "el-pais":
      name = "El País";
      break;
    case "asahi":
      name = "朝日新聞";
      break;
    default:
      return res.sendStatus(404);
  }

  return res.render("news", {
    source: source,
    name: name,
    title: `NoText: ${name}`
  });
});

const sizes = {
  small: [576, 667],
  medium: [768, 667],
  large: [992, 667],
  xlarge: [1200, 667]
};

app.get("/sizer/:source/:width", async function(req, res) {
  let source = req.params.source;
  let viewportWidth = Number(req.params.width);

  let size;
  for (const [type, dimensions] of Object.entries(sizes)) {
    let width = dimensions[0];
    size = type;
    if (viewportWidth <= width) {
      break;
    }
  }

  const data = fs.readFileSync(`data/${source}.page-${size}.json`);

  return res.send(data);
});

async function writePage(source, url, size, width, height) {
  const pageDocument = await render.fetchPage(
    isProd,
    source,
    url,
    width,
    height
  );
  fs.writeFileSync(
    `data/${source}.page-${size}.json`,
    JSON.stringify(pageDocument)
  );
}
const time = isProd ? "*/10" : "*/1";
cron.schedule(`${time} * * * *`, async function() {
  // TODO: intentional attempt at sync work, could probably be cleaned up
  for (const [size, dimensions] of Object.entries(sizes)) {
    let width = dimensions[0],
      height = dimensions[1];
    await writePage("nytimes", "https://www.nytimes.com/", size, width, height);
    await writePage(
      "guardian",
      "https://www.theguardian.com/uk/",
      size,
      width,
      height
    );
    await writePage("le-monde", "https://www.lemonde.fr/", size, width, height);
    await writePage(
      "der-spiegel",
      "https://www.spiegel.de/",
      size,
      width,
      height
    );
    await writePage("el-pais", "https://elpais.com/", size, width, height);
    await writePage("asahi", "https://www.asahi.com/", size, width, height);
  }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
