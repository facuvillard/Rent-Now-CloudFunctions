var moment = require("moment")

exports.getMinAndMaxHora = (espacios) => {
  console.log("ESTOY EN GETMINMAXHORA")
  let minHoraDesde
  let maxHoraHasta
  espacios.forEach(espacio => {
    const horaDesde = espacio.horaDesde;
    const horaHasta = espacio.horaHasta;
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
    horaDesde: minHoraDesde,
    horaHasta: moment(minHoraDesde, "HH:mm").add(duracion, "hours").format("HH:mm"),
    espacios: idsEspacios
  }];

  while (moment(list[list.length - 1].horaHasta,"HH:mm").isBefore(moment(maxHoraHasta, "HH:mm"))
    && moment(lastHoraHasta, "HH:mm").add(duracion, "hours").isSameOrBefore(moment(maxHoraHasta, "HH:mm"))) {
    if (index !== 1) {
      list.push({
        horaDesde: lastHoraHasta.format("HH:mm"),
        horaHasta: moment(lastHoraHasta, "HH:mm").add(duracion, "h").format("HH:mm"),
        espacios: idsEspacios
      })
      lastHoraHasta = moment(lastHoraHasta, "HH:mm").add(duracion, "h")
    }
    index++;
  }
  console.log(list)
  return list
}
// exports.buildHorariosList("08:00","23:00", 1, ["a","b"])

// const hola = (fechaInicioReserva, fechaFinReserva, horario) => {
//   const fechaInicio = moment(fechaInicioReserva, "HH:mm");
//   const fechaFin = moment(fechaFinReserva, "HH:mm");
//   if (
//     (moment(horario.horaDesde, "HH:mm").isSameOrAfter(fechaInicio) && fechaFin.isBetween(moment(horario.horaDesde, "HH:mm"), moment(horario.horaHasta, "HH:mm"), "minute", "(]")) ||
//     (moment(horario.horaDesde, "HH:mm").isSameOrBefore(fechaInicio) && moment(horario.horaHasta, "HH:mm").isSameOrAfter(fechaFin)) ||
//     (moment(horario.horaDesde, "HH:mm").isSameOrBefore(fechaInicio) && moment(horario.horaHasta, "HH:mm").isSameOrBefore(fechaFin)) ||
//     (moment(horario.horaDesde, "HH:mm").isSameOrAfter(fechaInicio) && moment(horario.horaHasta, "HH:mm").isSameOrBefore(fechaFin))
//   ) {
//     console.log('8-Entro al IF')
//   }
// }

// hola()