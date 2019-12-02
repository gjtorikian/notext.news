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
  return res.render("index", { title: "NoText News" });
});

app.get("/:source", async function(req, res) {
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

  const data = JSON.parse(fs.readFileSync(`${source}.page.json`));
  return res.render("news", {
    source: source,
    name: name,
    title: `NoText: ${name}`,
    data: data
  });
});

const width = 1366;
const height = 768;
async function writePage(source, url) {
  const pageDocument = await render.fetchPage(
    isProd,
    source,
    url,
    width,
    height
  );
  fs.writeFileSync(`${source}.page.json`, JSON.stringify(pageDocument));
}
cron.schedule("*/5 * * * *", async function() {
  await writePage("nytimes", "https://www.nytimes.com/");
  await writePage("guardian", "https://www.theguardian.com/");
  await writePage("le-monde", "https://www.lemonde.fr/");
  await writePage("der-spiegel", "https://www.spiegel.de/");
  await writePage("el-pais", "https://elpais.com/");
  await writePage("asahi", "https://www.asahi.com/");
});

app.listen(port, () => console.log(`Listening on port ${port}`));
