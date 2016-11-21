# camera

This is a simple HTTP-based microservice for taking screenshots of sites using Selenium. It's meant to be a useful building block when setting up your own visual regression testing.

Currently it's provided as a Docker image that depends on the [Selenium Docker image](https://github.com/SeleniumHQ/docker-selenium), but in the future we'd like to extract some of the browser control logic into a node package so it can more easily be incorporated in JavaScript-based test suites.

## Getting started

### Using Docker Compose

```bash
$ git clone https://github.com/digitaldeployment/camera.git
$ cd camera/
$ docker-compose up
$ curl -v "http://localhost:3000/capture?url=http://sacjs.com" > ~/Desktop/screenshot.png
```

If you're using Docker Machine on OS X, replace `localhost` with whatever your Docker host is:

```bash
$ docker-machine url
tcp://192.168.99.100:2376 # for example
```
