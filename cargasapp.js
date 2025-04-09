const SHEET_ID = '1CJFoRHCGTpv_yZ3z82uKi83PKruwLx_W9nSo3eQk7eM';
const API_KEY = 'AIzaSyC87Q8cqDQHmfWE8crKfyLUfY_KUk78Pb4';
const RANGE = 'Eventos';
const URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;

async function fetchGoogleSheetData() {
  try {
    console.log("Consultando Google Sheets en:", URL);
    const response = await fetch(URL);
    if (!response.ok) {
      throw new Error(`Error al obtener datos: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Respuesta de Sheets:", data); // Log completo
    const rows = data.values;
    const tbody = document.getElementById("eventos-body");
    tbody.innerHTML = ""; // Limpiar la tabla antes de llenarla

    if (rows && rows.length > 1) {
      // Filtrar filas para "Carga de Combustible" en la columna 6 (row[5])
      rows.slice(1)
        .filter(row => row[5] === "Carga de Combustible")
        .forEach((row, index) => {
          // Extraer coordenadas con la función extractCoordinates
          const coords = row[12] ? extractCoordinates(row[12]) : null;
          const latitude = coords ? coords.lat : null;
          const longitude = coords ? coords.lon : null;

          // Construir la fila
          let newRow = `
            <tr>
              <td>${row[0] || "N/A"}</td>
              <td>${row[1] || "N/A"}</td>
              <td>${row[2] || "N/A"}</td>
              <td>${row[3] || "N/A"}</td>
              <td>${row[4] || "N/A"}</td>
              <td>${row[5] || "N/A"}</td>
              <td>${row[6] || 0}</td>
              <td>${row[8] || 0}</td>
              <td>${row[9] || 0}</td>
              <td>${row[10] || 0}</td>
              <td>${row[11] || 0}</td>
              <td id="localizacion${index}">Cargando...</td>
              <td><div id="map${index}" class="map-container"></div></td>
            </tr>
          `;
          tbody.innerHTML += newRow;

          // Solo si tenemos lat/long en decimal
          if (latitude && longitude) {
            // Esperar más tiempo para evitar rate limit si hay muchas filas
            setTimeout(() => {
              getAddress(latitude, longitude, index);
              initMap(index, latitude, longitude);
            }, index * 3000); // 3 segundos por fila
          } else {
            console.warn(`Fila ${index}: Coordenadas inválidas o no extraídas.`);
          }
        });
    } else {
      tbody.innerHTML = `<tr><td colspan="13">No se encontraron datos o la hoja está vacía.</td></tr>`;
    }
  } catch (error) {
    console.error("Error al consultar Google Sheets:", error.message);
  }
}

async function getAddress(lat, lon, index) {
  if (!lat || !lon) {
    console.warn(`Índice ${index}: Coordenadas inválidas para getAddress.`);
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    console.log("Solicitando dirección a Nominatim:", url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error HTTP al obtener dirección: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`Nominatim respuesta [index=${index}]:`, data);

    document.getElementById(`localizacion${index}`).innerHTML = `
      <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="localizacion-link">
        ${data.display_name || "Ubicación no disponible"}
      </a>
    `;
  } catch (error) {
    console.error("Error obteniendo dirección:", error);
  }
}

function initMap(index, lat, lon) {
  console.log(`Inicializando mapa en index=${index}, lat=${lat}, lon=${lon}`);
  let map = L.map(`map${index}`).setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  L.marker([lat, lon]).addTo(map);
}

// Esta función extrae las coordenadas de una cadena URL-encoded del tipo:
// "N%2020%C2%B0%2059%2E1396%27, W%20100%C2%B0%2024%2E3878%27"
function extractCoordinates(encodedLocation) {
  let decoded = decodeURIComponent(encodedLocation);
  console.log("Ubicación decodificada:", decoded);

  // Se espera un formato "N 20° 59.1396', W 100° 24.3878'"
  const regex = /([NS])\s(\d+)°\s([\d.]+)'\s*,\s*([EW])\s(\d+)°\s([\d.]+)'/;
  const match = decoded.match(regex);
  if (!match) {
    console.error("No se pudieron extraer coordenadas de:", decoded);
    return null;
  }
  let latDir = match[1];
  let latDeg = parseFloat(match[2]);
  let latMin = parseFloat(match[3]);
  let lonDir = match[4];
  let lonDeg = parseFloat(match[5]);
  let lonMin = parseFloat(match[6]);

  let latDecimal = latDeg + (latMin / 60);
  let lonDecimal = lonDeg + (lonMin / 60);

  if (latDir === "S") latDecimal *= -1;
  if (lonDir === "W") lonDecimal *= -1;

  const coords = {
    lat: parseFloat(latDecimal.toFixed(6)),
    lon: parseFloat(lonDecimal.toFixed(6))
  };
  console.log("Coordenadas extraídas:", coords);
  return coords;
}

// Cargar datos al iniciar
fetchGoogleSheetData();
