const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const moment = require("moment");
const { getMinAndMaxHora, buildHorariosList, getFranjaHoraria } = require("./utils")




// Comandos: 
//   -Para deployar todas las funciones firebase deploy --only functions
//   -Para deployar solo una funcion especifica firebase deploy --only "functions:nombreFuncion"
admin.initializeApp();

exports.createUsuario = functions.https.onCall(async (userToRegister) => {
  console.log("user to register", userToRegister);
  try {
    const userRegistered = await admin.auth().createUser({
      email: userToRegister.email,
      password: userToRegister.contraseña,
      displayName: `${userToRegister.apellidos}, ${userToRegister.nombres}`,
    });
    console.log("USER REGISTERED", userRegistered);
    console.log("USER REGISTERED ID", userToRegister);
    const writeTime = await admin
      .firestore()
      .collection("usuarios")
      .doc(userRegistered.uid)
      .set({
        nombres: userToRegister.nombres,
        apellidos: userToRegister.apellidos,
        email: userToRegister.email,
        roles: userToRegister.roles,
        provincia: userToRegister.provincia,
        ciudad: userToRegister.ciudad,
        direccion: userToRegister.direccion,
        nroTelefono: userToRegister.nroTelefono,
        habilitado: userToRegister.habilitado,
      });

    return {
      status: "OK",
      message: `Usuario con el email ${userToRegister.email} registrado con exito`,
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: `Error al registrar usuario con el email ${userToRegister.email}`,
      error: error,
    };
  }
});

exports.updateUsuario = functions.firestore
  .document("usuarios/{userId}")
  .onUpdate(async (change) => {
    const after = change.after;
    const before = change.before;
    console.log("AFTER", after);
    console.log("BEFORE", before);
    try {
      if (
        before.data().email !== after.data().email ||
        before.data().habilitado !== after.data().habilitado
      ) {
        await admin.auth().updateUser(after.id, {
          email: after.data().email,
          disabled: !after.data().habilitado,
        });
      }
      return {
        status: "OK",
        message: `Usuario con el email ${after.data().email
          } actualizado con exito`,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: `Error al actualizar usuario con el email ${after.data().email
          }`,
        error: error,
      };
    }
  });

exports.sendContactEmail = functions.https.onCall(async (data, context) => {
  const { recipient, subject, body, attachments } = data;

  try {
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: false,
      auth: {
        user: "contacto.rentnow@gmail.com",
        pass: "renteandoahora0*9",
      },
    });

    let info = await transporter.sendMail({
      from: '"RentNow - Contacto" <contacto.rentnow@gmail.com>',
      to: recipient,
      subject,
      text: body,
      attachments,
    });
    console.log("Message sent: %s", info.response);
    return { status: "OK", message: `Email de contacto enviado con éxito` };
  } catch (err) {
    return {
      status: "ERROR",
      message: `Error al enviar el email de contacto.`,
      error: err,
    };
  }
});

// Traer todas las reservas que sean del dia de hoy [x]
// Iterar entre esas reservas [x]
// Por cada reserva :

// CONFIRMADA :
//   - Si la hora de inicio es igual a la hora actual (con 5min de margen) => pasar a EN HORARIO

// EN CURSO :
//   - Si la hora fin es <= que la hora actual => pasar a FINALIZADA

// EN HORARIO:
//  - Si la hora fin es <= que la hora actual => pasar a SIN CONCURRENCIA o FINALIZADO.

exports.updateReservasState = functions.pubsub
  .schedule("0,30 4-23 * * *")
  .onRun(async (context) => {
    const now = moment(admin.firestore.Timestamp.now().toDate()).utcOffset(-180)
    const day = now.date();
    const month = now.month();
    const year = now.year();

    const query = admin
      .firestore()
      .collection("reservas")
      .where("año", "==", year)
      .where("mes", "==", month)
      .where("dia", "==", day)

    const reservas = await query.get()

    reservas.forEach(snapshot => {
      let changed = false
      const reserva = snapshot.data()
      console.log("RESERVA", reserva)
      let estadoActual = reserva.estados[reserva.estados.length - 1]
      const estados = reserva.estados


      const fechaInicioReserva = moment(reserva.fechaInicio.toDate()).utcOffset(-180)
      const fechaFinReserva = moment(reserva.fechaFin.toDate()).utcOffset(-180)
      console.log("FECHA INICIO " + fechaInicioReserva.toString(), "FECHA FIN " + fechaFinReserva.toString(), "NOW " + now.toString())
      console.log("ESTADO ACTUAL: " + estadoActual.estado)

      switch (estadoActual.estado) {
        case "CONFIRMADA":
          console.log("ENTRO A CONFIRMADA")
          if (now.isBetween(fechaInicioReserva, fechaFinReserva, 'minute', '[]')) {
            // if(fechaInicioReserva.hour() === hour && fechaInicioReserva.minute() === minutes) {
            console.log("SE CAMBIO A EN HORARIO")
            estados.push({
              estado: 'EN HORARIO',
              fecha: admin.firestore.Timestamp.now(),
              motivo: ''
            })
            estadoActual = 'EN HORARIO'
            changed = true
          }
          break
        case "EN CURSO":
          console.log("ENTRO A EN CURSO")
          if (fechaFinReserva.isSameOrBefore(now, "minute")) {
            console.log("SE CAMBIO A FINALIZADA")
            estados.push({
              estado: 'FINALIZADA',
              fecha: admin.firestore.Timestamp.now(),
              motivo: ''
            })
            estadoActual = 'FINALIZADA'
            changed = true
          }
          break
        case "EN HORARIO":
          console.log("ENTRO A EN HORARIO")
          if (fechaFinReserva.isSameOrBefore(now, "minute")) {
            console.log("SE CAMBIO A FINALIZADA")
            estados.push({
              estado: 'FINALIZADA',
              fecha: admin.firestore.Timestamp.now(),
              motivo: "La reserva nunca se pasó a EN CURSO."
            })
            estadoActual = 'FINALIZADA'
            changed = true
          }
          break
        case "CREADA":
          console.log("ENTRO A CREADA")
          if (now.isBetween(fechaInicioReserva, fechaInicioReserva.add(-1, "hours"), 'minute', '[]')) {
            console.log("SE CAMBIO A CANCELADA")
            estados.push({
              estado: 'CANCELADA',
              fecha: admin.firestore.Timestamp.now(),
              motivo: "La reserva nunca fue confirmada por el Complejo."
            })
            estadoActual = 'CANCELADA'
            changed = true
          }
          break
        default:
          break
      }

      if (changed) {
        console.log("SE EJECUTO UPDATE")
        snapshot.ref.update({ estados, estadoActual })
      }

    })
  });

exports.getTiposEspacioByComplejoId = functions.https.onCall(async (idComplejo) => {
  try {
    let tiposEspacioUnicos = []
    const tipoEspacios = (await admin.firestore().collection('espacios').where("idComplejo", "==", idComplejo).get()).docs

    tipoEspacios.forEach(doc => {
      const docData = doc.data();
      if (tiposEspacioUnicos.indexOf(docData.tipoEspacio) === -1) {
        tiposEspacioUnicos.push(docData.tipoEspacio)
      }
    })

    console.log("Espacios", idComplejo, tipoEspacios);
    console.log("Tipo Espacios", tiposEspacioUnicos);
    return {
      status: "OK",
      message: `Tipos de espacio del complejo consultados con éxito.`,
      data: tiposEspacioUnicos
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: `Error al consultar los tipos de espacio`,
      error: error,
    };
  }
});

exports.createDocForNewUser = functions.https.onCall(async (extraData) => {
  try {
    console.log('extra user data', extraData)
    await admin
      .firestore()
      .collection("usuariosApp")
      .doc(extraData.uid)
      .set({
        nombre: extraData.nombre,
        apellido: extraData.apellido,
        email: extraData.email,
        habilitado: true,
        celular: extraData.celular,
        ciudad: extraData.ciudad,
        provincia: extraData.provincia
      });

    return {
      status: "OK",
      message: `Usuario creado`,
    };
  }
  catch (error) {
    return {
      status: "ERROR",
      message: "Error al crear usuario",
      error: error,
    };
  }
});


/**
obtenerHorariosDisponiblesParaDiaAndTipoEspacio(dia, tipoEspacio, idComplejo, duracion) {
  obtener los espacios de idComplejo y tipoEspacio
  se construye una lista de los horarios en que podian ser reservados los espacios de la siguiente manera :  [{desde: 8:00 (minima horaDesde de los espacios) , hasta: 9:00 , disponible: false,  espacios:[]}, 
                                                                                                                ....., 
                                                                                                                {desde: 8:00 , hasta: 9:00 (maxima horaHasta de los espacios) , disponible: true, espacios:[id1,id2]} ]
 
  por cada espacio se obtienen las reservas filtrando por el dia
  por cada reserva se elimina el espacio del listado de espacios de ese horario
  retornar horariosDisponibles, espacios

}

*/

exports.getFreeHorariosAndEspacios = functions.https.onCall(async (params) => {
  try {
    const espaciosDocs = (await admin.firestore().collection('espacios')
      .where("idComplejo", "==", params.idComplejo)
      .where("tipoEspacio", "==", params.tipoEspacio)
      .get()).docs
    const day = moment(params.fecha, 'DD/MM/YYYY').date();
    const month = moment(params.fecha, 'DD/MM/YYYY').month();
    const year = moment(params.fecha, 'DD/MM/YYYY').year();
    let espacios = []
    espaciosDocs.forEach(espacio => {
      let espacioObj = espacio.data();
      espacioObj.id = espacio.id
      espacios.push(espacioObj)
    })

    let horarios = getMinAndMaxHora(params.complejo, params.fecha);
    let minHoraDesde = horarios.horaDesde
    let maxHoraHasta = horarios.horaHasta
    let horariosList = []
    if (horarios.horaDesde && horarios.horaHasta) {
      horariosList = buildHorariosList(minHoraDesde, maxHoraHasta, params.duracion, espacios.map(espacio => espacio.id));
      await Promise.all(espacios.map(async espacio => {
        const reservas = (await admin.firestore().collection('reservas')
          .where("espacio.id", "==", espacio.id)
          .where("año", "==", year)
          .where("mes", "==", month)
          .where("dia", "==", day).get()).docs


        horariosList.forEach((horario, index) => {
          reservas.forEach(reservaDoc => {
            const reserva = reservaDoc.data();
            const fechaInicio = moment(reserva.fechaInicio.toDate(), "HH:mm").add(-3, "hours")
            const fechaFin = moment(reserva.fechaFin.toDate(), "HH:mm").add(-3, "hours")
            if (
              (moment(horario.horaDesde, "HH:mm").isSameOrAfter(moment(fechaInicio, "HH:mm")) && moment(fechaFin, "HH:mm").isBetween(moment(horario.horaDesde, "HH:mm"), moment(horario.horaHasta, "HH:mm"), "minute", "(]")) ||
              (moment(horario.horaDesde, "HH:mm").isSameOrBefore(moment(fechaInicio, "HH:mm"), "minute") && moment(horario.horaHasta, "HH:mm").isSameOrAfter(moment(fechaFin, "HH:mm"), "minute")) ||
              (moment(horario.horaDesde, "HH:mm").isSameOrBefore(moment(fechaInicio, "HH:mm")) && moment(horario.horaHasta, "HH:mm").isSameOrBefore(moment(fechaFin, "HH:mm"))) ||
              (moment(horario.horaDesde, "HH:mm").isSameOrAfter(moment(fechaInicio, "HH:mm")) && moment(horario.horaHasta, "HH:mm").isSameOrBefore(moment(fechaFin, "HH:mm")))
            ) {
              console.log(moment(fechaInicio, "HH:mm"), moment(fechaFin, "HH:mm"), horario.horaDesde, horario.horaHasta)
              const filteredIds = horario.espacios.filter(id => {
                return id !== espacio.id
              })

              horario.espacios = filteredIds
            }
          })
        })
      })
      )
    }
    console.log(horariosList, espacios)
    return {
      status: "OK",
      message: `Horarios consultados con éxito.`,
      data: {
        espacios: espacios,
        horarios: horariosList
      }
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: "Error al consultar horarios",
      error: error,
    };
  }
})

exports.registerNotificationNewReserva = functions.firestore.document('reservas/{reservaId}').onCreate(async (snapshot, context) => {
  try {
    const reservaId = context.params.reservaId;
    const data = snapshot.data()
    const complejoId = data.complejo.id
    console.log('Fecha  Inicio: ', moment(data.fechaInicio).toDate())

    const complejoSnap = await admin.firestore().collection('complejos').doc(complejoId).get()
    const complejoData = complejoSnap.data()
    // console.log("COMPLEJO DATA", complejoData)

    const usersToNotifyRefs = []
    complejoData.usuarios.forEach(usuario => {
      console.log("Usuario:", usuario)
      if (usuario.id) {
        usersToNotifyRefs.push(admin.firestore().collection(`usuarios/${usuario.id}/notificaciones`).doc(reservaId))
      }
    })
    // console.log("REFS", usersToNotifyRefs)

    usersToNotifyRefs.forEach(async userRef => {
      let notification = {
        idReserva: reservaId,
        tipo: "NUEVA RESERVA",
        mensaje: "Nueva reserva",
        espacio: data.espacio.descripcion,
        fechaInicio: admin.firestore.Timestamp.fromDate(moment(data.fechaInicio).toDate()),
        fechaFin: admin.firestore.Timestamp.fromDate(moment(data.fechaFin).toDate()),
        leida: false,
        complejo: {
          id: complejoId,
          nombre: complejoData.nombre
        }
      }
      console.log('Notificacion: ', notification)
      await userRef.set(notification)
    })

    return {
      status: "OK",
      message: `Notificacion Enviada con exito`,
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: `Error al Notificar la reserva`,
      error: error,
    };
  }
});

exports.createReservaApp = functions.https.onCall(async (params) => {
  const capitalize = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  try {
    const dia = moment(params.fechaInicio).date();
    const mes = moment(params.fechaInicio).month();
    const año = moment(params.fechaInicio).year();
    console.log(dia, mes, año)
    const semana = moment(params.fechaInicio).week();
    const diaString = capitalize(moment(params.fechaInicio).format('dddd'))
    const hora = moment(params.fechaInicio).hour()
    const franjaHoraria = getFranjaHoraria(hora)
    const fechaRegistro = admin.firestore.Timestamp.now();

    const fechaInicioToSave = moment(params.fechaInicio).toDate()
    const fechaFinToSave = moment(params.fechaFin).toDate()

    const reservaToSave = {
      fechaInicio: admin.firestore.Timestamp.fromDate(fechaInicioToSave),
      fechaFin: admin.firestore.Timestamp.fromDate(fechaFinToSave),
      dia: dia,
      mes: mes,
      año: año,
      semana: semana,
      diaString: diaString,
      hora: hora,
      franjaHoraria: franjaHoraria,
      fechaRegistro: fechaRegistro,
      cliente: params.cliente,
      espacio: params.espacio,
      complejo: params.complejo,
      estaPagado: false,
      estados: [{
        estado: "CREADA",
        fecha: admin.firestore.Timestamp.now(),
        motivo: "",
      }],
      estadoActual: "CREADA",
      monto: params.monto,
      esFijo: false,
      reservaApp: true,
    }

    console.log('Reserva recibida: ', params)

    const reservas = (await admin.firestore().collection('reservas')
      .where("espacio.id", "==", params.espacio.id)
      .where("año", "==", año)
      .where("mes", "==", mes)
      .where("dia", "==", dia).get()).docs

    let horarioDisponible = true

    console.log('Las reservas son: ', reservas)

    if (reservas.length !== 0) {
      console.log('entro al if de reservas')
      reservas.forEach(reservaDoc => {
        const reserva = reservaDoc.data();
        console.log('Reserva: ', reserva)
        const fechaInicio = moment(reserva.fechaInicio.toDate(), "HH:mm").add(-3, "hours")
        const fechaFin = moment(reserva.fechaFin.toDate(), "HH:mm").add(-3, "hours")
        if (
          ((moment(fechaInicioToSave).format('HH:mm')).isSameOrAfter(fechaInicio) && fechaFin.isBetween(moment(fechaInicioToSave).format('HH:mm'), moment(fechaFinToSave).format('HH:mm'), "minute", "(]")) ||
          ((moment(fechaInicioToSave).format('HH:mm')).isSameOrBefore(fechaInicio, "minute") && (moment(fechaFinToSave).format('HH:mm')).isSameOrAfter(fechaFin, "minute")) ||
          ((moment(fechaInicioToSave).format('HH:mm')).isSameOrBefore(fechaInicio) && (moment(fechaFinToSave).format('HH:mm')).isSameOrBefore(fechaFin)) ||
          ((moment(fechaInicioToSave).format('HH:mm')).isSameOrAfter(fechaInicio) && (moment(fechaFinToSave).format('HH:mm')).isSameOrBefore(fechaFin))
        ) {
          console.log('entro al False')
          horarioDisponible = false
        }
      })
    }

    if (horarioDisponible) {
      // Registrar Reserva
      console.log('entro al true')
      await admin.firestore().collection('reservas').add(reservaToSave)
    }
    return {
      status: "OK",
      message: `La reserva ha sido validada con exito.`,
      data: {
        horarioDisponible: horarioDisponible
      }
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: "Error al validar la reserva",
      error: error,
    };
  }
})

exports.registerNotificationReservaTerminada = functions.firestore.document('reservas/{reservaId}').onUpdate(async (change, context) => {
  try {
    const reservaId = context.params.reservaId;
    const afterData = change.after.data();
    const beforeData = change.before.data();
    const complejoId = data.complejo.id

    if (!afterData.reservaApp) {
      return;
    }

    if (afterData.estados[-1].estado !== 'FINALIZADA' || beforeData.estados[-1].estado === 'FINALIZADA') {
      return
    }

    const complejoSnap = await admin.firestore().collection('complejos').doc(complejoId).get()
    const complejoData = complejoSnap.data()

    const userToNotifyRef = admin.firestore().collection(`usuariosApp/${usuario.id}/notificaciones`).doc(reservaId)

    const notification = {
      idReserva: reservaId,
      tipo: 'CAMBIO ESTADO - FINALIZADA',
      mensaje: "Su reserva se concretó con éxito. Desea valorar el complejo ? ",
      espacio: afterData.espacio.descripcion,
      fechaInicio: afterData.fechaInicio.toString(),
      fechaFin: afterData.fechaFin.toString(),
      leida: false,
      complejo: {
        id: complejoId,
        nombre: complejoData.nombre
      }
    }

    await userToNotifyRef.set(notification)

    return {
      status: "OK",
      message: `Notificacion Enviada con exito`,
    };
  } catch (error) {
    console.log("ERROR", error);
    return {
      status: "ERROR",
      message: `Error al Notificar la reserva`,
      error: error,
    };
  }
});

exports.updateReservasStateWhenStateIsCreate = functions.pubsub
  .schedule("59 4-23 * * *")
  .onRun(async (context) => {
    const now = moment(admin.firestore.Timestamp.now().toDate()).utcOffset(-180)

    const query = admin
      .firestore()
      .collection("reservas")
      .where("estadoActual", "==", 'CREADA')

    const reservas = await query.get()
    reservas.forEach(snapshot => {
      let changed = false
      const reserva = snapshot.data()
      let estadoActual
      const estados = reserva.estados
      console.log("RESERVA", reserva)
      const fechaRegistroReserva = moment(reserva.fechaRegistro.toDate()).utcOffset(-180)

      if (now.isSameOrAfter(fechaRegistroReserva.add(12, "hours"))) {
        estados.push({
          estado: 'CANCELADA',
          fecha: admin.firestore.Timestamp.now(),
          motivo: 'Pasaron 12 horas sin que la reserva fuera confirmada por el Complejo'
        })
        estadoActual = 'CANCELADA'
        changed = true
      }

      if (changed) {
        console.log("SE EJECUTO UPDATE")
        snapshot.ref.update({ estados, estadoActual })
      }
    })
  })