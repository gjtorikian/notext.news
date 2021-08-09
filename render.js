const fs = require("fs");

const puppeteer = require("puppeteer");

const isProd = process.env.NODE_ENV == "production";

async function removeBanners(source, size, page) {
  try {
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
    } else if (source == "asahi") {
      const [a] = await page.$x('//a[contains(@class, "cc-btn")]');
      if (a) {
        await a.click();
      }
    }
  } catch (e) {
    console.error(`${source}-${size} removeBanners error:`);
    console.error(e);
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
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(source, url, size, width, height) {
  const browser = await puppeteer.launch({
    headless: isProd,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // slowMo: 1000
  });
  const page = await browser.newPage();

  let device;
  if (size == "small") {
    device = puppeteer.devices["iPhone 6"];
    await page.emulate(device);
  } else if (size == "medium") {
    device = puppeteer.devices["iPad"];
    await page.emulate(device);
  } else {
    await page.setViewport({ width: width, height: height });
  }

  // click a stupid accept banner
  if (source == "der-spiegel") {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 90 * 1000 });

      const [childSpan] = await page.$x(
        '//button/span/span[contains(., "Akzeptieren")]'
      );
      if (childSpan) {
        const parentSpan = (await childSpan.$x(".."))[0];
        const button = (await parentSpan.$x(".."))[0];
        await button.click();
        await sleep(5000);
      }
    } catch (e) {
      console.error(`${source}-${size} banner click error`);
      console.error(e);
    }
  }

  await page.setRequestInterception(true);

  try {
    page.on("request", (request) => {
      if (!isProd) {
        console.log(`${request.resourceType()}: ${request.url()}`);
      }

      if (
        request.resourceType() == "font" || // no need to get fonts
        (request.resourceType() == "other" &&
          /(?:pay|payments)\.google\.com/.test(request.url())) ||
        (request.resourceType() == "script" &&
          /adsbygoogle\.js$/.test(request.url())) ||
        // some crazy redirecting spyware bullshit
        (source == "la-repubblica" && request.url().includes("kataweb.it"))
      ) {
        request.abort().catch(async (err) => {
          console.error("Abort error or other error: ", err);
          return await browser.close();
        });
      } else {
        request.continue();
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 90 * 1000 });

    // load dynamic content
    await autoScroll(page);
  } catch (err) {
    console.error("Error: ", err);
    return await browser.close();
  }

  // click cookie buttons
  await removeBanners(source, size, page);

  const pageDocument = await page.evaluate(
    (source, size) => {
      // some sites on mobile load from a `m` subdomain
      let url = window.location.href;
      let urlLength = url.length;
      if (url.charAt(urlLength - 1) == "/") {
        url = url.substring(0, urlLength - 1);
      }

      function localize(tag, attribute, source, url) {
        let elements = document.getElementsByTagName(tag);
        for (let el of elements) {
          let original = el.getAttribute(attribute);
          // special El Pais CSS rewrite
          if (original !== null && source == "el-pais" && tag == "link") {
            original = original.replace("america/pf", "pf");
          }
          // rewrite "/" but not "//"
          if (original !== null && original[0] == "/" && original[1] != "/") {
            el.setAttribute(attribute, `${url}${original}`);
          }
        }
      }
      localize("link", "href", source, url);
      localize("script", "src", source, url);
      localize("img", "src", source, url);

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

        const inspect = options.inspect || ((n) => true),
          collect = options.collect || ((n) => true);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
          acceptNode: function (node) {
            if (!inspect(node)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!collect(node)) {
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
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
          inspect: (n) => !["STYLE", "SCRIPT"].includes(n.nodeName),
          collect: (n) => n.nodeType === Node.TEXT_NODE,
          callback: (n) => callback(n),
        });
      }

      // replace all text with nbsp
      textNodesUnder(document.body, function (el) {
        if (el.textContent.trim().length > 0) {
          el.textContent = "\u00A0";
        }
      });

      function removeLinks() {
        let anchors = document.getElementsByTagName("a");
        for (a of anchors) {
          a.removeAttribute("href");
        }
      }
      // remove all clickable links
      removeLinks();

      function clearInput(tagName) {
        let nodes = document.getElementsByTagName(tagName);
        for (let n = 0; n < nodes.length; n++) {
          if (nodes[n].value.trim().length > 0) {
            nodes[n].setAttribute("value", "");
          }
        }
      }
      // remove prefilled input values
      clearInput("input");

      function removeElement(tagName, attr, value, preserve) {
        let elements = [],
          tags = document.getElementsByTagName(tagName);
        if (attr !== undefined) {
          for (let i = 0; i < tags.length; i++) {
            if (preserve) {
              if (tags[i].getAttribute(attr) != value) {
                elements.push(tags[i]);
              }
            } else {
              if (tags[i].getAttribute(attr) == value) {
                elements.push(tags[i]);
              }
            }
          }
        } else {
          elements = tags;
        }
        while (elements[0]) {
          if (elements[0].parentNode) {
            elements[0].parentNode.removeChild(elements[0]);
          } else {
            elements.shift().remove();
          }
        }
      }

      // remove problematic elements
      removeElement("meta");
      removeElement("script");
      removeElement("noscript");
      removeElement("title");
      removeElement("iframe");
      removeElement("link", "media", "print", false);
      removeElement("link", "rel", "stylesheet", true);
      if (source == "el-pais") {
        removeElement("div", "id", "sticky-pbs", false);
      }

      let htmlTag = document.getElementsByTagName("html")[0];
      let htmlClasses;
      if (htmlTag.classList.length > 0) {
        htmlClasses = htmlTag.className;
      } else {
        htmlClasses = ["no-class-list-found"];
      }
      let htmlLang = htmlTag.getAttribute("lang");
      let bodyClasses;
      if (document.body.classList.length > 0) {
        bodyClasses = document.body.className;
      } else {
        bodyClasses = ["no-class-list-found"];
      }

      return {
        size,
        htmlClasses,
        htmlLang,
        bodyId: document.body.id,
        bodyClasses,
        headHTML: document.head.innerHTML,
        bodyHTML: document.body.innerHTML,
      };
    },
    source,
    size
  );

  await browser.close();
  const newlineRegExp = new RegExp(/\n/g);

  pageDocument.headHTML = pageDocument.headHTML.replace(newlineRegExp, "");
  pageDocument.bodyHTML = pageDocument.bodyHTML.replace(newlineRegExp, "");

  return pageDocument;
}

const sizes = {
  small: { width: 375, height: 667 },
  medium: { width: 768, height: 1024 },
  large: { width: 992, height: 1024 },
  xlarge: { width: 1200, height: 1024 },
};

const sources = {
  nytimes: {
    url: "https://www.nytimes.com",
    name: "New York Times",
    htmlLang: "en",
  },
  guardian: {
    url: "https://www.theguardian.com/uk",
    name: "The Guardian",
    htmlLang: "en",
  },
  "le-monde": {
    url: "https://www.lemonde.fr",
    name: "Le Monde",
    htmlLang: "fr",
  },
  "der-spiegel": {
    url: "https://www.spiegel.de",
    name: "Der Spiegel",
    htmlLang: "de",
  },
  "el-pais": { url: "https://elpais.com", name: "El País", htmlLang: "es" },
  asahi: { url: "https://www.asahi.com", name: "朝日新聞", htmlLang: "jp" },
  "la-repubblica": {
    url: "https://www.repubblica.it",
    name: "la Repubblica",
    htmlLang: "it",
  },
};

const render = async function (source, size) {
  let width = sizes[size].width,
    height = sizes[size].height,
    url = sources[source].url;

  const pageDocument = await fetchPage(source, url, size, width, height);
  const page = JSON.stringify(pageDocument);
  fs.writeFileSync(`data/${source}.page-${size}.json`, page);

  return page;
};

module.exports = {
  render: render,
  sizes: sizes,
  sources: sources,
};
