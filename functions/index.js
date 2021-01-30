const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const moment = require("moment");

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
        message: `Usuario con el email ${
          after.data().email
        } actualizado con exito`,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: `Error al actualizar usuario con el email ${
          after.data().email
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
        const estadoActual = reserva.estados[reserva.estados.length - 1] 
        const estados = reserva.estados

        const fechaInicioReserva = moment(reserva.fechaInicio.toDate()).utcOffset(-180)
        const fechaFinReserva = moment(reserva.fechaFin.toDate()).utcOffset(-180)
        console.log("FECHA INICIO " + fechaInicioReserva.toString(),"FECHA FIN " + fechaFinReserva.toString(),"NOW " + now.toString())
        console.log("ESTADO ACTUAL: " + estadoActual.estado)

        switch (estadoActual.estado) {
            case "CONFIRMADA" :
                console.log("ENTRO A CONFIRMADA")
                if(now.isBetween(fechaInicioReserva, fechaFinReserva, 'minute', '[]')) {
                // if(fechaInicioReserva.hour() === hour && fechaInicioReserva.minute() === minutes) {
                  console.log("SE CAMBIO A EN HORARIO")
                    estados.push({
                        estado: 'EN HORARIO',
                        fecha: admin.firestore.Timestamp.now(),
                        motivo: ''
                    })
                    changed = true
                }
                break
            case "EN CURSO" :
                console.log("ENTRO A EN CURSO")
                if(fechaFinReserva.isSameOrBefore(now, "minute")) {
                  console.log("SE CAMBIO A FINALIZADA")
                    estados.push({
                        estado: 'FINALIZADA',
                        fecha: admin.firestore.Timestamp.now(),
                        motivo: ''
                    })
                    changed = true
                }
                break
            case "EN HORARIO": 
            console.log("ENTRO A EN HORARIO")
            if(fechaFinReserva.isSameOrBefore(now, "minute")){
              console.log("SE CAMBIO A FINALIZADA")
              estados.push({
                estado: 'FINALIZADA',
                fecha: admin.firestore.Timestamp.now(),
                motivo: "La reserva nunca se pasó a EN CURSO."
              })
              changed = true
            } 
            break
                
            default:                
                break
        }

        if(changed) {
            console.log("SE EJECUTO UPDATE")
            snapshot.ref.update({estados})
        }

    })
  });
