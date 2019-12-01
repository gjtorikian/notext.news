const path = require("path");

const express = require("express");
const app = express();
const port = 3000;

const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

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
    default:
      return res.sendStatus(404);
  }

  return res.render("news", {
    source: source,
    name: name,
    title: `NoText: ${name}`
  });
});

app.get("/:source/data", async function(req, res) {
  let source = req.params.source;

  let url;
  switch (source) {
    case "nytimes":
      url = "https://www.nytimes.com";
      break;
    case "guardian":
      url = "https://www.theguardian.com";
      break;
    case "le-monde":
      url = "https://www.lemonde.fr/";
      break;
    case "der-spiegel":
      url = "https://www.spiegel.de";
      break;
    case "el-pais":
      url = "https://elpais.com/";
      break;
    default:
      return res.sendStatus(404);
  }
  const pageContent = await fetchPage(
    source,
    url,
    Number(req.query.width),
    Number(req.query.height)
  );

  const data = fetchPageContent(pageContent);

  return res.send(JSON.stringify(data));
});

function fetchPageContent(pageContent) {
  const $ = cheerio.load(pageContent);

  $("meta").remove();
  $("script").remove();
  $("noscript").remove();
  $("title").remove();
  $("iframe").remove();

  textReplacer($);
  linkRewriter($);

  let parsedHead = $("head").html();
  let parsedBody = $("body").html();

  return {
    head: parsedHead,
    body: parsedBody
  };
}

function textReplacer($) {
  const nbsp = $("<span>&nbsp;</span>");
  $("*")
    .contents()
    .each(function(_, elem) {
      if (
        elem.type == "text" &&
        elem.parent.name != "style" &&
        elem.parent.name != "script"
      ) {
        $(elem).replaceWith(nbsp);
      }
    });
}

function linkRewriter($) {
  $("a").each(function(_, elem) {
    $(elem).removeAttr("href");
  });
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 500;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          setTimeout(function() {
            clearInterval(timer);
            resolve();
          }, 250);
        }
      }, 250);
    });
  });
}

async function fetchPage(source, url, width, height) {
  const browser = await puppeteer.launch({
    headless: isProd,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height });
  await page.goto(url, { waitUntil: "networkidle2" });

  if (source == "nytimes") {
    const [button] = await page.$x("//button[contains(., 'I Accept')]");
    if (button) {
      await button.click();
    }
  } else if (source == "guardian") {
    const [span] = await page.$x('//span[contains(., "I\'m OK with that")]');
    if (span) {
      const button = (await span.$x(".."))[0];
      await button.click();
    }
  } else if (source == "el-pais") {
    const [span] = await page.$x('//span[contains(., "Close")]');
    if (span) {
      const button = (await span.$x(".."))[0];
      await button.click();
    }
  }

  await autoScroll(page);

  await page.evaluate(url => {
    function localize(tag, attribute, url) {
      let elements = document.getElementsByTagName(tag);
      for (let el of elements) {
        let original = el.getAttribute(attribute);
        // rewrite "/" but not "//"
        if (original !== null && original[0] == "/" && original[1] != "/") {
          el.setAttribute(attribute, `${url}${original}`);
        }
      }
    }

    localize("link", "href", url);
    localize("script", "src", url);

    // some complex CSS styles added by JS need to be manually recreated
    let cssRules = [];
    let styles = document.querySelectorAll("style");
    for (style of styles) {
      // we only care about sneaky JS styles
      // if (style.innerText == "") {
      //   continue;
      // }
      let rules = style.sheet.rules;
      for (rule of rules) {
        cssRules.push(rule.cssText);
      }
    }
    var cssRulesAppended = cssRules.join(" ");

    let head = document.head || document.getElementsByTagName("head")[0],
      styleTag = document.createElement("style");

    styleTag.type = "text/css";

    if (styleTag.styleSheet) {
      styleTag.styleSheet.cssText = cssRulesAppended;
    } else {
      styleTag.appendChild(document.createTextNode(cssRulesAppended));
    }

    head.appendChild(styleTag);
  }, url);

  let pageContent = await page.content();

  browser.close();

  return pageContent;
}

app.listen(port, () => console.log(`Listening on port ${port}`));
