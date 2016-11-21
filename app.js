const Promise = require('bluebird');
const express = require('express');
const webdriver = require('selenium-webdriver');

const PORT = process.env.PORT || 3000;

const DEFAULT_DESIRED_SIZE = {
  width: 1280, // 375,
  height: 960, // 667,
};

const MAX_PAGE_LOAD_TIME = 10000; // ms
const MAX_SCRIPT_TIME = 2000; // ms
const SCREENSHOT_TIMEOUT = 15000; // ms
const QUIT_TIMEOUT = 5000; // ms
const EXTRA_PAGE_LOAD_TIME = 800; // ms
const RESIZE_WAIT_TIME = 600; // ms

const app = express();

// Keep track of how often we need to re-initialize our Selenium session.
let driverIndex = 0;
let driverPromise;

function getDriver() {
  if (!driverPromise) {
    driverIndex++;
    console.log(`Initializing Selenium session #${driverIndex}...`);

    driverPromise = new webdriver.Builder().
      forBrowser('chrome').
      build().
      then(driver => {
        driver.manage().timeouts().pageLoadTimeout(MAX_PAGE_LOAD_TIME);
        driver.manage().timeouts().setScriptTimeout(MAX_SCRIPT_TIME);

        // Don't fail on uncaught exceptions from driver.controlFlow().execute()
        // since we're passing them up the chain properly.
        driver.controlFlow().on('uncaughtException', error => {});

        console.log(`Initialized Selenium session #${driverIndex}`);
        return driver;
      });
  }

  return driverPromise;
}

function killDriver() {
  if (!driverPromise) {
    return Promise.resolve();
  }

  const result = Promise.resolve(driverPromise).
    then(driver => driver.quit()).
    timeout(QUIT_TIMEOUT).
    catch(error => {
      console.log('Failed to kill Selenium session:', error);
    });

  driverPromise = undefined;
  return result;
}

function takeScreenshot(driver, url, desiredSize) {
  return driver.controlFlow().execute(() => {
    // Resize the window such that the inner window size matches our desired
    // screenshot size.
    webdriver.promise.all([
      driver.manage().window().getSize(),
      driver.executeScript(function() {
        return {
          width: window.innerWidth,
          height: window.innerHeight
        };
      })
    ]).then(([outerSize, innerSize]) => {
      outerSize.width += (desiredSize.width - innerSize.width);
      outerSize.height += (desiredSize.height - innerSize.height);
      driver.manage().window().setSize(outerSize.width, outerSize.height);
    });

    driver.get(url);

    driver.executeScript(function(style) {
      var el = document.createElement('style');
      el.innerText = style;
      document.head.appendChild(el);
    }, [
      // Exclude scrollbars from screenshot diffs.
      '::-webkit-scrollbar { display: none; }',
      // Ensure consistent image scaling for screenshot diffing.
      'body { image-rendering: pixelated; }'
    ].join("\n"));

    // Give any asynchronous scripts after $(document).ready() some time
    // to run.
    driver.sleep(EXTRA_PAGE_LOAD_TIME);

    // Attempt to expand the inner window height to match the page height.
    webdriver.promise.all([
      driver.manage().window().getSize(),
      driver.executeScript(function() {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollHeight: document.body.scrollHeight
        };
      })
    ]).then(([outerSize, innerSize]) => {
      outerSize.width += (desiredSize.width - innerSize.width);
      outerSize.height += (Math.max(desiredSize.height, Math.min(innerSize.scrollHeight + 100, 10000)) - innerSize.height);
      driver.manage().window().setSize(outerSize.width, outerSize.height);
    });

    // We need to give the browser some time to re-render after a resize.
    // Otherwise, we may end up with stretched screenshots.
    driver.sleep(RESIZE_WAIT_TIME);

    return driver.takeScreenshot().then(data => {
      return Buffer.from(data, 'base64');
    });
  });
}

app.get('/capture', function(req, res, next) {
  const url = req.query.url;
  if (!url) {
    throw new Error('No URL provided.');
  }

  const desiredSize = Object.assign({}, DEFAULT_DESIRED_SIZE);
  if (req.query.width) {
    desiredSize.width = parseInt(req.query.width)
    if (desiredSize.width <= 0) {
      throw new Error('Invalid width provided.');
    }
  }

  console.log('Taking screenshot of', url, 'at', desiredSize);
  Promise.resolve(getDriver()).
    then(driver => takeScreenshot(driver, url, desiredSize)).
    timeout(SCREENSHOT_TIMEOUT).
    catch(error => killDriver().then(() => Promise.reject(error))).
    then(pngBuffer => {
      console.log('Done taking screenshot of', url);

      res.type('png');
      res.send(pngBuffer);
    }).
    catch(error => {
      next(error);
    });
});

app.use(function(err, req, res, next) {
  console.error(err);
  res.status(500);
  res.send(err.message);
});

app.listen(PORT, function(error) {
  if (error) {
    console.error(error);
  }
  else {
    console.info('Listening on port %d in %s mode', PORT, app.settings.env);
  }
});
