define(["params", "cookie", "helper", "d3", "d3-fetch", "domReady!"], function(param, cookie, helper, d3, d3Fetch) {

    // *** Sleep data fetching ***

    function fetch_sleep_data(accessToken, dateOfSleep, on_response) {
        var dateFormatted = helper.formatDate(dateOfSleep);
        var sleepDataUrl = "https://api.fitbit.com/1.2/user/-/sleep/date/" + dateFormatted + ".json";
        fetch_json(accessToken, sleepDataUrl).then(on_response);
    }

    // *** Heart rate data fetching ***

    function fetch_heart_rate_data(accessToken, startTime, endTime, on_response) {
        var startDate = helper.formatDate(startTime);
        var endDate = helper.formatDate(endTime);
        var start = helper.formatHHmmTime(startTime);
        var end = helper.formatHHmmTime(endTime);
        var heartRateDataUrl = "https://api.fitbit.com/1/user/-/activities/heart/date/" + startDate + "/" + endDate + "/1min/time/" + start + "/" + end + ".json";
        fetch_json(accessToken, heartRateDataUrl).then(on_response);
    }

    function fetch_json(accessToken, url) {
        var headers = new Headers({"Authorization": "Bearer " + accessToken});
        return d3Fetch.json(url, {"method": "GET", "headers": headers})
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
        d3Fetch.json(tokenInfoUrl, {"method": "POST", "headers": headers, "body": params}).then(on_token_introspect_response(accessToken));
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
                    .x(d => x(helper.relativeTimeToDate(d.time, dateOfSleep)))
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
        d3.select("#previousDateButton").on("click", () => change_date_of_sleep(-1));
        d3.select("#nextDateButton").on("click", () => change_date_of_sleep(1));
        d3.select("#dateInput").on("change", () => validate_date_of_sleep());
        d3.select("#submitButton").on("click", () => update_date_of_sleep(accessToken));

        if (!d3.select("#dateInput").property("value")) {
            var dateText = helper.formatDate(new Date());
            d3.select("#dateInput").property("value", dateText);
        }

        if (accessToken) {
            update_date_of_sleep(accessToken);
        }
    }

    function update_date_of_sleep(accessToken) {
        var dateText = d3.select("#dateInput").property("value");
        var date = helper.parseDate(dateText);
        update_chart_data(accessToken, date);
    }

    function change_date_of_sleep(changeInDays) {
        var dateInput = d3.select("#dateInput")
        var dateText = dateInput.property("value");
        var date = helper.parseDate(dateText);
        var changedDate = new Date(date.getTime() + changeInDays * 24 * 60 * 60 * 1000);
        dateInput.property("value", helper.formatDate(changedDate));
        update_chart_data(accessToken, changedDate)
    }

    function validate_date_of_sleep() {
        // TODO validate text and activate buttons only if valid
    }

    // *** Initialization ***

    var url = new URL(window.location.href);
    var params = param.parse_query_string(url.hash.substring(1));
    var accessToken = params["access_token"];
    var expiresIn = params["expires_in"]; // seconds until expiration
    var userId = params["user_id"];

    if (accessToken === undefined) {

        var cookieKey = "fitBitApiClientId";

        var clientId = cookie.getCookie(cookieKey);
        if (clientId === null) {
            clientId = prompt("Please enter your FitBit API Client ID", "")
            cookie.setCookie(cookieKey, clientId, 10 * 365) // stored for 10 years
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

    init_form();

    return {
        change_date_of_sleep: change_date_of_sleep,
        validate_date_of_sleep: validate_date_of_sleep,
        update_date_of_sleep: update_date_of_sleep
    };
});