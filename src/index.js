
// *** Helper Functions ***

// copied from https://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters/979995#979995
function parse_query_string(query) {
  var vars = query.split("&");
  var query_string = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    var key = decodeURIComponent(pair[0]);
    var value = decodeURIComponent(pair[1]);
    // If first entry with this name
    if (typeof query_string[key] === "undefined") {
      query_string[key] = decodeURIComponent(value);
      // If second entry with this name
    } else if (typeof query_string[key] === "string") {
      var arr = [query_string[key], decodeURIComponent(value)];
      query_string[key] = arr;
      // If third or later entry with this name
    } else {
      query_string[key].push(decodeURIComponent(value));
    }
  }
  return query_string;
}

function create_data_row(name, value) {
  var nameCell = document.createElement("td")
  nameCell.innerHTML = name

  var valueCell = document.createElement("td")
  valueCell.innerHTML = value

  var rowElement = document.createElement("tr")
  rowElement.appendChild(nameCell)
  rowElement.appendChild(valueCell)
  return rowElement
}

function parseDate(text) {
  var numbers = text.split("-");
  var year = parseInt(numbers[0], 10);
  var month = parseInt(numbers[1], 10);
  var day = parseInt(numbers[2], 10);
  return new Date(year, month-1, day, 0, 0);
}

function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ("0" + (d.getMonth() + 1)).slice(-2);
  var day = ("0" + d.getDate()).slice(-2);
  return year + "-" + month + "-" + day;
}

function formatHHmmTime(date) {
  var d = new Date(date);
  return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}

function parseSeconds(time) {
  var numbers = time.split(":");
  return (parseInt(numbers[0], 10) * 60 + parseInt(numbers[1], 10)) * 60 + parseInt(numbers[2], 10)
}

function relativeTimeToDate(time, dateOfSleep) {
  var hour = parseInt(time.substr(0, 2));
  // TODO this could be safer probably
  // (it should check with the sleep interval, to extract the exact day offset relative to date of sleep)
  var time;
  if (hour > 16)
      time = (parseSeconds(time) - 24*60*60) * 1000;
  else
      time = parseSeconds(time) * 1000;
  var date = new Date(dateOfSleep.getTime() + time);
  return date;
}

// Cookie access functions, from https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {
    document.cookie = name+'=; Max-Age=-99999999;';
}

// *** Sleep data fetching ***

function fetch_sleep_data(accessToken, dateOfSleep, on_response) {
    var dateFormatted = formatDate(dateOfSleep);
    var sleepDataUrl = "https://api.fitbit.com/1.2/user/-/sleep/date/" + dateFormatted + ".json";
    fetch_json(accessToken, sleepDataUrl).then(on_response);
}

// *** Heart rate data fetching ***

function fetch_heart_rate_data(accessToken, startTime, endTime, on_response) {
    var startDate = formatDate(startTime);
    var endDate = formatDate(endTime);
    var start = formatHHmmTime(startTime);
    var end = formatHHmmTime(endTime);
    var heartRateDataUrl = "https://api.fitbit.com/1/user/-/activities/heart/date/" + startDate + "/" + endDate + "/1min/time/" + start + "/" + end + ".json";
    fetch_json(accessToken, heartRateDataUrl).then(on_response);
}

function fetch_json(accessToken, url) {
    var headers = new Headers({"Authorization": "Bearer " + accessToken});
    return d3.json(url, {"method": "GET", "headers": headers})
}

// *** Get Information about Fitbit Session (currently not used) ***

// this function does "currying" i.e. a way to pass multiple argument lists that can be partially applied
// the function returns another function which has a parameter list of its own, therefore it becomes possible
// to "partially apply" the function by providing the first parameter list and then afterwards, the second
// parameter list, will actually invoke the function.
function on_token_introspect_response(accessToken) {
    return (data) => {
        console.log(data)

        // displaying login information in a table
        var table = document.createElement("table")
        table.appendChild(create_data_row("User ID", data.user_id))
        table.appendChild(create_data_row("Scope", data.scope))
        table.appendChild(create_data_row("Client ID", data.client_id))
        table.appendChild(create_data_row("Authorized", new Date(data.iat).toString()))
        table.appendChild(create_data_row("Expires", new Date(data.exp).toString()))

        document.body.appendChild(table)
    }
}

// fetches information about Fitbit session
function fetch_token_introspect(accessToken) {
    var tokenInfoUrl = "https://api.fitbit.com/1.1/oauth2/introspect";
    var headers = new Headers({"Authorization": "Bearer " + accessToken});
    var params = new URLSearchParams({"token": accessToken});
    d3.json(tokenInfoUrl, {"method": "POST", "headers": headers, "body": params}).then(on_token_introspect_response(accessToken));
}

// *** D3 Chart building ***

var chart = d3.select("#chart").style("background-color", "white");

var outerWidth = chart.attr("width");
var outerHeight = chart.attr("height");

var margin = {top: 40, right: 30, bottom: 30, left: 40},
    width = outerWidth - margin.left - margin.right,
    height = outerHeight - margin.top - margin.bottom;

var x = d3.scaleTime().rangeRound([0, width]);

var y = d3.scaleLinear().range([height, 0]);

var color = d3.scaleOrdinal()
  .domain(["deep","light","rem","wake"])
  .range(["#069fb2", "#f7cac9", "#92a8d1", "#f7786b"]);

var xAxis = d3.axisBottom(x);

var yAxis = d3.axisLeft(y);

var legendG = chart.selectAll(".legend")
    .data(color.domain()).enter().append("g")
    .attr("transform", (d, i) => "translate(" + (i*60 + margin.left + 5) + "," + 10 + ")");

legendG.append("rect")
    .attr("class", "legend")
    .attr("fill", d => color(d))
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 15)
    .attr("height", 15);

legendG.append("text")
    .attr("x", 22)
    .attr("y", 10)
    .text(d => d);

chart = chart
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var sleepBarsContainer = chart.append("g") // to bundle them in one element that is behind the graphLine

var yAxisG = chart.append("g")
    .attr("class", "y axis");

var xAxisG = chart.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")");

var graphLine = chart.append("path")
    .attr("class", "graph")
    .attr("fill", "none")
    .attr("stroke", "#aaa")
    .attr("stroke-width", 1);

var graphLineMovingAverage = chart.append("path")
    .attr("class", "graph-moving-average")
    .attr("fill", "none")
    .attr("stroke", "#000")

// resting heart rate is not available in activities-heart when asked for intraday data
//var data2 = response["activities-heart"]
//var restingHeartRate = data2.value.restingHeartRate
//chart.append("line")
//    .attr("stroke", "black")
//    .attr("stroke-width", 1)
//    .attr("stroke-dasharray", "4")
//    .attr("x1", 0)
//    .attr("x2", width)
//    .attr("y1", y(restingHeartRate))
//    .attr("y2", y(restingHeartRate))

function update_chart_data(accessToken, dateOfSleep) {

    fetch_sleep_data(accessToken, dateOfSleep, function (response) {
        // TODO the following situations are currently unhandled here
        //      - no sleep data for a day
        //      - main sleep is not the first sleep item
        //      - multiple sleep items
        var data;
        if (response.sleep.length > 0) {
            var levels = response.sleep[0].levels;
            data = levels.data.concat(levels.shortData); // dateTime, level, seconds
        } else {
            data = [];
        }

        var sleepStartTime = Date.parse(response.sleep[0].startTime)
        var sleepEndTime = Date.parse(response.sleep[0].endTime)

        x.domain([sleepStartTime, sleepEndTime]);

        fetch_heart_rate_data(accessToken, sleepStartTime, sleepEndTime, function (response) {
            var data = response["activities-heart-intraday"].dataset; // time [HH:mm:ss], value
            var movingAverageData = calculate_moving_average(data, 7);

            y.domain(d3.extent(data, d => d.value));

            var lineMaker = d3.line()
                .x(d => x(relativeTimeToDate(d.time, dateOfSleep)))
                .y(d => y(d.value));
                //.curve(d3.curveCatmullRom.alpha(0.5)); // this could smoothen the line a bit

            graphLine.attr("d", lineMaker(data));
            graphLineMovingAverage.attr("d", lineMaker(movingAverageData))

            yAxisG.call(yAxis);

        })
        xAxisG.call(xAxis);

        var existingSleepZoneBars = sleepBarsContainer.selectAll(".bar");
        var sleepZoneBars = existingSleepZoneBars.data(data);
        sleepZoneBars.exit().remove();
        sleepZoneBars.enter().append("rect")
            .attr("class", "bar")
            .attr("stroke", "none")
            .merge(sleepZoneBars) // after new elements created, merge existing with new for the attributes depending on data
            .attr("fill", d => color(d.level))
            .attr("x", d => x(Date.parse(d.dateTime))) // start time
            .attr("y", 0 ) // upper end
            .attr("height", height ) // lower end
            .attr("width", d => Math.max(1, x(Date.parse(d.dateTime)+d.seconds*1000) - x(Date.parse(d.dateTime)))); // end time - start time = duration (guaranteeing at least 1 pixel width)
    })
}

function calculate_moving_average(data, windowSize) {
    var summed = data.map(function(d, i) {

        var offset = Math.floor(windowSize/2)
        var start = Math.max(0,i-offset);
        var end = Math.min(i+windowSize-offset, data.length-1);

        var newD = {};
        newD["time"] = d.time;
        var slice = data.slice(start, end)
        newD["value"] = slice.length === 0 ? d.value : d3.sum(slice, function(x) {return x["value"]}) / (end-start);

        return newD;
    })
    return summed
}

// HTML Form handling

function init_form() {
    if (!d3.select("#dateInput").property("value")) {
        var dateText = formatDate(new Date());
        d3.select("#dateInput").property("value", dateText);
    }

    if (accessToken) {
        update_date_of_sleep(accessToken);
    }
}

function update_date_of_sleep(accessToken) {
    var dateText = d3.select("#dateInput").property("value");
    var date = parseDate(dateText);
    update_chart_data(accessToken, date);
}

function change_date_of_sleep(changeInDays) {
    var dateInput = d3.select("#dateInput")
    var dateText = dateInput.property("value");
    var date = parseDate(dateText);
    var changedDate = new Date(date.getTime() + changeInDays * 24 * 60 * 60 * 1000);
    dateInput.property("value", formatDate(changedDate));
    update_chart_data(accessToken, changedDate)
}

function validate_date_of_sleep() {
    // TODO validate text and activate buttons only if valid
}

// *** Initialization ***

var url = new URL(window.location.href);
var params = parse_query_string(url.hash.substring(1));
var accessToken = params["access_token"];
var expiresIn = params["expires_in"]; // seconds until expiration
var userId = params["user_id"];

if (accessToken === undefined) {

    var cookieKey = "fitBitApiClientId";

    var clientId = getCookie(cookieKey);
    if (clientId === null) {
        clientId = prompt("Please enter your FitBit API Client ID", "")
        setCookie(cookieKey, clientId, 10 * 365) // stored for 10 years
    }

    function generate_login_url(clientId) {
        return "https://www.fitbit.com/oauth2/authorize?response_type=token&client_id=" + clientId + "&redirect_uri=http%3A%2F%2Flocalhost:8080%2F&scope=heartrate%20sleep&expires_in=2592000";
    }
    var loginUrl = generate_login_url(clientId);

    // Create a login link
    var loginLink = document.createElement("a");
    loginLink.setAttribute("href", loginUrl);
    loginLink.innerHTML = "Login at Fitbit";
    document.body.appendChild(loginLink);

}