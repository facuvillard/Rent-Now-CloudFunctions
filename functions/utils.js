var moment = require("moment-timezone")
require('moment/locale/es')
const admin = require("firebase-admin");

moment.tz.setDefault("America/Argentina/Buenos_Aires")

const capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

exports.getMinAndMaxHora = (complejo, fecha) => {
  moment.locale('es')
  let horaDesde = null
  let horaHasta = null
  const diaReserva = capitalize(moment(fecha, 'DD/MM/YYYY').format('dddd'))
  const now = moment(admin.firestore.Timestamp.now().toDate())
  console.log('Fecha ahora: ', now)
  for (const dia in complejo.horarios) {
    if (dia === diaReserva && complejo.horarios[dia].abre) {
      if (moment(fecha, 'DD/MM/YYYY').isSame(now, 'day')) {
        if (moment(complejo.horarios[dia].desde).isBefore(now)) {
          const diferencia = 180 - (now.minute() % 30);
          horaDesde = (moment(now.add(diferencia, "minutes").toDate())).format('LT');
          horaHasta = complejo.horarios[dia].hasta
        }
      }
      else {
        horaDesde = complejo.horarios[dia].desde
        horaHasta = complejo.horarios[dia].hasta
      }
    }
  }
  return { horaDesde, horaHasta }
}

exports.buildHorariosList = (minHoraDesde, maxHoraHasta, duracion, idsEspacios) => {
  let index = 1
  let lastHoraHasta = moment(minHoraDesde, "HH:mm").add(duracion, "hours")
  let list = [{
    horaDesde: minHoraDesde,
    horaHasta: moment(minHoraDesde, "HH:mm").add(duracion, "hours").format("HH:mm"),
    espacios: idsEspacios
  }];

  while (moment(list[list.length - 1].horaHasta, "HH:mm").isBefore(moment(maxHoraHasta, "HH:mm"))
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
  return list
}

exports.getFranjaHoraria = (hora) => {

  if (hora >= 5 && hora < 13) {
    return 'Mañana'

  }
  if (hora >= 13 && hora < 16) {
    return 'Siesta'

  }
  if (hora >= 16 && hora < 19) {
    return 'Tarde'

  }
  if (hora >= 19 && hora < 24) {
    return 'Noche'

  }

  return 'Fuera de franja'
}

exports.isFreeHorario = (horaInicioHorario, horaInicioReserva, horaFinReserva, horaFinHorario, estadoActual) => {

  const horaInicioHorarioMoment = moment(horaInicioHorario, 'HH:mm')
  const horaFinHorarioMoment = moment(horaFinHorario, 'HH:mm')
  const horaInicioReservaMoment = moment(horaInicioReserva, 'HH:mm')
  const horaFinReservaMoment = moment(horaFinReserva, 'HH:mm')

  if(estadoActual !== 'CANCELADA'){
    if (horaInicioHorarioMoment.isSameOrAfter(horaInicioReservaMoment) && horaFinReservaMoment.isBetween(horaInicioHorarioMoment, horaFinHorarioMoment, "minute", "(]")) {
      return false
    }
    if (horaInicioHorarioMoment.isBefore(horaInicioReservaMoment, "minute") && horaFinHorarioMoment.isAfter(horaFinReservaMoment, "minute")) {
      return false
    }
    if (horaInicioHorarioMoment.isSameOrBefore(horaInicioReservaMoment) && horaFinHorarioMoment.isBefore(horaFinReservaMoment) && horaInicioReservaMoment.isBefore(horaFinHorarioMoment)) {
      return false
    }
    if (horaInicioHorarioMoment.isSameOrAfter(horaInicioReservaMoment) && horaFinHorarioMoment.isSameOrBefore(horaFinReservaMoment)) {
      return false
    }
  }

  return true
}