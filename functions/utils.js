var moment = require("moment")

exports.getMinAndMaxHora = (espacios) => {
  console.log("ESTOY EN GETMINMAXHORA")
  let minHoraDesde, maxHoraHasta
  espacios.forEach(espacio => {
    const { horaDesde, horaHasta } = espacio
    if (!minHoraDesde) {
      minHoraDesde = horaDesde
    }
    if (!maxHoraHasta) {
      maxHoraHasta = horaHasta
    }

    if (moment(horaDesde, "HH:mm").isBefore(moment(minHoraDesde, "HH:mm"))) minHoraDesde = horaDesde;
    if (moment(horaHasta, "HH:mm").isAfter(moment(maxHoraHasta, "HH:mm"))) maxHoraHasta = horaHasta;
  })

  return { minHoraDesde, maxHoraHasta }
}
exports.buildHorariosList = (minHoraDesde, maxHoraHasta, duracion, idsEspacios) => {
  let index = 1
  let lastHoraHasta = moment(minHoraDesde, "HH:mm").add(duracion, "hours")
  let list = [{
    horaDesde: moment(minHoraDesde, "HH:mm"),
    horaHasta: lastHoraHasta,
    espacios: idsEspacios
  }];
  console.log(list[list.length - 1].horaHasta.toString())
  while (moment(list[list.length - 1].horaHasta).isBefore(moment(maxHoraHasta, "HH:mm"))
    && moment(lastHoraHasta, "HH:mm").add(duracion, "hours").isSameOrBefore(moment(maxHoraHasta, "HH:mm"))) {
    if (index !== 1) {
      list.push({
        horaDesde: lastHoraHasta,
        horaHasta: moment(lastHoraHasta, "HH:mm").add(duracion, "h"),
        espacios: idsEspacios
      })
      lastHoraHasta = moment(lastHoraHasta, "HH:mm").add(duracion, "h")
    }
    index++;
  }
  console.log(list)
  return list
}

  // buildHorariosList("08:00", "19:00", 2.5,["a","b","c"])