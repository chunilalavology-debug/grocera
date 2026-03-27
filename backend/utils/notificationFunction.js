const admin = require("./createFirebaseUser");
const serviceNotification = require('../routes/services/serviceNotification')
// const { apiErrorRes, apiSuccessRes } = require('./globalFunction')

let notificationFunction = async (data) => {
    try {
        const payload = {
            token: data?.notifyToken,
            notification: {
                title: `${data?.title}`,
                body: `${data?.body}`,
                image: data?.image
            },
            data: {
                type: `${data?.type}`,
                userId: `${data?.userId}`,
                message: `${data?.message}`
            },
            android: {
                notification: {
                    title: `${data?.title}`,
                    body: `${data?.body}`,
                    color: "#fff5df",
                    priority: "high",
                    sound: "custom_sound",
                    vibrateTimingsMillis: [200, 500, 800],
                    image: data?.image ?? null,
                    channelId: 'channel-id-1',
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: `${data?.title}`,
                            body: `${data?.body}`,
                        },
                        sound: "custom_sound.caf",
                        badge: 1
                    }
                },
                fcm_options: {
                    image: data?.image // Include the image URL
                }
            }
        };

        try {


            const notificationResponse = {
                // name: data?.message || data?.body,
                name: data?.title,
                msg: data?.body,
                userId: data?.userId,
                image: data?.image,
                typeRedirect: data?.type
            };
            if (data?.notifyToken) {
                const response = await admin.messaging().send(payload);
            }
            else {
                console.log("Device Id Not Available for this User")
            }
            await serviceNotification.saveNotification(notificationResponse);
            return 'success'
        } catch (error) {
            console.error('Error sending message:', error.message);
            return error
        }

    } catch (error) {
        return error
    }
}



module.exports = { notificationFunction };

// notificationFunction(payload)