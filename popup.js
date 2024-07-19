var traceValue = generateRandomStringBytes(16);
var parentValue = generateRandomStringBytes(8);

function generateRandomStringBytes(size) {
  let id = "";
  for (let i = 0; i < size; i++) {
    id += ("00" + Math.floor(Math.random() * 256).toString(16)).slice(-2);
  }
  return id;
}
function generateTranceparent() {
  return `00-${traceValue}-${parentValue}-01`;
}

async function fetchFilteredUsers() {
  try {
    const response = await fetch('http://104.192.2.29:3000/users');
    const users = await response.json();

    const filteredUsers = users.filter(user => 
      user.ofcDone === true && (!user.hasOwnProperty('ignoreMarked') || user.ignoreMarked === false)
    );

    return filteredUsers;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

async function populateUserSelect() {
  const userSelect = document.getElementById('userSelect');
  const filteredUsers = await fetchFilteredUsers();

  filteredUsers.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.dataset.applicantsId = user.applicantsID;
    option.dataset.reschedule = user.reschedule;
    option.innerHTML = user.name;
    userSelect.appendChild(option);
  });

  userSelect.addEventListener('change', function() {
    const selectedOption = userSelect.options[userSelect.selectedIndex];
    const userId = selectedOption.value;
    const applicantsId = selectedOption.dataset.applicantsId;
    const isRes = selectedOption.dataset.reschedule === "false" ? 0 : 1;
    console.log(selectedOption.dataset)
    document.getElementById('primary-id-input').value = userId;
    document.getElementById('dependents-id-input').value = applicantsId;
    document.getElementById('res-input').value = isRes;
  });
}

// Call the function to populate the select element
populateUserSelect();

function generateRequestID() {
  return `|${traceValue}.${parentValue}`;
}
async function fetchPrimaryID() {
  var homePageResponse = await fetch(
    "https://www.usvisascheduling.com/en-US/",
    {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "request-id": generateRequestID(),
        "sec-ch-ua":
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "sec-ch-ua-arch": '"arm"',
        "sec-ch-ua-bitness": '"64"',
        "sec-ch-ua-full-version": '"122.0.6261.69"',
        "sec-ch-ua-full-version-list":
          '"Chromium";v="122.0.6261.69", "Not(A:Brand";v="24.0.0.0", "Google Chrome";v="122.0.6261.69"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-model": '""',
        "sec-ch-ua-platform": '"macOS"',
        "sec-ch-ua-platform-version": '"14.3.1"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        traceparent: generateTranceparent(),
        "x-requested-with": "XMLHttpRequest",
      },
      referrer:
        "https://www.usvisascheduling.com/en-US/ofc-schedule/?reschedule=true",
      referrerPolicy: "strict-origin-when-cross-origin",
      method: "GET",
      mode: "cors",
      credentials: "include",
    }
  );
  var homePageData = await homePageResponse.text();
  const primaryNameRegex =
    /(?<=<span class="username">\s*)[^<]+?(?=\s*\(\d+\)\s*<\/span>)/;
  const applicationIDRegex = /"applicationId": "([a-f0-9-]{36})"/;

  // Use the match() method to find matches
  const primaryNameMatches = homePageData.match(primaryNameRegex);
  console.log(primaryNameMatches);
  const applicationIDMatches = homePageData.match(applicationIDRegex);

  // Check if a match is found and extract the applicationId value
  if (applicationIDMatches) {
    var primaryNameAndIDDict = {
      primaryName: primaryNameMatches[0].trim(),
      primaryID: applicationIDMatches[1],
    };
    return primaryNameAndIDDict;
  } else {
    console.log("No applicationId found");
  }
}

async function checkReschedule() {
  var data = await fetch(
    "https://www.usvisascheduling.com/en-US/appointment-confirmation/"
  );
  var text = await data.text();
  try {
    var ofcCount = text.match(/OFC APPOINTMENT DETAILS/g).length;
    if (ofcCount == 0) return false;
    else return true;
  } catch (error) {
    return false;
  }
}

async function fetchDependentIDs(primaryID, isReschedule) {
  const now = Date.now();
  var url = `https://www.usvisascheduling.com/en-US/custom-actions/?route=/api/v1/schedule-group/query-family-members-ofc&cacheString=${now}`;
  if (isReschedule == "true") {
    url = `https://www.usvisascheduling.com/en-US/custom-actions/?route=/api/v1/schedule-group/query-family-members-ofc-reschedule&cacheString=${now}`;
  }
  var dependentDataResponse = await fetch(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "request-id": generateRequestID(),
      "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Brave";v="122"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": '""',
      "sec-ch-ua-platform": '"Linux"',
      "sec-ch-ua-platform-version": '"5.15.0"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      traceparent: generateTranceparent(),
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "https://www.usvisascheduling.com/en-US/ofc-schedule/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `parameters={"primaryId":"${primaryID}","visaClass":"all"}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
  var familyData = await dependentDataResponse.json();
  var membersArr = familyData["Members"];
  var dependentIDsArr = [];
  if (membersArr.length == 0) return primaryID;
  membersArr.forEach((member) => {
    dependentIDsArr.push(member["ApplicationID"]);
  });
  return JSON.stringify(dependentIDsArr);
}

async function returnRandom() {
  var primaryInput = document.getElementById("primary-id-input");
  primaryInput.value = "1";
}
function fillInput() {
  document.getElementById("primary-id-input").value = "OFC";
}

document.addEventListener("DOMContentLoaded", async function () {
  var fetchTimeout;
  var primaryName = "";
  var primaryID = "";
  var dependentsIDs = "";
  var lastMonth = "";
  var lastDate = "";
  var earliestMonth = "";
  var earliestDate = "";
  var city = "mumbai";
  var consularCity = "mumbai";
  var consularRange;
  var awaitChecker = "";
  var delay = 10;
  var isConsularOnly;
  var isOFCOnly;
  var rescheduleInputValue;
  var userQty = 0;
  var isSleeper = 1;
  var [currentMonth, currentDate] = new Date()
    .toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
    })
    .split("/");
  document.getElementById("earliest-date-input").value =
    parseInt(currentDate) + 1;
  document.getElementById("earliest-month-input").value =
    parseInt(currentMonth);
  console.log(0);
  var fillButton = document.getElementById("fill-btn");
  var resetButton = document.getElementById("reset-btn");
  var primaryIDButton = document.getElementById("set-primary-id-btn");
  var dependentIDButton = document.getElementById("set-dependents-id-btn");
  var startAllButton = document.getElementById("start-btn");
  var OFCOnlyButton = document.getElementById("start-ofc-btn");
  var consularOnlyButton = document.getElementById("start-consular-btn");
  var citySelector = document.getElementById("city-selector");
  var consularCitySelector = document.getElementById("consular-city-selector");
  var consularRangeInput = document.getElementById("cons-diff-input");
  try {
    cookieData = await chrome.cookies.getAll({
      url: "https://www.kumarsambhav.me/",
    });
    cookieDict = {};
    for (let index = 0; index < cookieData.length; index++) {
      cookieDict[cookieData[index]["name"]] = cookieData[index]["value"];
    }
    // console.log(cookieDict)
    if (cookieDict["primaryID"] != undefined) {
      primaryID = cookieDict["primaryID"];
      primaryName = cookieDict["primaryName"];
      dependentsIDs = cookieDict["dependentsIDs"];
      userQty = parseInt(cookieDict["userQty"]);
      rescheduleInputValue = parseInt(cookieDict["rescheduleInputValue"]);
      earliestDate = parseInt(cookieDict["earliestDate"]);
      console.log(1);
      earliestMonth = parseInt(cookieDict["earliestMonth"]);
      lastDate = parseInt(cookieDict["lastDate"]);
      lastMonth = parseInt(cookieDict["lastMonth"]);
      fetchTimeout = parseInt(cookieDict["fetchTimeout"]);
      delay = parseInt(cookieDict["delay"]);
      city = cookieDict["city"] == undefined ? "mumbai" : cookieDict["city"];
      citySelector.value = city;
      consularCity =
        cookieDict["consularCity"] == undefined
          ? "mumbai"
          : cookieDict["consularCity"];
      consularCitySelector.value = consularCity;
      document.getElementById("primary-id-input").value = primaryID;
      document.getElementById("primary-user-name-span").innerHTML =
        primaryName + " (Cookie)";
      document.getElementById("res-input").value = rescheduleInputValue;
      document.getElementById("primary-user-qty-span").innerHTML = userQty;
      document.getElementById("dependents-id-input").value = dependentsIDs;
      document.getElementById("earliest-month-input").value = earliestMonth;
      document.getElementById("earliest-date-input").value = earliestDate;
      document.getElementById("last-month-input").value = lastMonth;
      document.getElementById("last-date-input").value = lastDate;
      document.getElementById("timeout-input").value = fetchTimeout;
      document.getElementById("delay-input").value =
        delay == undefined ? 10 : delay;
    }
  } catch (error) {}
  // Find the button by its ID

  // var checkRescheduleButton = document.getElementById("check-res-btn");

  async function handlePrimaryButtonClick() {
    primaryIDAndNameDict = await fetchPrimaryID();
    primaryName = primaryIDAndNameDict["primaryName"];
    primaryID = primaryIDAndNameDict["primaryID"];
    // Code to execute when the button is clicked
    // console.log(primaryName)
    document.getElementById("primary-id-input").value = primaryID;
    await chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "primaryID",
      value: primaryID,
    });
    await chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "primaryName",
      value: primaryName,
    });
  }
  async function handleCheckRescheduleButtonClick() {
    var applicationIsReschedule = await checkReschedule();
    if (applicationIsReschedule) rescheduleInputValue = 1;
    else rescheduleInputValue = 0;
    document.getElementById("res-input").value = rescheduleInputValue;
    await chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "rescheduleInputValue",
      value: rescheduleInputValue.toString(),
    });
  }
  async function handleDependentButtonClick() {
    isReschedule = parseInt(document.getElementById("res-input").value);
    if (isReschedule == 0) isReschedule = "false";
    else isReschedule = "true";
    dependentsIDs = await fetchDependentIDs(primaryID, isReschedule);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "dependentsIDs",
      value: dependentsIDs,
    });
    document.getElementById("dependents-id-input").value = dependentsIDs;
    var dIdsFirstLetter = dependentsIDs.slice(0, 1);

    if (dIdsFirstLetter == "[") {
      userQty = JSON.parse(dependentsIDs).length;
    } else {
      userQty = 1;
    }
    document.getElementById("primary-user-qty-span").innerHTML = userQty;
    document.getElementById("primary-user-name-span").innerHTML = primaryName;
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "userQty",
      value: userQty.toString(),
    });
  }
  // Attach an onclick event listener to the button
  fillButton.onclick = async function () {
    await handlePrimaryButtonClick();
    await handleCheckRescheduleButtonClick();
    await handleDependentButtonClick();
    lastMonth = parseInt(document.getElementById("last-month-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "lastMonth",
      value: lastMonth.toString(),
    });
    lastDate = parseInt(document.getElementById("last-date-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "lastDate",
      value: lastDate.toString(),
    });
    fetchTimeout = parseInt(document.getElementById("timeout-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "fetchTimeout",
      value: fetchTimeout.toString(),
    });
    earliestMonth = parseInt(
      document.getElementById("earliest-month-input").value
    );
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "earliestMonth",
      value: earliestMonth.toString(),
    });
    earliestDate = parseInt(
      document.getElementById("earliest-date-input").value
    );
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "earliestDate",
      value: earliestDate.toString(),
    });
    delay = parseInt(document.getElementById("delay-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "delay",
      value: delay.toString(),
    });
    consularRange = parseInt(consularRangeInput.value);
    // await handleCheckRescheduleButtonClick();
    // await handleDependentButtonClick();
  };
  resetButton.onclick = async function () {
    // document.getElementById("primary-user-name-span").innerHTML = ""
    // document.getElementById("primary-id-input").value = ""
    // primaryName = "";
    // document.getElementById("dependents-id-input").value = ""
    // dependentsIDs = "";
    // document.getElementById("primary-user-qty-span").innerHTML = "";
    // userQty = 0;
    var tempCurrentMonth = new Date().getMonth() + 1;
    var tempCurrentDate = new Date().getDate();
    var tempLastMonth = tempCurrentDate <= 15 ? tempCurrentMonth : tempCurrentMonth + 1;
    earliestMonth = new Date().getMonth() + 1;
    earliestDate = tempCurrentDate;
    lastMonth = tempLastMonth;
    lastDate = tempLastMonth == tempCurrentMonth ? tempCurrentDate + 20 : 20;
    delay = 10;
    isSleeper = 1;
    document.getElementById("earliest-month-input").value = tempCurrentMonth;
    document.getElementById("earliest-date-input").value = earliestDate;
    document.getElementById("last-month-input").value = lastMonth;
    document.getElementById("last-date-input").value = lastDate;
    document.getElementById("delay-input").value = 1;
    document.getElementById("sleeper-input").value = 1;
    citySelector.value = 'mumbai'
    city = 'mumbai'
    consularCitySelector.value = 'mumbai'
    consularCity = 'mumbai'
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "city",
      value: city,
    });
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "consularCity",
      value: consularCity,
    });
  };
  primaryIDButton.onclick = handlePrimaryButtonClick;
  citySelector.onchange = async function () {
    city = citySelector.value;
    consularCity = city;
    consularCitySelector.value = city;
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "city",
      value: city,
    });
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "consularCity",
      value: consularCity,
    });
  };
  consularCitySelector.onchange = async function () {
    consularCity = consularCitySelector.value;
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "consularCity",
      value: consularCity,
    });
  };
  consularRangeInput.onchange = async function () {
    consularRange = parseInt(consularRangeInput.value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "consularRange",
      value: consularRange,
    });
  };
  // checkRescheduleButton.onclick = handleCheckRescheduleButtonClick;
  dependentIDButton.onclick = handleDependentButtonClick;
  OFCOnlyButton.onclick = async function () {
    if (consularRange == undefined) consularRange = 20;
    lastMonth = parseInt(document.getElementById("last-month-input").value);
    lastDate = parseInt(document.getElementById("last-date-input").value);
    fetchTimeout = parseInt(document.getElementById("timeout-input").value);
    earliestMonth = parseInt(
      document.getElementById("earliest-month-input").value
    );
    earliestDate = parseInt(
      document.getElementById("earliest-date-input").value
    );
    isReschedule = parseInt(document.getElementById("res-input").value);
    if (isReschedule == 0) isReschedule = "false";
    else isReschedule = "true";
    isSleeper = parseInt(document.getElementById("sleeper-input").value);
    if (isSleeper == 0) isSleeper = false;
    else isSleeper = true;
    awaitChecker = parseInt(document.getElementById("await-input").value);
    if (awaitChecker == 0) awaitChecker = false;
    else awaitChecker = true;
    delay = parseInt(document.getElementById("delay-input").value);
    isOFCOnly = true;
    isConsularOnly = false;
    // city = document.getElementById("city-id-input").value.toLowerCase();
    var userDetails = {
      primaryName,
      primaryID,
      dependentsIDs,
      lastMonth,
      lastDate,
      earliestMonth,
      earliestDate,
      city,
      consularCity,
      consularRange,
      isReschedule,
      isSleeper,
      awaitChecker,
      delay,
      fetchTimeout,
      isOFCOnly,
      isConsularOnly,
    };
    chrome.runtime.sendMessage(userDetails, function (response) {
      console.log(response);
    });
  };
  startAllButton.onclick = async function () {
    if (consularRange == undefined) consularRange = 20;
    console.log("OK");
    lastMonth = parseInt(document.getElementById("last-month-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "lastMonth",
      value: lastMonth.toString(),
    });
    lastDate = parseInt(document.getElementById("last-date-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "lastDate",
      value: lastDate.toString(),
    });
    fetchTimeout = parseInt(document.getElementById("timeout-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "fetchTimeout",
      value: fetchTimeout.toString(),
    });
    earliestMonth = parseInt(
      document.getElementById("earliest-month-input").value
    );
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "earliestMonth",
      value: earliestMonth.toString(),
    });
    earliestDate = parseInt(
      document.getElementById("earliest-date-input").value
    );
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "earliestDate",
      value: earliestDate.toString(),
    });
    isReschedule = parseInt(document.getElementById("res-input").value);
    if (isReschedule == 0) isReschedule = "false";
    else isReschedule = "true";
    isSleeper = parseInt(document.getElementById("sleeper-input").value);
    if (isSleeper == 0) isSleeper = false;
    else isSleeper = true;
    awaitChecker = parseInt(document.getElementById("await-input").value);
    if (awaitChecker == 0) awaitChecker = false;
    else awaitChecker = true;
    delay = parseInt(document.getElementById("delay-input").value);
    chrome.cookies.set({
      url: "https://www.kumarsambhav.me/",
      name: "delay",
      value: delay.toString(),
    });
    isConsularOnly = false;
    isOFCOnly = false;
    // city = document.getElementById("city-id-input").value.toLowerCase();
    var userDetails = {
      primaryName,
      primaryID,
      dependentsIDs,
      lastMonth,
      lastDate,
      earliestMonth,
      earliestDate,
      city,
      consularCity,
      consularRange,
      isReschedule,
      isSleeper,
      awaitChecker,
      delay,
      fetchTimeout,
      isOFCOnly,
      isConsularOnly,
    };
    chrome.runtime.sendMessage(userDetails, function (response) {
      console.log(response);
    });
  };
  consularOnlyButton.onclick = async function () {
    if (consularRange == undefined) consularRange = 20;
    primaryID = document.getElementById("primary-id-input").value;
    dependentsIDs = document.getElementById("dependents-id-input").value;
    lastMonth = parseInt(document.getElementById("last-month-input").value);
    lastDate = parseInt(document.getElementById("last-date-input").value);
    fetchTimeout = parseInt(document.getElementById("timeout-input").value);
    earliestMonth = parseInt(
      document.getElementById("earliest-month-input").value
    );
    earliestDate = parseInt(
      document.getElementById("earliest-date-input").value
    );
    isReschedule = parseInt(document.getElementById("res-input").value);
    if (isReschedule == 0) isReschedule = "false";
    else isReschedule = "true";
    isSleeper = parseInt(document.getElementById("sleeper-input").value);
    if (isSleeper == 0) isSleeper = false;
    else isSleeper = true;
    awaitChecker = parseInt(document.getElementById("await-input").value);
    if (awaitChecker == 0) awaitChecker = false;
    else awaitChecker = true;
    delay = parseInt(document.getElementById("delay-input").value);
    isConsularOnly = true;
    isOFCOnly = false;
    // city = document.getElementById("city-id-input").value.toLowerCase();
    var userDetails = {
      primaryName,
      primaryID,
      dependentsIDs,
      lastMonth,
      lastDate,
      earliestMonth,
      earliestDate,
      city,
      consularCity,
      consularRange,
      isReschedule,
      isSleeper,
      awaitChecker,
      delay,
      fetchTimeout,
      isOFCOnly,
      isConsularOnly,
    };
    chrome.runtime.sendMessage(userDetails, function (response) {
      console.log(response);
    });
  };
});
