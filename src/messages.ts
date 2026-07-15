import * as process from "node:process"
import * as crypto from "node:crypto"
import { Base64 } from "js-base64";
import Constants from "./config";

type formSubmitNotificationData = {
    devEnvironment: boolean,
    teamNumber: number,
    prevData: string,
    newData: string,
    timestamp: EpochTimeStamp,
    sourceIP: string,
}

type MessageOptions = {
    parent: String,
    requestBody: Object
}

export default class Chat {
    
    public static async sendFormSubmitNotification(data: formSubmitNotificationData) {

        const token = await Chat.acquireAuthToken()

        if (!token) {
            return
        }

        let spaceList = await Chat.listSpaces(token)
        spaceList?.forEach(async (space) => {
            const res = await Chat.sendMessage(token, {
                parent: space.name,
                requestBody: {
                    "cardsV2": [
                        {
                            "card": {
                                "header": {
                                    "title": (data.devEnvironment ? "[DEVELOP] " : "") + "New Team Update!",
                                    "subtitle": `New information has just been recieved for team ${data.teamNumber} by the Open Alliance API.`
                                },
                                "sections": [
                                    {
                                        "header": "Request Deltas:",
                                        "collapsible": false,
                                        "uncollapsibleWidgetsCount": 0,
                                        "widgets": [
                                            {
                                                "textParagraph": {
                                                    "text": "<strong>Previous Data:</strong><br>" + data.prevData,
                                                    "maxLines": 4,
                                                }
                                            },
                                            {
                                                "textParagraph": {
                                                    "text": "<strong>Incoming Data:</strong><br>" + data.newData,
                                                    "maxLines": 4
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "header": "Information",
                                        "collapsible": true,
                                        "uncollapsibleWidgetsCount": 1,
                                        "widgets": [
                                            {
                                                "textParagraph": {
                                                    "text": `Timestamp: ${new Date(data.timestamp).toUTCString()} <br> Source IP: ${data.sourceIP}`,
                                                    "maxLines": 2
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "header": "Actions",
                                        "collapsible": true,
                                        "uncollapsibleWidgetsCount": 1,
                                        "widgets": [
                                            {
                                                "buttonList": {
                                                    "buttons": [
                                                        {
                                                            "text": "Explore Database",
                                                            "type": "OUTLINED",
                                                            "onClick": {
                                                                "openLink": {
                                                                    "url": Constants.notificationDBLink
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "text": "Access API Kill-Switches",
                                                            "type": "FILLED",
                                                            "onClick": {
                                                                "openLink": {
                                                                    "url": Constants.notificationKVLink
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            })
            return res
        });
    }

    private static async acquireAuthToken() {
        let pem = process.env.GCHAT_PRIVATE_KEY;

        if (!pem) {
            return
        }

        pem = pem.replace(/\n/g, "");

        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";

        if (!pem.startsWith(pemHeader) || !pem.endsWith(pemFooter)) {
            return
        }

        const pemContents = pem.substring(
            pemHeader.length,
            pem.length - pemFooter.length,
        );

        const buffer = Base64.toUint8Array(pemContents);

        const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            buffer,
            {
                name: "RSASSA-PKCS1-v1_5",
                hash: {
                    name: "SHA-256",
                },
            },
            false,
            ["sign"]
        )

        const header = Base64.encodeURI(
            JSON.stringify({
                alg: "RS256",
                typ: "JWT",
                kid: process.env.GCHAT_PRIVATE_KEY_ID,
            }),
        );

        const payload = Base64.encodeURI(
            JSON.stringify({
                iss: process.env.GCHAT_SERVICE_EMAIL,
                sub: process.env.GCHAT_SERVICE_EMAIL,
                scope: "https://www.googleapis.com/auth/chat.bot",
                aud: "https://oauth2.googleapis.com/token",
                exp: Math.floor(Date.now() / 1000) + 300,
                iat: Math.floor(Date.now() / 1000),
            }),
        );

        const textEncoder = new TextEncoder();
        const inputArrayBuffer = textEncoder.encode(`${header}.${payload}`);

        const outputArrayBuffer = await crypto.subtle.sign(
            { name: "RSASSA-PKCS1-v1_5" },
            privateKey,
            inputArrayBuffer,
        );

        const signature = Base64.fromUint8Array(
            new Uint8Array(outputArrayBuffer),
            true,
        );

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: `${header}.${payload}.${signature}`,
            }),
        });

        if (!tokenResponse.ok) {
            return;
        }

        const tokenData = await tokenResponse.json();

        return tokenData.access_token;
    }

    public static async sendMessage(token:String, options: MessageOptions) {

        if (!token) {
            return
        }

        const response = await fetch(`https://chat.googleapis.com/v1/${options.parent}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(options.requestBody),
        });

        if (!response.ok) {
            return;
        }
    }

    private static async listSpaces(token: string) {

        const response = await fetch("https://chat.googleapis.com/v1/spaces", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json()
        return data.spaces
    }

}