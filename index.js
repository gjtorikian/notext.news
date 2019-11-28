const path = require("path");

const express = require("express");
const app = express();
const port = 3000;

const request = require("request-promise-native");
let cheerio = require("cheerio");

const VIEWS_PATH = path.join(__dirname, "/views");

let mustacheExpress = require("mustache-express");

// Register '.mustache' extension with The Mustache Express
app.engine("mustache", mustacheExpress());
app.engine("mst", mustacheExpress(VIEWS_PATH + "/partials", ".mst"));

app.set("view engine", "mustache");
app.set("views", VIEWS_PATH);

app.get("/", async function(req, res) {
  return res.render("index");
});

app.get("/nytimes", async function(req, res) {
  res.setHeader("Content-Type", "text/html");

  let options = {
    uri: "http://www.nytimes.com",
    transform: function(body) {
      return cheerio.load(body);
    }
  };

  let $ = await request(options);

  localize($, "link", "href", "www.nytimes.com");
  localize($, "script", "src", "www.nytimes.com");

  // NYTimes ad space

  $("div#app")
    .children()
    .first()
    .remove();

  textReplacer($, "*");

  let contents = $.root().html();
  contents = contents.replace(
    /"\/vi-assets\//g,
    "https://www.nytimes.com/vi-assets/"
  );
  return res.render("news", { body: contents });
});

function localize($, tag, attribute, url) {
  $(tag).each(function(_, elem) {
    let original = $(elem).attr(attribute);
    if (original !== undefined && original[0] == "/" && original[1] != "/") {
      $(elem).attr(attribute, `https://${url}${original}`);
    }
  });
}

function textReplacer($, el) {
  $(el)
    .contents()
    .each(function(i, elem) {
      if (
        elem.type == "text" &&
        elem.parent.name != "style" &&
        elem.parent.name != "script"
      ) {
        $(elem).replaceWith("&nbsp;");
      }
    });
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
