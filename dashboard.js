/*****************************************************
 *  CONFIGURACIÓN DE GOOGLE SHEETS
 *****************************************************/
const SHEET_ID = '1CJFoRHCGTpv_yZ3z82uKi83PKruwLx_W9nSo3eQk7eM';
const API_KEY  = 'AIzaSyC87Q8cqDQHmfWE8crKfyLUfY_KUk78Pb4';
const RANGE    = 'G772 DB';

/*****************************************************
 *  FUNCIÓN WHATSAPP PARA UNA UNIDAD (DINÁMICA)
 *****************************************************/
function solicitarServicioUnidad(item) {
  const mensajeInicial = "🔔 Hola, me gustaría solicitar la revisión técnica de la siguiente unidad, ya que aparece como Fuera de Linea:\n\n";
  const unidad  = item['Unidad']  || 'Sin dato';
  const imei    = item['IMEI']    || 'Sin dato';
  const vin     = item['VIN']     || 'Sin dato';
  const placas  = item['Placas']  || 'Sin dato';

  let estatus = 'Sin dato';
  if (item['Estatus'] === '0') estatus = 'Fuera de Linea';
  else if (item['Estatus'] === '1') estatus = 'En Linea';

  const mensajeTexto =
    mensajeInicial +
    "🚚 Unidad: "  + unidad  + "\n" +
    "📱 IMEI: "    + imei    + "\n" +
    "🔑 VIN: "     + vin     + "\n" +
    "🔖 Placas: "  + placas  + "\n" +
    "⚠️ Estatus: " + estatus;

  const mensajeEncoded = encodeURIComponent(mensajeTexto);
  const numeroSoporte  = "524442515007";
  const url = `https://api.whatsapp.com/send?phone=${numeroSoporte}&text=${mensajeEncoded}`;
  window.open(url, "_blank");
}

/*****************************************************
 *  FUNCIÓN PARA CARGAR DATOS DE FLOTILLA
 *****************************************************/
function cargarDatosFlotilla(filtro = 'todos') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const rows = data.values;
      if (!rows || rows.length === 0) {
        console.error('No se encontraron datos en la hoja.');
        return;
      }
      const headers = rows.shift();
      const datosFlotilla = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
      mostrarFlotilla(datosFlotilla, filtro);
    })
    .catch(err => console.error('Error al cargar los datos:', err));
}

/*****************************************************
 *  FUNCIÓN PARA MOSTRAR DATOS DE FLOTILLA EN EL HTML
 *****************************************************/
function mostrarFlotilla(datos, filtro = 'todos') {
  const contenedor = document.getElementById('flotillaContainer');
  contenedor.classList.remove('oculto');
  contenedor.innerHTML = '';

  let totalConectadas = 0;
  let totalSinConexion = 0;

  datos.forEach(item => {
    let statusText = 'Sin dato';
    if (item['Estatus'] === '0') {
      statusText = 'Fuera de Linea';
      totalSinConexion++;
    } else if (item['Estatus'] === '1') {
      statusText = 'En Linea';
      totalConectadas++;
    }

    if (filtro === 'conectadas'  && statusText !== 'En Linea')      return;
    if (filtro === 'sinConexion' && statusText !== 'Fuera de Linea') return;

    const divItem = document.createElement('div');
    divItem.style.border       = '1px solid #ccc';
    divItem.style.padding      = '10px';
    divItem.style.marginBottom = '10px';
    divItem.style.borderRadius = '5px';

    /* ---- NUEVO: círculo verde / rojo usando Font Awesome ---- */
    const estadoHTML = statusText === 'En Linea'
  ? '<span class="status-dot online"></span>'
  : statusText === 'Fuera de Linea'
    ? '<span class="status-dot offline"></span>'
    : '';

    divItem.innerHTML = `
      <strong>Unidad:</strong> <i class="fas fa-truck"></i> ${item['Unidad'] || 'Sin dato'}<br>
      <strong>IMEI:</strong> ${item['IMEI'] || 'Sin dato'}<br>
      <strong>VIN:</strong> ${item['VIN'] || 'Sin dato'}<br>
      <strong>Placas:</strong> ${item['Placas'] || 'Sin dato'}<br>
      <strong>Odometro:</strong> ${item['Odometro'] || 'Sin dato'}<br>
      <strong>Estatus:</strong> ${estadoHTML}
    `;

    if (statusText === 'Fuera de Linea') {
      const btn = document.createElement('button');
      btn.className = 'service-button';
      btn.innerHTML = '<i class="fab fa-whatsapp" style="margin-right:5px;"></i> Solicitar Servicio Técnico';
      btn.onclick   = () => solicitarServicioUnidad(item);
      divItem.appendChild(btn);
    }

    contenedor.appendChild(divItem);
  });

  /* ---- Tarjetas resumen ---- */
  const cardActivas     = document.getElementById('cardActivas');
  const cardSinConexion = document.getElementById('cardSinConexion');

  if (cardActivas) {
    const p = cardActivas.querySelector('p');
    if (p) p.textContent = totalConectadas;
    cardActivas.classList.remove('oculto');
    cardActivas.onclick = () => mostrarFlotilla(datos, 'conectadas');
  }
  if (cardSinConexion) {
    const p = cardSinConexion.querySelector('p');
    if (p) p.textContent = totalSinConexion;
    cardSinConexion.classList.remove('oculto');
    cardSinConexion.onclick = () => mostrarFlotilla(datos, 'sinConexion');
  }

  /* Ocultar tarjetas de solicitudes */
  document.getElementById('cardAgendadas').classList.add('oculto');
  document.getElementById('cardCompletadas').classList.add('oculto');
  document.getElementById('cardCanceladas').classList.add('oculto');
}

/*****************************************************
 *  EVENTOS PARA "FLOTILLA" Y "SERVICIOS TÉCNICOS"
 *****************************************************/
document.addEventListener('DOMContentLoaded', () => {
  const linkFlotilla  = document.getElementById('linkFlotilla');
  const linkServicios = document.getElementById('linkServicios');

  if (linkFlotilla) {
    linkFlotilla.addEventListener('click', e => {
      e.preventDefault();
      cargarDatosFlotilla();
    });
  }

  if (linkServicios) {
    linkServicios.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('cardAgendadas' ).classList.remove('oculto');
      document.getElementById('cardCompletadas').classList.remove('oculto');
      document.getElementById('cardCanceladas').classList.remove('oculto');
      document.getElementById('cardActivas').classList.add('oculto');
      document.getElementById('cardSinConexion').classList.add('oculto');
      const cont = document.getElementById('flotillaContainer');
      cont.classList.add('oculto');
      cont.innerHTML = '';
    });
  }
});
