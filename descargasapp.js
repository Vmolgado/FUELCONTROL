// === Config y Constantes ===
const SHEET_ID = '1CJFoRHCGTpv_yZ3z82uKi83PKruwLx_W9nSo3eQk7eM';
const API_KEY = 'AIzaSyC87Q8cqDQHmfWE8crKfyLUfY_KUk78Pb4';
const RANGE = 'Eventos';
const URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;

// === Variables Globales ===
let globalRows = [];

// Mapa Global
let globalMap;
let globalMarkers = [];

// Mapa individual por descarga
const maps = {};

// Token de Mapbox
mapboxgl.accessToken = 'pk.eyJ1Ijoidm1vbGdhZG83IiwiYSI6ImNtODRteWZzdzI2bG0ydG9vNXRnZXh6dm4ifQ.gq7ZHhf9J1bRTOfTAfcbzg';

/** Determina si la fila representa una 'Descarga de Combustible' */
function esDescargaCombustible(row) {
  return row[5] === 'Descarga';
}

/** Parsea fechas con formato: DD/MM/YYYY, H:MM:SS a.m./p.m. */
function parseFechaAmPm(str) {
  if (!str) return null;
  const [fechaStr, horaStr] = str.split(',');
  if (!fechaStr || !horaStr) return null;
  const [dia, mes, anio] = fechaStr.trim().split('/').map(n => parseInt(n, 10));

  let [horaParte, amPm] = horaStr.trim().split(' ');
  const [hStr, mStr, sStr] = horaParte.split(':');
  let hour = parseInt(hStr, 10);

  // Ajustes para a.m./p.m.
  if (amPm.toLowerCase().includes('p.m') && hour < 12) hour += 12;
  if (amPm.toLowerCase().includes('a.m') && hour === 12) hour = 0;

  return new Date(anio, mes - 1, dia, hour, parseInt(mStr, 10), parseInt(sStr, 10));
}

function parseLitros(value) {
  if (!value) return 0;
  const val = decodeURIComponent(value).replace(/\s*l$/, '');
  return parseFloat(val) || 0;
}

/** Extrae coordenadas de una cadena con lat/lon */
function extractCoordinates(encodedLocation) {
  const decoded = decodeURIComponent(encodedLocation);
  const match = decoded.match(/([NS])\s(\d+)°\s([\d.]+)'.*([EW])\s(\d+)°\s([\d.]+)'/);
  if (!match) return null;

  let lat = +match[2] + match[3]/60;
  let lon = +match[5] + match[6]/60;
  if (match[1] === 'S') lat = -lat;
  if (match[4] === 'W') lon = -lon;
  return { lat, lon };
}

// === Mapa Global (solo se crea una vez) ===
(function initGlobalMap() {
  globalMap = new mapboxgl.Map({
    container: 'mapaGlobal',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-99.1332, 19.4326], // Ejemplo: CDMX
    zoom: 5
  });
  globalMarkers = [];
})();

/** Actualiza el mapa global con marcadores basados en las filas filtradas */
function updateGlobalMap(filteredRows) {
  if (!globalMap) return;

  // Elimina marcadores viejos
  globalMarkers.forEach(m => m.remove());
  globalMarkers = [];

  // Agrega marcadores
  filteredRows.slice(1).forEach(row => {
    if (esDescargaCombustible(row)) {
      const coords = row[12] ? extractCoordinates(row[12]) : null;
      if (coords) {
        const marker = new mapboxgl.Marker({ color: '#ff0040' })
          .setLngLat([coords.lon, coords.lat])
          .addTo(globalMap);
        globalMarkers.push(marker);
      }
    }
  });

  // Ajusta vista si hay marcadores
  if (globalMarkers.length > 0) {
    const bounds = new mapboxgl.LngLatBounds();
    globalMarkers.forEach(m => bounds.extend(m.getLngLat()));
    globalMap.fitBounds(bounds, { padding: 50 });
  }
}

/** Inicializa el mapa individual de cada descarga */
function initMap(index, lat, lon) {
  const map = new mapboxgl.Map({
    container: `map${index}`,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [lon, lat],
    zoom: 17
  });
  maps[index] = {
    map,
    marker: new mapboxgl.Marker().setLngLat([lon, lat]).addTo(map)
  };
}

/** Cambia la capa en un mapa individual (Calles o Satélite) */
function changeMapLayer(index, layer) {
  const mapObj = maps[index];
  mapObj.map.setStyle(`mapbox://styles/mapbox/${layer}`);
  mapObj.map.once('style.load', () => {
    mapObj.marker.setLngLat(mapObj.map.getCenter()).addTo(mapObj.map);
  });
}

/** Llamada a Google Sheets (con callback opcional) */
async function fetchGoogleSheetData(cb) {
  try {
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`Error: ${response.status}`);

    const data = await response.json();
    globalRows = data.values || [];

    // Si se pasa un callback, se ejecuta después de cargar globalRows
    if (cb) cb();

  } catch (error) {
    console.error("Error Google Sheets:", error.message);
  }
}

/** Renderiza filas en la tabla */
function renderRows(allRows) {
  const tbody = document.getElementById("eventos-body");
  tbody.innerHTML = "";

  let sumaLitrosDescargados = 0;

  if (!allRows || allRows.length <= 1) {
    tbody.innerHTML = `<tr><td colspan="10">No se encontraron datos.</td></tr>`;
    document.getElementById("litrosDescargados").textContent = "0.00 L";
    return;
  }

  allRows.slice(1).filter(esDescargaCombustible).forEach((row, index) => {
    const coords = row[12] ? extractCoordinates(row[12]) : null;
    const latitude = coords?.lat ?? null;
    const longitude = coords?.lon ?? null;

    const litrajeInicial = parseLitros(row[6]);
    const litrosCargados = parseLitros(row[7]);
    const litrajeFinal = litrajeInicial - litrosCargados;

    // Acumula total
    sumaLitrosDescargados += litrosCargados;

    const unidadDecoded = decodeURIComponent(row[4] || "N/A");
    const sdPrimeros4 = unidadDecoded.substring(0, 4);

    tbody.innerHTML += `
      <tr>
        <td>${row[0] || "N/A"}</td>
        <td>${row[1] || "N/A"}</td>
        <td>${row[2] || "N/A"}</td>
        <td>${sdPrimeros4}</td>
        <td>${unidadDecoded}</td>
        <td>${litrajeInicial.toFixed(2)}</td>
        <td>${litrosCargados.toFixed(2)}</td>
        <td>${litrajeFinal.toFixed(2)}</td>
        <td id="localizacion${index}">Cargando...</td>
        <td>
          <select onchange="changeMapLayer(${index}, this.value)">
            <option value="streets-v12">Calles</option>
            <option value="satellite-streets-v12">Satélite</option>
          </select>
          <div id="map${index}" class="map-container"></div>
        </td>
      </tr>
    `;

    // Mapa individual
    if (latitude !== null && longitude !== null) {
      setTimeout(() => {
        getAddress(latitude, longitude, index);
        initMap(index, latitude, longitude);
      }, index * 3000);
    }
  });

  // Actualiza total
  document.getElementById("litrosDescargados").textContent = `${sumaLitrosDescargados.toFixed(2)} L`;

  // Actualiza mapa global
  updateGlobalMap(allRows);
}

/** Llenar <select> unidades con determinadas filas (sin "HEADER"). */
function llenarSelectorUnidades(rows) {
  const selector = document.getElementById('unidadSelect');
  selector.innerHTML = `<option value="">Todas</option>`;

  if (!rows || rows.length <= 1) return;

  const unidades = new Set();
  rows.slice(1).forEach(row => {
    if (esDescargaCombustible(row)) {
      unidades.add(decodeURIComponent(row[4] || "N/A"));
    }
  });

  unidades.forEach(unidad => {
    const opt = document.createElement('option');
    opt.value = unidad;
    opt.textContent = unidad;
    selector.appendChild(opt);
  });
}

/** Filtrar por Unidad */
function filtrarPorUnidad() {
  const unidadSelect = document.getElementById('unidadSelect').value;
  let rowsFiltradas = globalRows.slice(1).filter(row => {
    return esDescargaCombustible(row) &&
           (unidadSelect === "" || decodeURIComponent(row[4] || "N/A") === unidadSelect);
  });

  renderRows(['HEADER', ...rowsFiltradas]);
}

/** Filtrar Hoy, Semana, Mes */
function filtrarPor(rango) {
  if (!globalRows || globalRows.length <= 1) return;

  const hoy = new Date();
  const unDia = 86400000;
  let desde;

  if (rango === 'hoy') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  } else if (rango === 'semana') {
    desde = new Date(hoy.getTime() - 7 * unDia);
  } else if (rango === 'mes') {
    desde = new Date(hoy.getTime() - 30 * unDia);
  }

  let rowsFiltradas = globalRows.slice(1).filter(row => {
    const fecha = parseFechaAmPm(row[1]);
    return esDescargaCombustible(row) && fecha >= desde && fecha <= hoy;
  });

  llenarSelectorUnidades(['HEADER', ...rowsFiltradas]);
  renderRows(['HEADER', ...rowsFiltradas]);
}

/** Filtrar por Rango de fechas */
function filtrarPorRango() {
  if (!globalRows || globalRows.length <= 1) return;

  let startInput = document.getElementById('startDate').value;
  let endInput   = document.getElementById('endDate').value;

  // Si solo se ingresa una fecha, asumimos la misma
  if (startInput && !endInput) {
    endInput = startInput;
    document.getElementById('endDate').value = startInput;
  } else if (!startInput && endInput) {
    startInput = endInput;
    document.getElementById('startDate').value = endInput;
  }

  if (!startInput || !endInput) {
    alert("Selecciona fecha inicial y fecha final (o la misma).");
    return;
  }

  const startDate = new Date(startInput + 'T00:00:00');
  const endDate   = new Date(endInput + 'T23:59:59');

  const rowsFiltradas = globalRows.slice(1).filter(row => {
    if (!esDescargaCombustible(row)) return false;
    const fecha = parseFechaAmPm(row[1]);
    return fecha >= startDate && fecha <= endDate;
  });

  llenarSelectorUnidades(['HEADER', ...rowsFiltradas]);
  renderRows(['HEADER', ...rowsFiltradas]);
}

/** Obtener dirección vía geocoding */
async function getAddress(lat, lon, index) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${mapboxgl.accessToken}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const address = data.features[0]?.place_name || "Ubicación no disponible";
    document.getElementById(`localizacion${index}`).innerHTML = `
      <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="localizacion-link">
        ${address}
      </a>
    `;
  } catch (error) {
    console.error("Geocoding Error:", error);
  }
}

// NUEVO: limpiar todos los campos
function limpiarFiltros() {
  // Limpia fechas
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  // Limpia unidad
  document.getElementById('unidadSelect').value = '';
}

// NUEVO: se llama cuando das click en "Actualizar Datos"
function actualizarDatos() {
  // 1) Borra todos los filtros
  limpiarFiltros();
  // 2) Pide los datos de la hoja de nuevo (para tener la info actualizada)
  fetchGoogleSheetData(() => {
    // 3) Como queremos "todo" sin filtrar, llenamos con globalRows
    llenarSelectorUnidades(globalRows);
    renderRows(globalRows);
    updateGlobalMap(globalRows);
  });
}

// AL CARGAR LA PÁGINA: Pedimos los datos y luego, cuando lleguen, filtramos a "hoy"
document.addEventListener('DOMContentLoaded', () => {
  fetchGoogleSheetData(() => {
    filtrarPor('hoy'); 
  });
});
