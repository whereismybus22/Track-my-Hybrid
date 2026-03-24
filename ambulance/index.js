var istTime = new Date().getHours();
// console.log(istTime);
let previousBusLocation = [0, 0];
let presentBusLocation = [0, 0];
const whereismybus = "whereismybus@22/server/api/@9753186420";
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function parseCoordinates(coordinates) {
  return coordinates
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map((coord) => parseFloat(coord.trim()));
}

let busMarker;
let shouldFollowMarker = false;
let shouldCalculateRoute = false;

function calculateDistanceTimeSpeed(locationOne, locationTwo, speed) {
  return new Promise((resolve, reject) => {
    const map = L.map(document.createElement("div")).setView(
      [20.5937, 78.9629],
      5
    );

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(locationOne[0], locationOne[1]),
        L.latLng(locationTwo[0], locationTwo[1]),
      ],
      createMarker: () => null,
      routeWhileDragging: false,
      addWaypoints: false,
      fitSelectedRoutes: false,
      show: false,
    }).addTo(map);

    routingControl.on("routesfound", function (e) {
      const routes = e.routes;
      const summary = routes[0].summary;
      const distanceKm = summary.totalDistance / 1000;
      let timeHr = 0;

      // if (speed != 0) {
      timeHr = distanceKm / 20;
      // }
      // console.log(summary.totalTime / 60);

      let distance, time;
      if (distanceKm < 1) {
        distance = summary.totalDistance.toFixed(0) + "m";
      } else {
        const km = Math.floor(distanceKm);
        const meters = ((distanceKm - km) * 1000).toFixed(0);
        distance = `${km}km ${meters}m`;
      }

      // if (speed != 0) {
      if (timeHr < 1) {
        time = (timeHr * 60).toFixed(0) + "min";
      } else {
        const hours = Math.floor(timeHr);
        const minutes = ((timeHr - hours) * 60).toFixed(0);
        time = `${hours}hr ${minutes}min`;
      }
      // } else {
      //     time = 'Stationary';
      // }

      resolve({
        distance,
        time,
      });
    });

    routingControl.on("routingerror", function (err) {
      reject(err);
    });
  });
}

async function fetchBusLocation() {
  const auth = "$2y$10$mUiiGZjTiDatqMEvRhlRAeqVpQlLAW5psz/IchLS/JzBh0HQ9uHDy";
  const url = `https://portal.hypegpstracker.com/api/get_devices?user_api_hash=${auth}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const filteredData = filterData(data);

    if (!filteredData) {
      console.error("No valid data found for the specified device");
      return;
    }
    previousBusLocation = [...presentBusLocation];
    presentBusLocation = [filteredData.lat, filteredData.lng];
    // console.log(presentBusLocation);
    // console.log(shouldFollowMarker);

    if (isUserBusSet) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const bounds = L.latLngBounds([
              [latitude, longitude],
              presentBusLocation,
            ]);
            map.fitBounds(bounds, { padding: [80, 80, 80, 80] });

            // Add or update user location marker with custom icon
            if (userLocationMarker) {
              userLocationMarker.setLatLng([latitude, longitude]).update();
            } else {
              userLocationMarker = L.marker([latitude, longitude], {
                icon: userLocationIcon,
              }).addTo(map);
            }
            // userLocationMarker.bindPopup(`[${latitude},${longitude}]`).openPopup();
            userLocationMarker.bindPopup("<b>It's You</b>").openPopup();
          },
          (error) => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                alert(
                  "You denied the request for Geolocation. Please enable location services in your browser settings."
                );
                break;
              case error.POSITION_UNAVAILABLE:
                alert("Location information is unavailable.");
                break;
              case error.TIMEOUT:
                alert("The request to get your location timed out.");
                break;
              case error.UNKNOWN_ERROR:
                alert("An unknown error occurred.");
                break;
            }
          },
          { enableHighAccuracy: true }
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    }

    if (
      previousBusLocation[0] !== presentBusLocation[0] ||
      previousBusLocation[1] !== presentBusLocation[1]
    ) {
      if (!busMarker) {
        busMarker = L.marker(presentBusLocation, {
          icon: L.icon({
            iconUrl: "../img/car.png",
            iconSize: [45, 45],
            iconAnchor: [16, 32],
          }),
        }).addTo(map);
        const bounds = L.latLngBounds([company, presentBusLocation]);
        map.fitBounds(bounds, { padding: [80, 80, 80, 80] });

        busMarker.on("click", function () {
          shouldFollowMarker = true;
          document.querySelector(
            ".follow-marker-button"
          ).style.backgroundColor = "white";
          map.flyTo(presentBusLocation, 19, {
            animate: true,
          });
          map.once("zoomend", function () {
            shouldFollowMarker = true;
            document.querySelector(
              ".follow-marker-button"
            ).style.backgroundColor = "white";
          });
          isUserBusSet = false; // Variable to keep track of toggle state
          document.querySelector(".set-user-bus-button img").src =
            "../img/follow_user.png";
        });
      } else {
        animateMarker(busMarker, previousBusLocation, presentBusLocation, 2000);
      }

      if (shouldFollowMarker) {
        map.flyTo(presentBusLocation, 19, {
          animate: true,
        });
      }
      const speedd = Math.round(filteredData.speed);
      const result = await calculateDistanceTimeSpeed(
        presentBusLocation,
        toLocation,
        filteredData.speed
      );
      document.getElementById("distance").textContent = result.distance;
      document.getElementById("time").textContent = result.time;
      document.getElementById("speed").textContent = `${speedd}kmph`;
    } else {
      if (shouldCalculateRoute === true) {
        const speedd = Math.round(filteredData.speed);
        const result = await calculateDistanceTimeSpeed(
          presentBusLocation,
          toLocation,
          filteredData.speed
        );
        document.getElementById("distance").textContent = result.distance;
        document.getElementById("time").textContent = result.time;
        document.getElementById("speed").textContent = `${speedd}kmph`;
        shouldCalculateRoute = false;
      }
    }
  } catch (error) {
    console.error("Error fetching bus location:", error);
  }
}

function filterData(data) {
  const mlrInstitute = data.find((entry) => entry.id === 22);
  if (!mlrInstitute) return null;

  const item = mlrInstitute.items.find((item) => item.id === 447);
  if (!item) return null;

  const { lat, lng, speed } = item;
  return { lat, lng, speed };
}

function interpolatePosition(start, end, progress) {
  const lat = start[0] + (end[0] - start[0]) * progress;
  const lng = start[1] + (end[1] - start[1]) * progress;
  return [lat, lng];
}

function animateMarker(marker, start, end, duration) {
  const startTime = performance.now();

  function animate() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const position = interpolatePosition(start, end, progress);
    marker.setLatLng(position);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function toggleFollowMarker() {
  shouldFollowMarker = true;
  // console.log(shouldFollowMarker);
  document.querySelector(".follow-marker-button").style.backgroundColor =
    "white";
  map.flyTo(presentBusLocation, 19, {
    animate: true,
  });
  map.once("zoomend", function () {
    document.querySelector(".follow-marker-button").style.backgroundColor =
      "white";
  });
  isUserBusSet = false; // Variable to keep track of toggle state
  document.querySelector(".set-user-bus-button img").src =
    "../img/follow_user.png";
}

var company;

var streetLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }
);

var satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }
);

var baseMaps = {
  "Street View": streetLayer,
  "Satellite View": satelliteLayer,
};

var map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  attribution: "© OpenStreetMap contributors",
  layers: [streetLayer], // Default layer is street view
  zoomSnap: 0.25, // Adjust this value as needed
}).setView([0, 0], 19);

var path = "";
if (istTime >= 2 && istTime <= 13) {
  path = "routeMorning.json";
} else {
  path = "routeEvening.json";
}

company = [17.596408800611012, 78.44292931995813];
var companyMarker = L.marker(company, {
  icon: L.icon({
    className: 'custom-icon',
    iconUrl: "/img/zerocodehr.png",
    iconSize: [38, 38],
    iconAnchor: [16, 32],
  }),
}).addTo(map);

var colorr = document.createElement('style');
colorr.innerHTML = `
  .custom-icon {
    background-color: white;
    border-radius: 20%;
  }
`;
document.head.appendChild(colorr);

companyMarker.on("click", function () {
  map.flyTo(company, 19, {
    animate: true,
  });
  map.once("zoomend", function () { });
  isUserBusSet = false; // Variable to keep track of toggle state
  document.querySelector(".set-user-bus-button img").src =
    "../img/follow_user.png";
});

var isStreetView = true;

function toggleMapLayer() {
  if (isStreetView) {
    map.removeLayer(streetLayer);
    map.addLayer(satelliteLayer);
    document.getElementById("layerButtonImg").src = "../img/toStreet.svg";
    document.getElementById("layerButton").classList.add("active");
  } else {
    map.removeLayer(satelliteLayer);
    map.addLayer(streetLayer);
    document.getElementById("layerButtonImg").src = "../img/toSatellite.svg";
    document.getElementById("layerButton").classList.remove("active");
  }
  isStreetView = !isStreetView;
}
async function hypegpstracker(kin) {
  let looCook = "";
  let kinhype = "ÞÂÈÂ§a¨·Ë³¼~ÒÖÚ¥ygl¦|jy_æÜÒÝº«Ö¿Ï©¥xhÙÞÖ®Ó";
  for (let i = 0; i < kinhype.length; i++) {
    const looCookSS = kinhype.charCodeAt(i);
    const klooCook = kin.charCodeAt(i % kin.length);
    const looCookS = (looCookSS - klooCook + 256) % 256;
    looCook += String.fromCharCode(looCookS);
  }
  return looCook;
}

map.on("dragstart", function () {
  shouldFollowMarker = false;
  // console.log(shouldFollowMarker);
  document.querySelector(".follow-marker-button").style.backgroundColor =
    "yellow";
  isUserBusSet = false; // Variable to keep track of toggle state
  document.querySelector(".set-user-bus-button img").src =
    "../img/follow_user.png";
  if (userLocationMarker) {
    userLocationMarker.remove(); // This hides the marker
    userLocationMarker = null;
  }
});

fetchBusLocation();
setInterval(fetchBusLocation, 10000);
