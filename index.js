const path = require("path");

const express = require("express");
const app = express();
const port = 3000;

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
    case "asahi":
      url = "https://www.asahi.com/";
      break;
    default:
      return res.sendStatus(404);
  }
  const pageDocument = await fetchPage(
    source,
    url,
    Number(req.query.width),
    Number(req.query.height)
  );

  return res.send(JSON.stringify(pageDocument));
});

async function removeBanners(source, page) {
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
      }, 500);
    });
  });
}

async function fetchPage(source, url, width, height) {
  const browser = await puppeteer.launch({
    headless: isProd,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
    // slowMo: 300
  });
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height });
  await page.goto(url, { waitUntil: "networkidle2" });

  // load dynamic content
  await autoScroll(page);

  // click cookie buttons
  await removeBanners(source, page);

  const pageDocument = await page.evaluate(url => {
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
    function applyJSCSS() {
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
      let cssRulesAppended = cssRules.join(" ");

      let styleTag = document.createElement("style");
      styleTag.type = "text/css";
      styleTag.appendChild(document.createTextNode(cssRulesAppended));

      return styleTag;
    }

    let head = document.head;
    head.appendChild(applyJSCSS());

    // https://stackoverflow.com/questions/10730309/find-all-text-nodes-in-html-page
    function walkNodeTree(root, options) {
      options = options || {};

      const inspect = options.inspect || (n => true),
        collect = options.collect || (n => true);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
        acceptNode: function(node) {
          if (!inspect(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!collect(node)) {
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        options.callback && options.callback(n);
        nodes.push(n);
      }

      return nodes;
    }

    function textNodesUnder(el, callback) {
      return walkNodeTree(el, {
        inspect: n => !["STYLE", "SCRIPT"].includes(n.nodeName),
        collect: n => n.nodeType === Node.TEXT_NODE,
        callback: n => callback(n)
      });
    }

    // replace all text with nbsp
    textNodesUnder(document.body, function(el) {
      el.textContent = "\u00A0";
    });

    function removeLinks() {
      let anchors = document.getElementsByTagName("a");
      for (a of anchors) {
        a.removeAttribute("href");
      }
    }
    // remove all clickable links
    removeLinks();

    function removeNodes(name) {
      let nodes = document.getElementsByTagName(name);
      let nodesLength = nodes.length;
      // truly unsure why not all children are removed at once
      do {
        for (let n of nodes) {
          n.parentNode.removeChild(n);
        }
        nodesLength = document.getElementsByTagName(name).length;
      } while (nodesLength > 0);
    }

    // remove problematic nodes
    removeNodes("meta");
    removeNodes("script");
    removeNodes("noscript");
    removeNodes("title");
    removeNodes("iframe");

    let htmlTag = document.getElementsByTagName("html")[0];
    let htmlClasses;
    if (htmlTag.classList.length > 0) {
      htmlClasses = htmlTag.classList;
    } else {
      htmlClasses = ["no-class-list-found"];
    }
    let htmlLang = htmlTag.getAttribute("lang");
    let bodyClasses;
    if (document.body.classList > 0) {
      bodyClasses = htmlTag.classList;
    } else {
      bodyClasses = ["no-class-list-found"];
    }

    return {
      htmlClasses,
      htmlLang,
      bodyClasses,
      headHTML: document.head.innerHTML,
      bodyHTML: document.body.innerHTML
    };
  }, url);

  browser.close();

  return pageDocument;
}

app.listen(port, () => console.log(`Listening on port ${port}`));
