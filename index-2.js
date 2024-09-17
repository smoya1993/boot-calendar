const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // Para hacer la llamada HTTP externa
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de Twilio (obtén tu SID y Auth Token de Twilio)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Ruta para recibir mensajes de WhatsApp
app.post('/whatsapp', (req, res) => {
    const from = req.body.From; // Número de quien envía el mensaje
    const body = req.body.Body; // Cuerpo del mensaje

    // Procesa el mensaje recibido y haz la llamada HTTP
    axios.post('https://n8n-xw9f.onrender.com/webhook-test/add-event-to-calendar', {
        ctx: {
            from: from,
            body: body
        }
    })
    .then(response => {
        console.log('Webhook called successfully', response.data);
        // Envía respuesta a WhatsApp usando Twilio
        client.messages.create({
            body: `Evento recibido con éxito: ${body}`,
            from: 'whatsapp:+14155238886', // Número de Twilio para WhatsApp
            to: from // El número de la persona que envió el mensaje
        })
        .then(message => console.log('Mensaje enviado a WhatsApp', message.sid))
        .catch(err => console.error('Error enviando mensaje', err));
        
        res.status(200).send('Mensaje recibido y procesado');
    })
    .catch(err => {
        console.error('Error llamando al webhook', err);
        res.status(500).send('Error procesando el evento');
    });
});

// Iniciar el servidor
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});