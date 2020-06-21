define("helper", [], function() {
// *** Helper Functions ***

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

  return {
    create_data_row: create_data_row,
    parseDate: parseDate,
    formatDate: formatDate,
    formatHHmmTime: formatHHmmTime,
    parseSeconds: parseSeconds,
    relativeTimeToDate: relativeTimeToDate
  };
});