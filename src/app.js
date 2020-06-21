requirejs.config({
    "baseUrl": "src/lib",
    "paths": {
      "app": "../app",
      "params": "params",
      "cookie": "cookie",
      "helper": "helper",
      "domReady": "https://cdnjs.cloudflare.com/ajax/libs/require-domReady/2.0.1/domReady.min",
      "d3": "https://d3js.org/d3.v5.min",
      "d3-dsv": "https://d3js.org/d3-dsv.v1.min",
      "d3-fetch": "https://d3js.org/d3-fetch.v1.min"
    }
});

// Load the main app module to start the app
requirejs(["app/main"]);