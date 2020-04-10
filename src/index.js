
// *** Helper Functions ***

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

// *** Sleep data fetching ***

function fetch_sleep_data(accessToken, dateOfSleep, on_response) {
    var dateFormatted = formatDate(dateOfSleep);
    var sleepDataUrl = "https://api.fitbit.com/1.2/user/-/sleep/date/" + dateFormatted + ".json"
    var headers = new Headers({"Authorization": "Bearer " + accessToken});
    d3.json(sleepDataUrl, {"method": "GET", "headers": headers}).then(on_response)
}

// *** Heart rate data fetching ***

function fetch_heart_rate_data(accessToken, startTime, endTime, on_response) {
    var startDate = formatDate(startTime);
    var endDate = formatDate(endTime);
    var start = formatHHmmTime(startTime);
    var end = formatHHmmTime(endTime);
    var heartRateDataUrl = "https://api.fitbit.com/1/user/-/activities/heart/date/" + startDate + "/" + endDate + "/1min/time/" + start + "/" + end + ".json";
    var headers = new Headers({"Authorization": "Bearer " + accessToken});
    d3.json(heartRateDataUrl, {"method": "GET", "headers": headers}).then(on_response)
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

function build_chart(accessToken, dateOfSleep) {

    var chart = d3.select("#chart");

    var outerWidth = chart.attr("width");
    var outerHeight = chart.attr("height");

    var margin = {top: 20, right: 30, bottom: 30, left: 40},
        width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;

    var x = d3.scaleTime().rangeRound([0, width]);

    var y = d3.scaleLinear().range([height, 0]);

    var xAxis = d3.axisBottom(x);

    var yAxis = d3.axisLeft(y);

    chart = chart
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    fetch_sleep_data(accessToken, dateOfSleep, function (response) {
        var data = response.sleep[0].levels.data; // dateTime, level, seconds

        var sleepStartTime = Date.parse(response.sleep[0].startTime)
        var sleepEndTime = Date.parse(response.sleep[0].endTime)

        x.domain([sleepStartTime, sleepEndTime]);

        fetch_heart_rate_data(accessToken, sleepStartTime, sleepEndTime, function (response) {
            var data = response["activities-heart-intraday"].dataset; // time [HH:mm:ss], value

            y.domain(d3.extent(data, d => d.value));

            var lineMaker = d3.line()
                .x(d => x(relativeTimeToDate(d.time, dateOfSleep)))
                .y(d => y(d.value));

            chart.append("path")
                .attr("fill", "none")
                .attr("stroke", "red")
                .attr("stroke-width", 1)
                .attr("d", lineMaker(data));

            chart.append("g")
                .attr("class", "y axis")
                .call(yAxis);

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

        })

        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        chart.selectAll(".bar")
            .data(data)
        .enter().append("rect")
            .attr("fill", function(d) { // TODO use color function to decode "level" to a color
                if (d.level === "deep")
                    return "#00ff0033";
                else if (d.level === "wake")
                    return "#ffffff33";
                else if (d.level === "rem")
                    return "#ff00ff33";
                else
                    return "#0000ff33";
            })
            .attr("stroke", "none")
            .attr("class", "bar")
            .attr("x", d => x(Date.parse(d.dateTime))) // start time
            .attr("y", 0 ) // upper end
            .attr("height", height ) // lower end
            .attr("width", d => x(Date.parse(d.dateTime)+d.seconds*1000) - x(Date.parse(d.dateTime))); // end time - start time = duration
    })
}

// *** Initialization ***

var url = new URL(window.location.href);
var params = parse_query_string(url.hash.substring(1));
var accessToken = params["access_token"];
var expiresIn = params["expires_in"]; // seconds until expiration
var userId = params["user_id"];

if (accessToken === undefined) {

    // Create a login link
    var loginLink = document.createElement("a");
    loginLink.setAttribute("href", "https://www.fitbit.com/oauth2/authorize?response_type=token&client_id=22BJK7&redirect_uri=http%3A%2F%2Flocalhost:8080%2F&scope=heartrate%20sleep&expires_in=2592000");
    loginLink.innerHTML = "Login at Fitbit";
    document.body.appendChild(loginLink);

} else {
    build_chart(accessToken, new Date(2020, 3, 10, 0, 0));
}